import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.database import init_db

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("girarota")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifespan events."""
    logger.info("Initializing GiraRota Database schema and extensions...")
    try:
        init_db()
        logger.info("Database schema initialized successfully.")
    except Exception as e:
        logger.warning(f"Database auto-initialization deferred: {e}")
    yield
    logger.info("Shutting down GiraRota backend service.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "API de Roteirização Inteligente de Última Milha (Last-Mile Delivery) "
        "para entregadores autônomos. Processa lotes de etiquetas escaneadas via OCR, "
        "executa geocodificação resiliente e resolve o problema do caixeiro viajante (TSP) com Google OR-Tools."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["General"])
def root():
    """Service status and quick links."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "health": f"{settings.API_V1_PREFIX}/health",
        "batches": f"{settings.API_V1_PREFIX}/batches",
    }
