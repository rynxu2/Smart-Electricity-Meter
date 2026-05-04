"""OCR service for reading electricity meter digits from images."""

from __future__ import annotations

import base64
import io
import re
import logging
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

logger = logging.getLogger(__name__)

# Lazy-load EasyOCR to avoid slow startup
_reader = None


def _get_reader(languages: list[str] = None):
    """Get or create EasyOCR reader (singleton)."""
    global _reader
    if _reader is None:
        import easyocr
        _reader = easyocr.Reader(languages or ["en"], gpu=False)
        logger.info("EasyOCR reader initialized")
    return _reader


def preprocess_image(image: Image.Image) -> Image.Image:
    """Preprocess meter image for better OCR accuracy.

    Pipeline: grayscale → contrast enhancement → sharpen → threshold.
    """
    # Convert to grayscale
    gray = image.convert("L")

    # Enhance contrast
    enhancer = ImageEnhance.Contrast(gray)
    enhanced = enhancer.enhance(2.0)

    # Sharpen edges
    sharpened = enhanced.filter(ImageFilter.SHARPEN)

    # Apply adaptive-like threshold using numpy
    img_array = np.array(sharpened)
    threshold = np.mean(img_array)
    binary = ((img_array > threshold) * 255).astype(np.uint8)

    return Image.fromarray(binary)


def extract_digits(image: Image.Image, languages: list[str] = None, confidence_threshold: float = 0.6) -> dict:
    """Extract numeric digits from a meter image using EasyOCR.

    Returns:
        Dict with 'value' (float or None), 'raw_text', 'confidence', 'all_results'.
    """
    reader = _get_reader(languages)

    # Preprocess
    processed = preprocess_image(image)
    img_array = np.array(processed)

    # Run OCR
    results = reader.readtext(img_array, allowlist="0123456789.", detail=1)

    if not results:
        return {"value": None, "raw_text": "", "confidence": 0.0, "all_results": []}

    # Collect all detected text fragments
    all_results = []
    for bbox, text, conf in results:
        all_results.append({"text": text, "confidence": round(conf, 3)})

    # Filter by confidence and concatenate digits
    high_conf = [r for r in results if r[2] >= confidence_threshold]
    if not high_conf:
        high_conf = results  # fallback to all results

    # Sort by x-position (left to right reading order)
    high_conf.sort(key=lambda r: r[0][0][0])

    raw_text = "".join(r[1] for r in high_conf)
    avg_confidence = sum(r[2] for r in high_conf) / len(high_conf)

    # Extract numeric value
    numeric_value = _parse_meter_value(raw_text)

    return {
        "value": numeric_value,
        "raw_text": raw_text,
        "confidence": round(avg_confidence, 3),
        "all_results": all_results,
    }


def decode_base64_image(base64_string: str) -> Image.Image:
    """Decode a base64-encoded image string to PIL Image."""
    # Remove data URI prefix if present
    if "," in base64_string:
        base64_string = base64_string.split(",", 1)[1]

    image_bytes = base64.b64decode(base64_string)
    return Image.open(io.BytesIO(image_bytes))


def _parse_meter_value(text: str) -> float | None:
    """Parse meter reading value from OCR text.

    Handles formats like: '12345', '12345.6', '012345.67'
    """
    # Remove non-numeric chars except dots
    cleaned = re.sub(r"[^\d.]", "", text)

    if not cleaned:
        return None

    # Handle multiple dots (keep only the last one)
    parts = cleaned.split(".")
    if len(parts) > 2:
        cleaned = "".join(parts[:-1]) + "." + parts[-1]

    try:
        value = float(cleaned)
        # Sanity check: meter readings are typically 0 - 999999
        if 0 <= value <= 999999:
            return round(value, 2)
        return None
    except ValueError:
        return None
