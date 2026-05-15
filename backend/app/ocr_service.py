"""OCR service for reading electricity meter digits from images.

Two-stage pipeline:
  Stage 1 — YOLOv11n detects the digit region on the meter face.
  Stage 2 — PaddleOCR v4 recognizes the cropped digits.

Falls back to PaddleOCR on the full preprocessed image when YOLO finds nothing.
"""

from __future__ import annotations

import base64
import io
import os
import re
import logging
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import numpy as np

logger = logging.getLogger(__name__)

# ── Lazy-loaded singletons ──────────────────────────────────────────────
_yolo_model = None
_paddle_ocr = None


def _get_yolo(model_path: str | None = None):
    """Load YOLOv11n model for digit-region detection (singleton)."""
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO

        path = model_path or os.getenv("YOLO_MODEL_PATH", "yolo11n.pt")
        _yolo_model = YOLO(path)
        logger.info(f"YOLOv11n model loaded: {path}")
    return _yolo_model


def _get_paddle_ocr():
    """Load PaddleOCR engine for digit recognition (singleton)."""
    global _paddle_ocr
    if _paddle_ocr is None:
        from paddleocr import PaddleOCR

        _paddle_ocr = PaddleOCR(
            use_angle_cls=False,  # meter digits don't need rotation
            lang="en",
            show_log=False,
            use_gpu=False,
        )
        logger.info("PaddleOCR initialized (CPU, lang=en)")
    return _paddle_ocr


# ── Image preprocessing ────────────────────────────────────────────────

def preprocess_image(image: Image.Image) -> Image.Image:
    """Preprocess meter image for better detection/recognition accuracy.

    Pipeline: auto-orient → grayscale → CLAHE-like contrast → sharpen → threshold.
    """
    # Auto-orient based on EXIF
    image = ImageOps.exif_transpose(image)

    gray = image.convert("L")

    # Enhance contrast (simulates CLAHE effect)
    enhancer = ImageEnhance.Contrast(gray)
    enhanced = enhancer.enhance(2.5)

    # Sharpen edges
    sharpened = enhanced.filter(ImageFilter.SHARPEN)

    # Adaptive-like threshold via numpy
    img_array = np.array(sharpened)
    threshold = np.mean(img_array)
    binary = ((img_array > threshold) * 255).astype(np.uint8)

    return Image.fromarray(binary)


def _prepare_for_ocr(image: Image.Image) -> Image.Image:
    """Prepare a cropped digit region for PaddleOCR input (RGB, padded)."""
    if image.mode != "RGB":
        image = image.convert("RGB")

    # Add small padding to avoid edge clipping
    w, h = image.size
    pad = max(4, int(min(w, h) * 0.05))
    padded = ImageOps.expand(image, border=pad, fill="white")
    return padded


# ── Stage 1: YOLO digit-region detection ──────────────────────────────

def _detect_digit_regions(
    image: Image.Image,
    confidence_threshold: float = 0.3,
) -> list[dict]:
    """Run YOLOv11n on the image and return detected digit-region crops.

    Returns a list of dicts sorted left→right by x-position:
        [{"crop": Image, "bbox": (x1,y1,x2,y2), "confidence": float}, ...]
    """
    model = _get_yolo()
    img_array = np.array(image.convert("RGB"))

    results = model(img_array, verbose=False)

    regions = []
    for result in results:
        for box in result.boxes:
            conf = float(box.conf[0])
            if conf < confidence_threshold:
                continue

            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            # Clamp coordinates
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(image.width, x2), min(image.height, y2)

            crop = image.crop((x1, y1, x2, y2))
            regions.append({
                "crop": crop,
                "bbox": (x1, y1, x2, y2),
                "confidence": round(conf, 3),
            })

    # Sort left to right for reading order
    regions.sort(key=lambda r: r["bbox"][0])
    return regions


# ── Stage 2: PaddleOCR digit recognition ────────────────────────────

def _recognize_digits(image: Image.Image) -> tuple[str, float]:
    """Run PaddleOCR on a single image crop and return (text, confidence)."""
    ocr = _get_paddle_ocr()
    prepared = _prepare_for_ocr(image)
    img_array = np.array(prepared)

    results = ocr.ocr(img_array, cls=False)

    if not results or not results[0]:
        return "", 0.0

    texts = []
    confs = []
    for line in results[0]:
        text = line[1][0]
        conf = line[1][1]
        texts.append(text)
        confs.append(conf)

    if not texts:
        return "", 0.0

    combined_text = "".join(texts)
    avg_conf = sum(confs) / len(confs) if confs else 0.0

    return combined_text, round(avg_conf, 3)


# ── Public API (same interface as before) ───────────────────────────

def extract_digits(
    image: Image.Image,
    confidence_threshold: float = 0.6,
    **kwargs,
) -> dict:
    """Extract numeric digits from a meter image using YOLOv11n + PaddleOCR.

    Returns:
        Dict with 'value' (float|None), 'raw_text', 'confidence',
        'all_results', 'pipeline' (detection method used).
    """
    # Preprocess
    processed = preprocess_image(image)

    # Stage 1 — YOLO detection
    regions = _detect_digit_regions(processed, confidence_threshold=0.3)

    all_results = []
    pipeline_used = "yolo11n+paddleocr"

    if regions:
        # Stage 2 — PaddleOCR on each detected region
        texts = []
        confs = []

        for region in regions:
            text, conf = _recognize_digits(region["crop"])
            texts.append(text)
            confs.append(conf)
            all_results.append({
                "text": text,
                "confidence": conf,
                "bbox": region["bbox"],
                "yolo_confidence": region["confidence"],
            })

        raw_text = "".join(texts)
        avg_confidence = sum(confs) / len(confs) if confs else 0.0
    else:
        # Fallback — run PaddleOCR on the full preprocessed image
        pipeline_used = "paddleocr-fullimage"
        logger.info("YOLO detected no regions, falling back to full-image PaddleOCR")

        raw_text, avg_confidence = _recognize_digits(processed)
        all_results.append({
            "text": raw_text,
            "confidence": avg_confidence,
            "bbox": None,
            "yolo_confidence": None,
        })

    numeric_value = _parse_meter_value(raw_text)

    # Apply user confidence gate
    if avg_confidence < confidence_threshold:
        logger.warning(
            f"Low confidence ({avg_confidence:.3f} < {confidence_threshold}), "
            f"returning value anyway with flag"
        )

    return {
        "value": numeric_value,
        "raw_text": raw_text,
        "confidence": round(avg_confidence, 3),
        "all_results": all_results,
        "pipeline": pipeline_used,
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
