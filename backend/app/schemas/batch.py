from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.models import BatchStatus
from app.schemas.delivery import DeliveryItemInput, DeliveryResponse
from app.schemas.route import OptimizedRouteResponse


class BatchUploadRequest(BaseModel):
    """Payload for uploading a batch of scanned labels from mobile OCR."""

    courier_id: Optional[str] = Field("courier_default", description="Identifier of the courier/driver")
    origin_address: Optional[str] = Field(None, description="Starting address / Depot / Current location")
    origin_lat: float = Field(..., description="Starting latitude of the courier")
    origin_lng: float = Field(..., description="Starting longitude of the courier")
    deliveries: List[DeliveryItemInput] = Field(
        ...,
        min_length=1,
        max_length=200,
        description="List of raw delivery labels to geocode and optimize",
    )


class BatchStatusResponse(BaseModel):
    """Status check response for batch processing polling."""

    batch_id: str
    status: BatchStatus
    total_items: int
    geocoded_items: int
    progress_percentage: float
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class BatchDetailResponse(BaseModel):
    """Detailed batch information including all delivery items and route if ready."""

    model_config = ConfigDict(from_attributes=True)

    batch_id: str
    courier_id: Optional[str]
    status: BatchStatus
    total_items: int
    geocoded_items: int
    origin_lat: float
    origin_lng: float
    origin_address: Optional[str]
    error_message: Optional[str] = None
    created_at: datetime
    deliveries: List[DeliveryResponse]
    route: Optional[OptimizedRouteResponse] = None
