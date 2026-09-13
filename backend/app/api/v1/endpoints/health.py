from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
import redis
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.database import get_db

router = APIRouter()
settings = get_settings()


@router.get("/health", summary="Health check for API, Database and Redis")
def health_check(db: Session = Depends(get_db)):
    """Verifies operational status of the service and backing infrastructure."""
    services = {
        "api": "healthy",
        "database": "unhealthy",
        "redis": "unhealthy",
    }
    status_code = status.HTTP_200_OK

    # Test Database
    try:
        db.execute(text("SELECT 1;"))
        services["database"] = "healthy"
    except Exception as e:
        services["database"] = f"unhealthy: {str(e)}"
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    # Test Redis
    try:
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        services["redis"] = "healthy"
    except Exception as e:
        services["redis"] = f"unhealthy: {str(e)}"
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "app": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "services": services,
        },
    )
