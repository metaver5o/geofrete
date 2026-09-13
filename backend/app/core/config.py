from functools import lru_cache
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    PROJECT_NAME: str = "GiraRota - Roteirizador Inteligente Last-Mile"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database Settings
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/delivery_optimizer",
        description="SQLAlchemy PostgreSQL/PostGIS connection URL",
    )

    # Redis & Queue Settings
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL for Celery broker and cache",
    )

    # Security
    SECRET_KEY: str = Field(
        default="geofrete_development_secret_key_change_in_production",
        description="Cryptographic secret key for signing tokens",
    )

    # Geocoding Configurations
    GEOCODING_TIMEOUT_SECONDS: int = 5
    GEOCODING_MAX_RETRIES: int = 3
    GEOCODING_USER_AGENT: str = "GiraRota-LastMileDelivery/1.0"

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
