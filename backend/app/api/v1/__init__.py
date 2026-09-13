from fastapi import APIRouter
from app.api.v1.endpoints import batches, health

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(batches.router, prefix="/batches", tags=["Batches & Routing"])
