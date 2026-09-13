from fastapi import APIRouter
from app.api.v1.endpoints import batches, health, billing, trials, auth

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(batches.router, prefix="/batches", tags=["Batches & Routing"])
api_router.include_router(billing.router, prefix="/billing", tags=["Billing & Payments"])
api_router.include_router(trials.router, prefix="/trials", tags=["Free Trials & Anti-Fraud"])
api_router.include_router(auth.router, prefix="/auth", tags=["Social Auth & User Identity"])
