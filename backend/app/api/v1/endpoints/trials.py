import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()

# In-memory trial registry for devices and phone numbers (can also be backed by DB)
USED_DEVICES_REGISTRY: Dict[str, Dict[str, Any]] = {}
USED_PHONES_REGISTRY: Dict[str, Dict[str, Any]] = {}


class TrialRegisterRequest(BaseModel):
    device_id: str = Field(..., description="Hash de hardware único do aparelho (Device Fingerprint)")
    phone: str = Field(..., description="Número de WhatsApp do entregador")
    name: str = Field(..., description="Nome completo")
    email: Optional[str] = Field(None, description="E-mail de contato")


class TrialRegisterResponse(BaseModel):
    success: bool
    plan: str = "trial"
    days_granted: int = 7
    expires_at: str
    message: str


class TrialCheckResponse(BaseModel):
    eligible: bool
    already_used: bool
    message: str


def clean_phone(phone: str) -> str:
    """Normalize phone number removing non-digits."""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("55") and len(digits) >= 12:
        return digits[2:]
    return digits


@router.post(
    "/register",
    response_model=TrialRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar e ativar teste de 7 dias grátis",
)
def register_trial(req: TrialRegisterRequest):
    device_clean = req.device_id.strip()
    phone_clean = clean_phone(req.phone)

    if not device_clean or len(device_clean) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identificador de dispositivo (Device ID) inválido.",
        )

    if not phone_clean or len(phone_clean) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Número de telefone/WhatsApp inválido.",
        )

    # 1. Anti-Fraud Device Check
    if device_clean in USED_DEVICES_REGISTRY:
        prev = USED_DEVICES_REGISTRY[device_clean]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Este aparelho já utilizou o período de 7 dias grátis "
                f"(cadastrado em {prev['registered_at'][:10]}). "
                f"Para continuar utilizando o GEOFRETE, assine o plano mensal."
            ),
        )

    # 2. Anti-Fraud Phone Check
    if phone_clean in USED_PHONES_REGISTRY:
        prev = USED_PHONES_REGISTRY[phone_clean]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"O número de WhatsApp {req.phone} já utilizou o período de 7 dias grátis. "
                f"Para continuar, assine o plano mensal."
            ),
        )

    # 3. Register Trial
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)

    record = {
        "device_id": device_clean,
        "phone": phone_clean,
        "name": req.name.strip(),
        "email": (req.email or "").strip(),
        "registered_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
    }

    USED_DEVICES_REGISTRY[device_clean] = record
    USED_PHONES_REGISTRY[phone_clean] = record

    return TrialRegisterResponse(
        success=True,
        plan="trial",
        days_granted=7,
        expires_at=expires_at.isoformat(),
        message="Período de 7 dias grátis ativado com sucesso! Aproveite o GEOFRETE PRO sem limites.",
    )


@router.get(
    "/check",
    response_model=TrialCheckResponse,
    summary="Verificar elegibilidade do aparelho e telefone",
)
def check_trial_eligibility(device_id: str, phone: Optional[str] = None):
    device_clean = device_id.strip()
    if device_clean in USED_DEVICES_REGISTRY:
        return TrialCheckResponse(
            eligible=False,
            already_used=True,
            message="Este aparelho já utilizou o período de teste gratuito.",
        )

    if phone:
        phone_clean = clean_phone(phone)
        if phone_clean in USED_PHONES_REGISTRY:
            return TrialCheckResponse(
                eligible=False,
                already_used=True,
                message="Este número de telefone já utilizou o período de teste gratuito.",
            )

    return TrialCheckResponse(
        eligible=True,
        already_used=False,
        message="Aparelho elegível para 7 dias grátis!",
    )
