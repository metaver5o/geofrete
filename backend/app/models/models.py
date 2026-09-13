import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    DateTime,
    ForeignKey,
    Text,
    Boolean,
    JSON,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class BatchStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    OPTIMIZED = "OPTIMIZED"
    FAILED = "FAILED"


class DeliveryStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    ATTEMPTED = "ATTEMPTED"
    FAILED = "FAILED"


def get_utc_now():
    return datetime.now(timezone.utc)


class Batch(Base):
    __tablename__ = "batches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    courier_id = Column(String(64), nullable=True, index=True)
    status = Column(
        SAEnum(BatchStatus),
        default=BatchStatus.PENDING,
        nullable=False,
        index=True,
    )
    total_items = Column(Integer, default=0, nullable=False)
    geocoded_items = Column(Integer, default=0, nullable=False)
    origin_address = Column(String(255), nullable=True)
    origin_lat = Column(Float, nullable=False)
    origin_lng = Column(Float, nullable=False)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=get_utc_now,
        onupdate=get_utc_now,
        nullable=False,
    )

    deliveries = relationship(
        "Delivery",
        back_populates="batch",
        cascade="all, delete-orphan",
        order_by="Delivery.sequence_order",
    )
    route = relationship(
        "Route",
        back_populates="batch",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    batch_id = Column(
        String(36),
        ForeignKey("batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tracking_number = Column(String(100), nullable=True, index=True)
    recipient_name = Column(String(255), nullable=True)
    recipient_phone = Column(String(50), nullable=True)
    raw_text = Column(Text, nullable=True)

    # Address components (Brazilian postal format standard)
    street = Column(String(255), nullable=True)
    number = Column(String(50), nullable=True)
    complement = Column(String(100), nullable=True)
    neighborhood = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(10), nullable=True)
    postal_code = Column(String(20), nullable=True, index=True)  # CEP

    # Geocoding fields
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    geocoded = Column(Boolean, default=False, nullable=False)
    geocoding_attempts = Column(Integer, default=0, nullable=False)

    # Routing
    sequence_order = Column(Integer, nullable=True, index=True)
    status = Column(
        SAEnum(DeliveryStatus),
        default=DeliveryStatus.PENDING,
        nullable=False,
        index=True,
    )
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    batch = relationship("Batch", back_populates="deliveries")


class Route(Base):
    __tablename__ = "routes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    batch_id = Column(
        String(36),
        ForeignKey("batches.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    total_distance_km = Column(Float, default=0.0, nullable=False)
    estimated_time_minutes = Column(Float, default=0.0, nullable=False)
    ordered_stop_ids = Column(JSON, nullable=False, default=list)

    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    batch = relationship("Batch", back_populates="route")
