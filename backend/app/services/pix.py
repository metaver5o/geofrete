import re
import unicodedata
from typing import Optional


def normalize_ascii(text: str, max_length: int) -> str:
    """Normalize text removing accents and non-ASCII chars for EMVCo standard."""
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_text = "".join([c for c in nfkd if not unicodedata.combining(c)])
    clean = re.sub(r"[^A-Za-z0-9 ]", "", ascii_text).strip().upper()
    return clean[:max_length]


def calculate_crc16_ccitt(payload: str) -> str:
    """Compute CRC16-CCITT checksum (polynomial 0x1021, init 0xFFFF)."""
    crc = 0xFFFF
    for char in payload.encode("utf-8"):
        crc ^= char << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def format_emv_field(field_id: str, value: str) -> str:
    """Format an EMVCo TLV (Tag-Length-Value) field."""
    length = len(value.encode("utf-8"))
    return f"{field_id}{length:02d}{value}"


def generate_pix_brcode(
    pix_key: str,
    amount: float,
    merchant_name: str = "GEOFRETE BRASIL",
    merchant_city: str = "CAMPO LARGO",
    tx_id: Optional[str] = None,
) -> str:
    """
    Generate standard Banco Central do Brasil BR Code (EMVCo) for Pix.
    Compatible with all Brazilian banking apps (Nubank, Itaú, Inter, Bradesco, etc.).
    """
    clean_name = normalize_ascii(merchant_name, 25) or "GEOFRETE BRASIL"
    clean_city = normalize_ascii(merchant_city, 15) or "CAMPO LARGO"
    clean_txid = normalize_ascii(tx_id or "***", 25) or "***"

    # Tag 26: Merchant Account Information
    tag26_gui = format_emv_field("00", "br.gov.bcb.pix")
    tag26_key = format_emv_field("01", pix_key.strip())
    merchant_account_info = format_emv_field("26", tag26_gui + tag26_key)

    # Tag 62: Additional Data Field Template (TxID)
    tag62_txid = format_emv_field("05", clean_txid)
    additional_data = format_emv_field("62", tag62_txid)

    # Format amount to 2 decimal places
    amount_str = f"{amount:.2f}"

    # Construct the payload without CRC
    payload = (
        format_emv_field("00", "01")  # Payload Format Indicator
        + format_emv_field("01", "12")  # Point of Initiation Method: 12 (Dynamic) or 11 (Static)
        + merchant_account_info
        + format_emv_field("52", "0000")  # Merchant Category Code
        + format_emv_field("53", "986")  # Transaction Currency (986 = BRL)
        + format_emv_field("54", amount_str)  # Transaction Amount
        + format_emv_field("58", "BR")  # Country Code
        + format_emv_field("59", clean_name)  # Merchant Name
        + format_emv_field("60", clean_city)  # Merchant City
        + additional_data
        + "6304"  # CRC16 ID (63) and Length (04)
    )

    # Compute CRC16 and append
    crc = calculate_crc16_ccitt(payload)
    return payload + crc
