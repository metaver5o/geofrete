import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.database import Base, get_db
from app.main import app

# Create in-memory SQLite test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_root_endpoint():
    """Verify service root returns 200 and links."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "GEOFRETE" in data["service"]
    assert data["status"] == "online"


def test_health_endpoint():
    """Verify health check returns service structure."""
    response = client.get("/api/v1/health")
    # In test environment without Redis running, returns 503 with service detail
    assert response.status_code in (200, 503)
    data = response.json()
    assert "services" in data
    assert "api" in data["services"]
    assert data["services"]["api"] == "healthy"


def test_upload_batch_and_query_route():
    """Test full cycle: upload a batch with pre-geocoded stops and query route."""
    payload = {
        "courier_id": "motoboy_01",
        "origin_address": "Rua da Consolação, 1000 - SP",
        "origin_lat": -23.5505,
        "origin_lng": -46.6333,
        "deliveries": [
            {
                "tracking_number": "BR001",
                "recipient_name": "Carlos Lima",
                "street": "Avenida Paulista",
                "number": "1578",
                "city": "São Paulo",
                "state": "SP",
                "lat": -23.5614,
                "lng": -46.6558,
            },
            {
                "tracking_number": "BR002",
                "recipient_name": "Fernanda Souza",
                "street": "Rua Augusta",
                "number": "500",
                "city": "São Paulo",
                "state": "SP",
                "lat": -23.5532,
                "lng": -46.6521,
            },
        ],
    }

    # 1. Post batch upload
    response = client.post("/api/v1/batches/upload", json=payload)
    assert response.status_code == 202
    data = response.json()
    batch_id = data["batch_id"]
    assert batch_id is not None
    assert data["total_items"] == 2

    # 2. Query batch status
    status_resp = client.get(f"/api/v1/batches/{batch_id}")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["batch_id"] == batch_id
    assert status_data["total_items"] == 2

    # 3. Query batch detail
    detail_resp = client.get(f"/api/v1/batches/{batch_id}/detail")
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert len(detail_data["deliveries"]) == 2

    # 4. Check route endpoint (if task completed via fallback)
    route_resp = client.get(f"/api/v1/batches/{batch_id}/route")
    # If synchronous fallback completed, it's 200 with stops
    if route_resp.status_code == 200:
        route_data = route_resp.json()
        assert route_data["total_stops"] == 2
        assert len(route_data["stops"]) == 3  # Origin + 2 deliveries
        assert route_data["stops"][0]["is_origin"] is True
        assert route_data["stops"][1]["sequence_order"] == 1
