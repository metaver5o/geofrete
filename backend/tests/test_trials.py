import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_register_trial_success():
    """Test successful 7-day trial registration."""
    response = client.post(
        "/api/v1/trials/register",
        json={
            "device_id": "DEVICE-UNIQUE-TEST-001",
            "phone": "(41) 99888-7766",
            "name": "Entregador Teste 1",
            "email": "entregador1@teste.com",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["days_granted"] == 7
    assert data["plan"] == "trial"


def test_register_trial_duplicate_device_blocked():
    """Test that registering again from the same device is blocked (Anti-Fraud)."""
    # Attempt second registration with different email/name but SAME device_id
    response = client.post(
        "/api/v1/trials/register",
        json={
            "device_id": "DEVICE-UNIQUE-TEST-001",
            "phone": "(41) 98765-4321",
            "name": "Entregador Tentando Fraude",
            "email": "fraude@teste.com",
        },
    )
    assert response.status_code == 403
    data = response.json()
    assert "aparelho já utilizou" in data["detail"].lower()


def test_register_trial_duplicate_phone_blocked():
    """Test that registering again with the same phone number is blocked."""
    # Attempt registration with different device but SAME phone
    response = client.post(
        "/api/v1/trials/register",
        json={
            "device_id": "DEVICE-UNIQUE-TEST-002",
            "phone": "(41) 99888-7766",
            "name": "Outro Nome",
            "email": "outro@teste.com",
        },
    )
    assert response.status_code == 403
    data = response.json()
    assert "já utilizou" in data["detail"].lower()


def test_check_trial_eligibility():
    """Test eligibility check endpoint."""
    # Already used device
    resp1 = client.get("/api/v1/trials/check?device_id=DEVICE-UNIQUE-TEST-001")
    assert resp1.status_code == 200
    assert resp1.json()["eligible"] is False

    # Fresh device
    resp2 = client.get("/api/v1/trials/check?device_id=DEVICE-FRESH-NEW-999")
    assert resp2.status_code == 200
    assert resp2.json()["eligible"] is True
