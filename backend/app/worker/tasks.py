import logging
from typing import Dict
from app.core.database import SessionLocal
from app.models.models import Batch, BatchStatus, Delivery, Route
from app.services.geocoding import geocoding_service
from app.services.optimizer import RouteOptimizer
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.worker.tasks.process_delivery_batch", max_retries=2)
def process_delivery_batch(self, batch_id: str) -> Dict:
    """Asynchronous pipeline to geocode and optimize a delivery batch."""
    logger.info(f"Starting async processing for Batch {batch_id}")
    db = SessionLocal()

    try:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            logger.error(f"Batch {batch_id} not found in database.")
            return {"status": "error", "message": f"Batch {batch_id} not found"}

        batch.status = BatchStatus.PROCESSING
        db.commit()

        # Step 1: Geocoding missing coordinates
        deliveries = db.query(Delivery).filter(Delivery.batch_id == batch_id).all()
        geocoded_count = sum(1 for d in deliveries if d.lat is not None and d.lng is not None)

        for delivery in deliveries:
            if delivery.lat is None or delivery.lng is None:
                delivery.geocoding_attempts += 1
                result = geocoding_service.geocode(
                    street=delivery.street,
                    number=delivery.number,
                    neighborhood=delivery.neighborhood,
                    city=delivery.city,
                    state=delivery.state,
                    postal_code=delivery.postal_code,
                    raw_text=delivery.raw_text,
                )
                if result:
                    lat, lng, enriched = result
                    delivery.lat = lat
                    delivery.lng = lng
                    delivery.geocoded = True
                    # Fill enriched fields if they were missing
                    if not delivery.street and enriched.get("street"):
                        delivery.street = enriched["street"]
                    if not delivery.neighborhood and enriched.get("neighborhood"):
                        delivery.neighborhood = enriched["neighborhood"]
                    if not delivery.city and enriched.get("city"):
                        delivery.city = enriched["city"]
                    if not delivery.state and enriched.get("state"):
                        delivery.state = enriched["state"]
                    if not delivery.postal_code and enriched.get("postal_code"):
                        delivery.postal_code = enriched["postal_code"]
                    geocoded_count += 1
                else:
                    delivery.notes = "Endereço não localizado automaticamente. Necessita verificação."

        batch.geocoded_items = geocoded_count
        db.commit()

        # Step 2: Route Optimization with Google OR-Tools TSP
        valid_deliveries = [d for d in deliveries if d.lat is not None and d.lng is not None]

        if not valid_deliveries:
            batch.status = BatchStatus.FAILED
            batch.error_message = "Nenhum endereço pôde ser geocodificado para roteirização."
            db.commit()
            return {"status": "failed", "message": batch.error_message}

        origin = (batch.origin_lat, batch.origin_lng)
        destinations = [(d.lat, d.lng) for d in valid_deliveries]

        tsp_result = RouteOptimizer.solve_tsp(
            origin=origin,
            destinations=destinations,
            return_to_origin=False,  # Open TSP for last-mile couriers
            time_limit_seconds=5,
        )

        ordered_indices = tsp_result["ordered_stop_indices"]

        # Step 3: Assign sequence numbers to deliveries
        ordered_delivery_ids = []
        for seq, dest_idx in enumerate(ordered_indices, start=1):
            delivery_item = valid_deliveries[dest_idx]
            delivery_item.sequence_order = seq
            ordered_delivery_ids.append(delivery_item.id)

        # Place unlocated deliveries at the end of the list
        unlocated_deliveries = [d for d in deliveries if d.lat is None or d.lng is None]
        next_seq = len(ordered_indices) + 1
        for unloc in unlocated_deliveries:
            unloc.sequence_order = next_seq
            next_seq += 1

        # Step 4: Create or update Route record
        existing_route = db.query(Route).filter(Route.batch_id == batch_id).first()
        if existing_route:
            existing_route.total_distance_km = tsp_result["total_distance_km"]
            existing_route.estimated_time_minutes = tsp_result["estimated_time_minutes"]
            existing_route.ordered_stop_ids = ordered_delivery_ids
        else:
            new_route = Route(
                batch_id=batch_id,
                total_distance_km=tsp_result["total_distance_km"],
                estimated_time_minutes=tsp_result["estimated_time_minutes"],
                ordered_stop_ids=ordered_delivery_ids,
            )
            db.add(new_route)

        batch.status = BatchStatus.OPTIMIZED
        batch.error_message = None
        db.commit()

        logger.info(
            f"Batch {batch_id} successfully optimized: {len(valid_deliveries)} stops, "
            f"{tsp_result['total_distance_km']} km, {tsp_result['estimated_time_minutes']} min"
        )

        return {
            "status": "success",
            "batch_id": batch_id,
            "total_stops": len(valid_deliveries),
            "total_distance_km": tsp_result["total_distance_km"],
            "estimated_time_minutes": tsp_result["estimated_time_minutes"],
        }

    except Exception as exc:
        logger.exception(f"Error processing Batch {batch_id}: {exc}")
        db.rollback()
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if batch:
            batch.status = BatchStatus.FAILED
            batch.error_message = f"Erro no processamento da rota: {str(exc)}"
            db.commit()
        raise exc
    finally:
        db.close()
