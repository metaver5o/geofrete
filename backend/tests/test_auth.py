import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_social_login_google():
    """Test Google Social login creates user and did."""
    response = client.post(
        "/api/v1/auth/social-login",
        json={
            "provider": "google",
            "provider_id": "google-user-123456",
            "name": "Carlos Motoboy",
            "email": "carlos.motoboy@gmail.com",
            "avatar_url": "https://lh3.googleusercontent.com/sample.jpg",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Carlos Motoboy"
    assert data["email"] == "carlos.motoboy@gmail.com"
    assert data["provider"] == "google"
    assert data["did"].startswith("did:privy:")
    assert "session_token" in data


def test_social_login_whatsapp():
    """Test WhatsApp / Phone social login."""
    response = client.post(
        "/api/v1/auth/social-login",
        json={
            "provider": "whatsapp",
            "provider_id": "5541999998888",
            "name": "Marcos Entregador",
            "phone": "(41) 99999-8888",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Marcos Entregador"
    assert data["phone"] == "(41) 99999-8888"
    assert data["did"].startswith("did:privy:")


def test_get_current_user_me():
    """Test retrieving user profile via session token."""
    login_resp = client.post(
        "/api/v1/auth/social-login",
        json={
            "provider": "apple",
            "provider_id": "apple-user-789",
            "name": "Ana Entregas",
            "email": "ana@privaterelay.appleid.com",
        },
    )
    token = login_resp.json()["session_token"]

    me_resp = client.get(f"/api/v1/auth/me?session_token={token}")
    assert me_resp.status_code == 200
    assert me_resp.json()["name"] == "Ana Entregas"
