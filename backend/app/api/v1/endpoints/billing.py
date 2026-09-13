import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, status
from app.schemas.billing import (
    PlanType,
    PLAN_PRICING,
    PLAN_DAYS,
    PixCreateRequest,
    PixCreateResponse,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    LicenseVerifyRequest,
    LicenseVerifyResponse,
    WebhookPayload,
)
from app.services.pix import generate_pix_brcode

logger = logging.getLogger("geofrete.billing")
router = APIRouter()

# Authoritative list of VIP / promotional license keys
RECOGNIZED_LICENSES: Dict[str, Dict[str, Any]] = {
    "GEOFRETE-PRO-VIP": {"plan": "monthly", "days": 365, "active": True},
    "GEOFRETE-PRO-2026": {"plan": "monthly", "days": 90, "active": True},
    "MOTOBOY-CAMPO-LARGO": {"plan": "monthly", "days": 60, "active": True},
    "ENTREGADOR-PRO": {"plan": "monthly", "days": 30, "active": True},
}


@router.post(
    "/pix",
    response_model=PixCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Gerar Pix Copia e Cola / BR Code EMVCo",
    description="Gera payload Pix padrão Banco Central do Brasil para pagamento instantâneo.",
)
def create_pix_payment(req: PixCreateRequest):
    amount = req.amount if req.amount is not None else PLAN_PRICING.get(req.plan, 49.99)
    tx_id = req.tx_id or f"GEO{uuid.uuid4().hex[:12].upper()}"

    try:
        pix_payload = generate_pix_brcode(
            pix_key=req.pix_key,
            amount=amount,
            merchant_name=req.merchant_name,
            merchant_city=req.merchant_city,
            tx_id=tx_id,
        )
    except Exception as e:
        logger.error(f"Failed to generate Pix BR Code: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao gerar payload Pix: {str(e)}",
        )

    return PixCreateResponse(
        plan=req.plan.value,
        amount=amount,
        pix_payload=pix_payload,
        tx_id=tx_id,
        expires_in_seconds=900,
        instructions="Abra o app do seu banco, escolha 'Pagar com Pix' > 'Pix Copia e Cola', cole o código e confirme.",
    )


@router.post(
    "/checkout/session",
    response_model=CheckoutSessionResponse,
    summary="Criar sessão de checkout (Mercado Pago / Stripe)",
)
def create_checkout_session(req: CheckoutSessionRequest):
    amount = PLAN_PRICING.get(req.plan, 49.99)
    session_id = f"cs_{uuid.uuid4().hex[:16]}"

    # Fallback to configured or direct checkout url
    if req.gateway == "stripe":
        checkout_url = f"https://buy.stripe.com/test_geofrete_{req.plan.value}?client_reference_id={session_id}"
    else:
        checkout_url = f"https://www.mercadopago.com.br/checkout/v1/redirect?pref_id={session_id}"

    return CheckoutSessionResponse(
        checkout_url=checkout_url,
        session_id=session_id,
        plan=req.plan.value,
        amount=amount,
    )


@router.post(
    "/verify-license",
    response_model=LicenseVerifyResponse,
    summary="Validar chave de licença ou voucher",
)
def verify_license(req: LicenseVerifyRequest):
    key_clean = req.license_key.strip().upper()

    if key_clean in RECOGNIZED_LICENSES:
        lic = RECOGNIZED_LICENSES[key_clean]
        days = lic["days"]
        expiry = datetime.now(timezone.utc) + timedelta(days=days)
        return LicenseVerifyResponse(
            valid=True,
            plan=lic["plan"],
            days=days,
            expires_at=expiry.isoformat(),
            message=f"Licença {key_clean} ativada com sucesso! Válida por {days} dias.",
        )

    # Dynamic prefix validation (e.g. GFPRO-...)
    if key_clean.startswith("GFPRO-") and len(key_clean) >= 12:
        expiry = datetime.now(timezone.utc) + timedelta(days=30)
        return LicenseVerifyResponse(
            valid=True,
            plan="monthly",
            days=30,
            expires_at=expiry.isoformat(),
            message="Chave promocional ativada com sucesso! 30 dias de GEOFRETE PRO liberados.",
        )

    return LicenseVerifyResponse(
        valid=False,
        message="Chave de licença inválida ou expirada. Verifique o código digitado.",
    )


@router.post(
    "/webhook",
    summary="Receber confirmação assíncrona de pagamento (Webhook)",
)
def handle_payment_webhook(payload: WebhookPayload):
    logger.info(f"Received billing webhook: event={payload.event} data={payload.data}")
    return {"status": "received", "event": payload.event}
