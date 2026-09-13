import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()

# In-memory user registry for demonstration and multi-device persistence
AUTH_USERS_REGISTRY: Dict[str, Dict[str, Any]] = {}


class SocialLoginRequest(BaseModel):
    provider: str = Field(..., description="Provedor: google, apple, whatsapp, email, web3")
    provider_id: str = Field(..., description="ID ou e-mail no provedor social")
    name: Optional[str] = Field(None, description="Nome do entregador")
    email: Optional[str] = Field(None, description="E-mail")
    phone: Optional[str] = Field(None, description="WhatsApp / Celular")
    avatar_url: Optional[str] = Field(None, description="URL do avatar")


class SocialLoginResponse(BaseModel):
    user_id: str
    did: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    provider: str
    session_token: str
    is_pro: bool
    pro_plan: Optional[str] = None
    created_at: str


@router.post(
    "/social-login",
    response_model=SocialLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Autenticar via login social estilo Privy",
)
def social_login(req: SocialLoginRequest):
    provider_key = f"{req.provider}:{req.provider_id.strip().lower()}"

    now = datetime.now(timezone.utc).isoformat()

    if provider_key in AUTH_USERS_REGISTRY:
        user = AUTH_USERS_REGISTRY[provider_key]
        # Update mutable fields if provided
        if req.name and req.name != user["name"]:
            user["name"] = req.name
        if req.avatar_url:
            user["avatar_url"] = req.avatar_url
    else:
        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        did = f"did:privy:{uuid.uuid4().hex[:16]}"
        user = {
            "user_id": user_id,
            "did": did,
            "name": req.name or req.email or req.phone or "Entregador",
            "email": req.email,
            "phone": req.phone,
            "avatar_url": req.avatar_url,
            "provider": req.provider,
            "session_token": f"sess_{uuid.uuid4().hex}",
            "is_pro": False,
            "pro_plan": None,
            "created_at": now,
        }
        AUTH_USERS_REGISTRY[provider_key] = user

    return SocialLoginResponse(**user)


@router.get(
    "/me",
    response_model=SocialLoginResponse,
    summary="Obter dados do usuário atual autenticado",
)
def get_current_user(session_token: str):
    for user in AUTH_USERS_REGISTRY.values():
        if user.get("session_token") == session_token:
            return SocialLoginResponse(**user)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão inválida ou expirada. Faça login novamente.",
    )
