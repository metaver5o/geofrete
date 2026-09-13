import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.pix import generate_pix_brcode, calculate_crc16_ccitt

client = TestClient(app)


def test_pix_brcode_structure():
    """Verify that generated Pix string satisfies standard EMVCo format."""
    code = generate_pix_brcode(
        pix_key="suporte@geofrete.com.br",
        amount=49.99,
        merchant_name="GEOFRETE BRASIL",
        merchant_city="CAMPO LARGO",
        tx_id="TESTE123",
    )
    assert code.startswith("000201")
    assert "br.gov.bcb.pix" in code
    assert "suporte@geofrete.com.br" in code
    assert "540549.99" in code
    assert "5802BR" in code
    assert "5915GEOFRETE BRASIL" in code
    assert "6011CAMPO LARGO" in code
    assert "6304" in code
    # Last 4 characters must be the CRC16 hex
    payload_no_crc = code[:-4]
    expected_crc = calculate_crc16_ccitt(payload_no_crc)
    assert code.endswith(expected_crc)


def test_api_create_pix():
    """Test POST /api/v1/billing/pix endpoint."""
    response = client.post(
        "/api/v1/billing/pix",
        json={
            "plan": "monthly",
            "amount": 49.99,
            "pix_key": "financeiro@geofrete.com",
            "merchant_name": "GEOFRETE",
            "merchant_city": "CAMPO LARGO",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["plan"] == "monthly"
    assert data["amount"] == 49.99
    assert data["pix_payload"].startswith("000201")
    assert data["tx_id"].startswith("GEO")
    assert data["expires_in_seconds"] == 900


def test_api_checkout_session():
    """Test POST /api/v1/billing/checkout/session endpoint."""
    response = client.post(
        "/api/v1/billing/checkout/session",
        json={"plan": "monthly", "gateway": "mercadopago"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "checkout_url" in data
    assert "mercadopago" in data["checkout_url"]
    assert data["amount"] == 49.99


def test_api_verify_license_valid():
    """Test valid license verification."""
    response = client.post(
        "/api/v1/billing/verify-license",
        json={"license_key": "GEOFRETE-PRO-VIP"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["days"] == 365
    assert data["plan"] == "monthly"
    assert "sucesso" in data["message"].lower()


def test_api_verify_license_dynamic_prefix():
    """Test dynamic prefix voucher verification."""
    response = client.post(
        "/api/v1/billing/verify-license",
        json={"license_key": "GFPRO-PROMO-2026"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["days"] == 30


def test_api_verify_license_invalid():
    """Test invalid license verification."""
    response = client.post(
        "/api/v1/billing/verify-license",
        json={"license_key": "INVALID-KEY-XYZ"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert "inválida" in data["message"].lower()


def test_api_webhook():
    """Test POST /api/v1/billing/webhook endpoint."""
    response = client.post(
        "/api/v1/billing/webhook",
        json={"event": "payment.created", "data": {"id": "12345"}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "received"
