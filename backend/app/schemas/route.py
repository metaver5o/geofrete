from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RouteStopResponse(BaseModel):
    """An individual stop in the optimized delivery sequence."""

    sequence_order: int = Field(..., description="1-indexed sequence order (0 is starting depot/courier)")
    delivery_id: Optional[str] = Field(None, description="Delivery ID (null for starting origin)")
    is_origin: bool = Field(False, description="True if this is the start location")
    address: str = Field(..., description="Human readable destination address")
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    tracking_number: Optional[str] = None
    distance_from_previous_km: float = Field(0.0, description="Road distance from the prior stop in km")
    google_maps_url: str = Field(..., description="Direct link for turning navigation")
    waze_url: str = Field(..., description="Direct Waze deep-link")


class OptimizedRouteResponse(BaseModel):
    """Full optimized itinerary ready for delivery execution."""

    model_config = ConfigDict(from_attributes=True)

    route_id: str
    batch_id: str
    total_stops: int
    total_distance_km: float
    estimated_time_minutes: float
    origin_lat: float
    origin_lng: float
    stops: List[RouteStopResponse]
