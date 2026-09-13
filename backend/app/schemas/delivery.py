from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class DeliveryItemInput(BaseModel):
    """Raw delivery item extracted from mobile OCR or manual input."""

    tracking_number: Optional[str] = Field(None, description="Tracking code (e.g., BR123456789)")
    recipient_name: Optional[str] = Field(None, description="Name of the package recipient")
    recipient_phone: Optional[str] = Field(None, description="Contact phone number")
    raw_text: Optional[str] = Field(None, description="Full unparsed OCR text")

    # Brazilian address components
    street: Optional[str] = Field(None, description="Street name / Logradouro")
    number: Optional[str] = Field(None, description="Building / House number")
    complement: Optional[str] = Field(None, description="Apartment, suite, block, etc.")
    neighborhood: Optional[str] = Field(None, description="Bairro")
    city: Optional[str] = Field(None, description="Município")
    state: Optional[str] = Field(None, description="UF (ex: SP, RJ, MG)")
    postal_code: Optional[str] = Field(None, description="CEP (ex: 01310-100 ou 01310100)")

    # Pre-geocoded coordinates if provided by client mobile device
    lat: Optional[float] = Field(None, description="Latitude if already known")
    lng: Optional[float] = Field(None, description="Longitude if already known")


class DeliveryResponse(BaseModel):
    """Delivery item representation with geocoded data and routing sequence."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    batch_id: str
    tracking_number: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    raw_text: Optional[str] = None

    street: Optional[str] = None
    number: Optional[str] = None
    complement: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None

    lat: Optional[float] = None
    lng: Optional[float] = None
    geocoded: bool
    sequence_order: Optional[int] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
