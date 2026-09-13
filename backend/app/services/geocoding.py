import json
import logging
import re
import time
from typing import Dict, Optional, Tuple
import redis
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GeocodingService:
    """Resilient geocoding service tailored for Brazilian addresses.

    Features:
    - In-memory & Redis caching
    - CEP normalization and ViaCEP lookup for address completion
    - OpenStreetMap Nominatim forward geocoding with structured fallbacks
    - Exponential backoff and retry handling
    - Graceful non-blocking failure for unlocatable items
    """

    def __init__(self):
        self._memory_cache: Dict[str, Tuple[float, float]] = {}
        self._redis_client: Optional[redis.Redis] = None
        self._init_redis()

        # Session with built-in connection retries
        self.session = requests.Session()
        retry_strategy = Retry(
            total=settings.GEOCODING_MAX_RETRIES,
            backoff_factor=1.0,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        self.session.headers.update(
            {
                "User-Agent": settings.GEOCODING_USER_AGENT,
                "Accept": "application/json",
            }
        )

    def _init_redis(self) -> None:
        try:
            self._redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
            )
            self._redis_client.ping()
        except Exception as e:
            logger.warning(f"Redis cache unavailable for GeocodingService ({e}). Using in-memory fallback.")
            self._redis_client = None

    @staticmethod
    def clean_cep(cep_str: Optional[str]) -> Optional[str]:
        """Extract standard 8-digit Brazilian CEP."""
        if not cep_str:
            return None
        digits = re.sub(r"\D", "", cep_str)
        if len(digits) == 8:
            return digits
        return None

    @staticmethod
    def extract_cep_from_text(raw_text: Optional[str]) -> Optional[str]:
        """Find CEP pattern in unstructured OCR text."""
        if not raw_text:
            return None
        match = re.search(r"\b\d{5}-?\d{3}\b", raw_text)
        if match:
            return re.sub(r"\D", "", match.group(0))
        return None

    def _get_from_cache(self, key: str) -> Optional[Tuple[float, float]]:
        cache_key = f"geocode:{key}"
        if self._redis_client:
            try:
                val = self._redis_client.get(cache_key)
                if val:
                    data = json.loads(val)
                    return float(data["lat"]), float(data["lng"])
            except Exception as err:
                logger.debug(f"Redis get error: {err}")

        return self._memory_cache.get(key)

    def _save_to_cache(self, key: str, lat: float, lng: float) -> None:
        cache_key = f"geocode:{key}"
        self._memory_cache[key] = (lat, lng)
        if self._redis_client:
            try:
                self._redis_client.setex(
                    cache_key,
                    86400 * 7,  # Cache for 7 days
                    json.dumps({"lat": lat, "lng": lng}),
                )
            except Exception as err:
                logger.debug(f"Redis set error: {err}")

    def lookup_viacep(self, cep: str) -> Optional[Dict[str, str]]:
        """Query ViaCEP for address metadata given an 8-digit CEP."""
        cleaned = self.clean_cep(cep)
        if not cleaned:
            return None

        url = f"https://viacep.com.br/ws/{cleaned}/json/"
        try:
            response = self.session.get(url, timeout=settings.GEOCODING_TIMEOUT_SECONDS)
            if response.status_code == 200:
                data = response.json()
                if "erro" not in data:
                    return {
                        "street": data.get("logradouro", ""),
                        "neighborhood": data.get("bairro", ""),
                        "city": data.get("localidade", ""),
                        "state": data.get("uf", ""),
                        "postal_code": cleaned,
                    }
        except Exception as e:
            logger.warning(f"ViaCEP request failed for CEP {cleaned}: {e}")
        return None

    def query_nominatim(self, query: str) -> Optional[Tuple[float, float]]:
        """Query OpenStreetMap Nominatim with rate-limit compliance."""
        cached = self._get_from_cache(query)
        if cached:
            return cached

        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": query,
            "format": "json",
            "limit": 1,
            "countrycodes": "br",
        }

        try:
            # Respect OSM 1s usage policy lightly
            time.sleep(0.3)
            response = self.session.get(
                url,
                params=params,
                timeout=settings.GEOCODING_TIMEOUT_SECONDS,
            )
            if response.status_code == 200:
                results = response.json()
                if results and len(results) > 0:
                    lat = float(results[0]["lat"])
                    lng = float(results[0]["lon"])
                    self._save_to_cache(query, lat, lng)
                    return (lat, lng)
        except Exception as e:
            logger.warning(f"Nominatim query failed for '{query}': {e}")

        return None

    def geocode(
        self,
        street: Optional[str] = None,
        number: Optional[str] = None,
        neighborhood: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        postal_code: Optional[str] = None,
        raw_text: Optional[str] = None,
    ) -> Optional[Tuple[float, float, Dict[str, str]]]:
        """Resiliently geocode an address returning (lat, lng, normalized_address_dict)."""
        enriched_info: Dict[str, str] = {
            "street": street or "",
            "number": number or "",
            "neighborhood": neighborhood or "",
            "city": city or "",
            "state": state or "",
            "postal_code": postal_code or "",
        }

        # Step 1: Detect or complete CEP
        cep = self.clean_cep(postal_code) or self.extract_cep_from_text(raw_text)
        if cep:
            enriched_info["postal_code"] = cep
            if not enriched_info["city"] or not enriched_info["street"]:
                via_cep_data = self.lookup_viacep(cep)
                if via_cep_data:
                    if not enriched_info["street"]:
                        enriched_info["street"] = via_cep_data.get("street", "")
                    if not enriched_info["neighborhood"]:
                        enriched_info["neighborhood"] = via_cep_data.get("neighborhood", "")
                    if not enriched_info["city"]:
                        enriched_info["city"] = via_cep_data.get("city", "")
                    if not enriched_info["state"]:
                        enriched_info["state"] = via_cep_data.get("state", "")

        # Step 2: Formulate tiered search queries
        queries_to_try = []

        # Attempt A: Full specific address (street + number + neighborhood + city + state)
        if enriched_info["street"] and enriched_info["city"]:
            num_part = f", {enriched_info['number']}" if enriched_info["number"] else ""
            bairro_part = f", {enriched_info['neighborhood']}" if enriched_info["neighborhood"] else ""
            queries_to_try.append(
                f"{enriched_info['street']}{num_part}{bairro_part}, {enriched_info['city']}, {enriched_info['state']}, Brasil"
            )

        # Attempt B: Street + City + State (without number if exact number not mapped)
        if enriched_info["street"] and enriched_info["city"] and enriched_info["number"]:
            queries_to_try.append(
                f"{enriched_info['street']}, {enriched_info['city']}, {enriched_info['state']}, Brasil"
            )

        # Attempt C: CEP query
        if enriched_info["postal_code"]:
            queries_to_try.append(f"{enriched_info['postal_code']}, Brasil")

        # Attempt D: Raw OCR text snippet fallback
        if raw_text and len(raw_text.strip()) > 5:
            # Clean newlines and special characters
            cleaned_text = re.sub(r"\s+", " ", raw_text).strip()[:100]
            queries_to_try.append(f"{cleaned_text}, Brasil")

        # Execute queries in order of precision
        for query in queries_to_try:
            coords = self.query_nominatim(query)
            if coords:
                logger.info(f"Successfully geocoded query '{query}' -> {coords}")
                return coords[0], coords[1], enriched_info

        logger.warning(f"Failed to geocode address: {enriched_info}")
        return None


# Global singleton instance
geocoding_service = GeocodingService()
