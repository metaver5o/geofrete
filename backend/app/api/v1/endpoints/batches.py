import logging
import urllib.parse
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Batch, BatchStatus, Delivery, Route
from app.schemas.batch import (
    BatchDetailResponse,
    BatchStatusResponse,
    BatchUploadRequest,
)
from app.schemas.delivery import DeliveryResponse
from app.schemas.route import OptimizedRouteResponse, RouteStopResponse
from app.services.optimizer import RouteOptimizer
from app.worker.tasks import process_delivery_batch

logger = logging.getLogger(__name__)
router = APIRouter()


def format_delivery_address(d: Delivery) -> str:
    """Format delivery address components into a clean single-line string."""
    parts = []
    if d.street:
        street_str = d.street
        if d.number:
            street_str += f", {d.number}"
        if d.complement:
            street_str += f" - {d.complement}"
        parts.append(street_str)
    if d.neighborhood:
        parts.append(d.neighborhood)
    if d.city:
        city_state = d.city
        if d.state:
            city_state += f" - {d.state}"
        parts.append(city_state)
    if d.postal_code:
        parts.append(f"CEP {d.postal_code}")
    if not parts and d.raw_text:
        return d.raw_text.strip()
    return ", ".join(parts) if parts else "Endereço não especificado"


@router.post(
    "/upload",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload bulk delivery labels from mobile scanner",
)
def upload_batch(
    payload: BatchUploadRequest,
    db: Session = Depends(get_db),
):
    """Receives bulk scanned packages, registers batch and starts async processing."""
    try:
        # Create Batch record
        new_batch = Batch(
            courier_id=payload.courier_id,
            origin_address=payload.origin_address or "Localização Inicial do Entregador",
            origin_lat=payload.origin_lat,
            origin_lng=payload.origin_lng,
            total_items=len(payload.deliveries),
            status=BatchStatus.PENDING,
        )
        db.add(new_batch)
        db.flush()

        # Create Delivery records
        delivery_records = []
        geocoded_initial = 0
        for item in payload.deliveries:
            is_pre_geocoded = item.lat is not None and item.lng is not None
            if is_pre_geocoded:
                geocoded_initial += 1

            delivery = Delivery(
                batch_id=new_batch.id,
                tracking_number=item.tracking_number,
                recipient_name=item.recipient_name,
                recipient_phone=item.recipient_phone,
                raw_text=item.raw_text,
                street=item.street,
                number=item.number,
                complement=item.complement,
                neighborhood=item.neighborhood,
                city=item.city,
                state=item.state,
                postal_code=item.postal_code,
                lat=item.lat,
                lng=item.lng,
                geocoded=is_pre_geocoded,
            )
            delivery_records.append(delivery)

        db.add_all(delivery_records)
        new_batch.geocoded_items = geocoded_initial
        db.commit()

        # Enqueue async processing in Celery
        try:
            process_delivery_batch.delay(new_batch.id)
        except Exception as queue_err:
            logger.warning(
                f"Could not enqueue to Celery broker directly ({queue_err}). "
                "Triggering synchronous fallback or background thread."
            )
            # Fallback direct execution for lightweight environments or testing
            try:
                process_delivery_batch(new_batch.id)
            except Exception as task_err:
                logger.error(f"Fallback processing failed: {task_err}")

        return {
            "batch_id": new_batch.id,
            "status": new_batch.status,
            "total_items": new_batch.total_items,
            "message": "Lote recebido com sucesso. Processamento de roteirização em andamento.",
        }
    except Exception as e:
        db.rollback()
        logger.exception(f"Error creating batch: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao processar lote: {str(e)}",
        )


@router.get(
    "/{batch_id}",
    response_model=BatchStatusResponse,
    summary="Get current processing status of a batch",
)
def get_batch_status(
    batch_id: str,
    db: Session = Depends(get_db),
):
    """Polling endpoint for mobile clients to check geocoding and optimization progress."""
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote não encontrado.",
        )

    # Calculate estimated progress
    progress = 0.0
    if batch.status == BatchStatus.PENDING:
        progress = 10.0
    elif batch.status == BatchStatus.PROCESSING:
        geocode_ratio = (
            (batch.geocoded_items / batch.total_items) if batch.total_items > 0 else 0
        )
        progress = min(20.0 + (geocode_ratio * 60.0), 90.0)
    elif batch.status == BatchStatus.OPTIMIZED:
        progress = 100.0
    elif batch.status == BatchStatus.FAILED:
        progress = 100.0

    return BatchStatusResponse(
        batch_id=batch.id,
        status=batch.status,
        total_items=batch.total_items,
        geocoded_items=batch.geocoded_items,
        progress_percentage=round(progress, 1),
        error_message=batch.error_message,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
    )


@router.get(
    "/{batch_id}/detail",
    response_model=BatchDetailResponse,
    summary="Get full batch detail including list of packages",
)
def get_batch_detail(
    batch_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve full batch specifications, individual package status and route summary."""
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote não encontrado.",
        )

    deliveries = (
        db.query(Delivery)
        .filter(Delivery.batch_id == batch_id)
        .order_by(Delivery.sequence_order.asc().nullslast())
        .all()
    )

    route_response = None
    if batch.route:
        # Build route preview
        route_response = build_route_response(batch, db)

    return BatchDetailResponse(
        batch_id=batch.id,
        courier_id=batch.courier_id,
        status=batch.status,
        total_items=batch.total_items,
        geocoded_items=batch.geocoded_items,
        origin_lat=batch.origin_lat,
        origin_lng=batch.origin_lng,
        origin_address=batch.origin_address,
        error_message=batch.error_message,
        created_at=batch.created_at,
        deliveries=[DeliveryResponse.model_validate(d) for d in deliveries],
        route=route_response,
    )


def build_route_response(batch: Batch, db: Session) -> OptimizedRouteResponse:
    """Helper to assemble the complete optimized itinerary."""
    route = batch.route
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rota ainda não gerada ou não encontrada para este lote.",
        )

    deliveries = {
        d.id: d
        for d in db.query(Delivery).filter(Delivery.batch_id == batch.id).all()
    }

    stops: List[RouteStopResponse] = []

    # Stop 0: Courier Origin
    origin_gmaps = f"https://www.google.com/maps/dir/?api=1&destination={batch.origin_lat},{batch.origin_lng}"
    origin_waze = f"https://waze.com/ul?ll={batch.origin_lat},{batch.origin_lng}&navigate=yes"

    stops.append(
        RouteStopResponse(
            sequence_order=0,
            delivery_id=None,
            is_origin=True,
            address=batch.origin_address or "Ponto de Partida",
            lat=batch.origin_lat,
            lng=batch.origin_lng,
            recipient_name="Partida (Entregador)",
            distance_from_previous_km=0.0,
            google_maps_url=origin_gmaps,
            waze_url=origin_waze,
        )
    )

    prev_lat = batch.origin_lat
    prev_lng = batch.origin_lng

    # Subsequent stops in optimized sequence
    for seq, del_id in enumerate(route.ordered_stop_ids, start=1):
        del_item = deliveries.get(del_id)
        if not del_item or del_item.lat is None or del_item.lng is None:
            continue

        dist_km = (
            RouteOptimizer.haversine_distance(
                prev_lat, prev_lng, del_item.lat, del_item.lng
            )
            * RouteOptimizer.URBAN_CIRCUITY_FACTOR
        )

        dest_coords = f"{del_item.lat},{del_item.lng}"
        stops.append(
            RouteStopResponse(
                sequence_order=seq,
                delivery_id=del_item.id,
                is_origin=False,
                address=format_delivery_address(del_item),
                lat=del_item.lat,
                lng=del_item.lng,
                recipient_name=del_item.recipient_name,
                recipient_phone=del_item.recipient_phone,
                tracking_number=del_item.tracking_number,
                distance_from_previous_km=round(dist_km, 2),
                google_maps_url=f"https://www.google.com/maps/dir/?api=1&destination={dest_coords}",
                waze_url=f"https://waze.com/ul?ll={dest_coords}&navigate=yes",
            )
        )

        prev_lat = del_item.lat
        prev_lng = del_item.lng

    return OptimizedRouteResponse(
        route_id=route.id,
        batch_id=batch.id,
        total_stops=len(stops) - 1,
        total_distance_km=route.total_distance_km,
        estimated_time_minutes=route.estimated_time_minutes,
        origin_lat=batch.origin_lat,
        origin_lng=batch.origin_lng,
        stops=stops,
    )


@router.get(
    "/{batch_id}/route",
    response_model=OptimizedRouteResponse,
    summary="Get calculated optimal itinerary with turn-by-turn sequence",
)
def get_optimized_route(
    batch_id: str,
    db: Session = Depends(get_db),
):
    """Returns the ordered delivery route with navigation links for Google Maps and Waze."""
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote não encontrado.",
        )

    if batch.status != BatchStatus.OPTIMIZED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rota ainda não concluída. Status atual: {batch.status}. Consulte novamente em instantes.",
        )

    return build_route_response(batch, db)
