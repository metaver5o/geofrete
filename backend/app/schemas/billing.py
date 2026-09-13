from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class PlanType(str, Enum):
    DAILY = "daily"
    MONTHLY = "monthly"
    ANNUAL = "annual"


PLAN_PRICING = {
    PlanType.DAILY: 4.99,
    PlanType.MONTHLY: 49.99,
    PlanType.ANNUAL: 399.00,
}

PLAN_DAYS = {
    PlanType.DAILY: 1,
    PlanType.MONTHLY: 30,
    PlanType.ANNUAL: 365,
}


class PixCreateRequest(BaseModel):
    plan: PlanType = Field(default=PlanType.MONTHLY, description="Plano de assinatura")
    amount: Optional[float] = Field(default=None, description="Valor em Reais (opcional, padrão do plano)")
    pix_key: Optional[str] = Field(default="suporte@geofrete.com.br", description="Chave Pix do recebedor")
    merchant_name: Optional[str] = Field(default="GEOFRETE BRASIL", description="Nome do recebedor (máx 25 caracteres)")
    merchant_city: Optional[str] = Field(default="CAMPO LARGO", description="Cidade do recebedor (máx 15 caracteres)")
    tx_id: Optional[str] = Field(default=None, description="Identificador da transação (máx 25 caracteres)")


class PixCreateResponse(BaseModel):
    plan: str
    amount: float
    pix_payload: str
    tx_id: str
    expires_in_seconds: int = 900
    instructions: str


class CheckoutSessionRequest(BaseModel):
    plan: PlanType = Field(default=PlanType.MONTHLY, description="Plano de assinatura")
    customer_email: Optional[str] = Field(default=None, description="E-mail do entregador")
    gateway: Optional[str] = Field(default="mercadopago", description="Gateway de pagamento: mercadopago ou stripe")
    success_url: Optional[str] = Field(default="https://metaver5o.github.io/geofrete/?status=success", description="URL de retorno")


class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    session_id: str
    plan: str
    amount: float


class LicenseVerifyRequest(BaseModel):
    license_key: str = Field(..., description="Chave de ativação ou voucher")


class LicenseVerifyResponse(BaseModel):
    valid: bool
    plan: Optional[str] = None
    days: Optional[int] = None
    expires_at: Optional[str] = None
    message: str


class WebhookPayload(BaseModel):
    event: str
    data: Dict[str, Any] = Field(default_factory=dict)
