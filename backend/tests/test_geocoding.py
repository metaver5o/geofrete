from unittest.mock import MagicMock, patch
from app.services.geocoding import GeocodingService


def test_clean_cep():
    """Verify CEP cleaning handles masks, spaces and invalid lengths."""
    assert GeocodingService.clean_cep("01310-100") == "01310100"
    assert GeocodingService.clean_cep("01310100") == "01310100"
    assert GeocodingService.clean_cep("  04538-133  ") == "04538133"
    assert GeocodingService.clean_cep("123") is None
    assert GeocodingService.clean_cep(None) is None


def test_extract_cep_from_text():
    """Verify regex extraction of CEP from OCR text snippets."""
    text1 = "Destinatário: João Silva, Rua das Flores 123, CEP: 01310-100, São Paulo SP"
    assert GeocodingService.extract_cep_from_text(text1) == "01310100"

    text2 = "Entregar para Maria - CEP 04538000 Sao Paulo"
    assert GeocodingService.extract_cep_from_text(text2) == "04538000"

    text3 = "Sem nenhum codigo postal aqui"
    assert GeocodingService.extract_cep_from_text(text3) is None


@patch("requests.Session.get")
def test_viacep_lookup_success(mock_get):
    """Test successful ViaCEP response parsing."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "cep": "01310-100",
        "logradouro": "Avenida Paulista",
        "bairro": "Bela Vista",
        "localidade": "São Paulo",
        "uf": "SP",
    }
    mock_get.return_value = mock_response

    service = GeocodingService()
    result = service.lookup_viacep("01310100")

    assert result is not None
    assert result["street"] == "Avenida Paulista"
    assert result["city"] == "São Paulo"
    assert result["state"] == "SP"


@patch("requests.Session.get")
def test_geocode_fallback_with_mock(mock_get):
    """Test full geocoding flow with mocked Nominatim."""
    # First call ViaCEP (if needed), second call Nominatim
    mock_viacep_resp = MagicMock()
    mock_viacep_resp.status_code = 200
    mock_viacep_resp.json.return_value = {
        "logradouro": "Avenida Paulista",
        "bairro": "Bela Vista",
        "localidade": "São Paulo",
        "uf": "SP",
    }

    mock_nominatim_resp = MagicMock()
    mock_nominatim_resp.status_code = 200
    mock_nominatim_resp.json.return_value = [
        {"lat": "-23.5614", "lon": "-46.6558"}
    ]

    mock_get.side_effect = [mock_viacep_resp, mock_nominatim_resp]

    service = GeocodingService()
    result = service.geocode(
        postal_code="01310-100",
        number="1000",
    )

    assert result is not None
    lat, lng, enriched = result
    assert lat == -23.5614
    assert lng == -46.6558
    assert enriched["street"] == "Avenida Paulista"
