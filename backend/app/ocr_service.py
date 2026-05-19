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

        path = model_path or os.getenv("YOLO_MODEL_PATH", "meter_yolo11s_best.pt")

        # Resolve relative paths against backend/ directory
        if not os.path.isabs(path) and not os.path.exists(path):
            backend_dir = Path(__file__).resolve().parent.parent
            resolved = backend_dir / path
            if resolved.exists():
                path = str(resolved)

        logger.info(f"Loading YOLO model from: {path}")
        _yolo_model = YOLO(path)
        logger.info(f"YOLO model loaded: {path}")
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

def _auto_orient(image: Image.Image) -> Image.Image:
    """Auto-orient based on EXIF and convert to RGB."""
    image = ImageOps.exif_transpose(image)
    return image.convert("RGB")


def _preprocess_crop_for_ocr(crop: Image.Image) -> Image.Image:
    """Preprocess a YOLO-cropped digit region for PaddleOCR accuracy.

    Gentle pipeline that preserves digit shape:
      1. Upscale small crops so OCR has enough pixels to work with
      2. Convert to grayscale for cleaner recognition
      3. Moderate contrast enhancement (not aggressive binary)
      4. Sharpen edges
      5. Pad to avoid edge clipping
    """
    # 1. Upscale small crops — PaddleOCR struggles below ~32px height
    w, h = crop.size
    min_height = 64
    if h < min_height:
        scale = min_height / h
        crop = crop.resize((int(w * scale), min_height), Image.LANCZOS)
        w, h = crop.size

    # 2. Grayscale
    gray = crop.convert("L")

    # 3. Moderate contrast — enough to separate digits from background,
    #    but NOT binary threshold which merges/splits strokes
    enhancer = ImageEnhance.Contrast(gray)
    enhanced = enhancer.enhance(1.8)

    # Brightness normalization — ensure consistent lighting
    bright = ImageEnhance.Brightness(enhanced)
    enhanced = bright.enhance(1.2)

    # 4. Sharpen to crisp digit edges
    sharpened = enhanced.filter(ImageFilter.SHARPEN)

    # 5. Convert back to RGB (PaddleOCR expects 3-channel) and pad
    rgb = sharpened.convert("RGB")
    pad = max(8, int(min(w, h) * 0.08))
    padded = ImageOps.expand(rgb, border=pad, fill="white")

    return padded


# ── Stage 1: YOLO digit-region detection ──────────────────────────────

def _detect_digit_regions(
    image: Image.Image,
    confidence_threshold: float = 0.3,
) -> list[dict]:
    """Run YOLOv11n on the original image and return detected digit-region crops.

    Crops are taken from the ORIGINAL image (not preprocessed) so digit
    features are preserved for the OCR stage.

    Returns a list of dicts sorted left→right by x-position:
        [{"crop": Image, "bbox": (x1,y1,x2,y2), "confidence": float}, ...]
    """
    model = _get_yolo()
    img_array = np.array(image)

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

            # Crop from original image to preserve digit features
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
    prepared = _preprocess_crop_for_ocr(image)
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

    Pipeline:
      1. Auto-orient the original image
      2. YOLO detects digit regions on the ORIGINAL image
      3. Crop from ORIGINAL (preserves digit features)
      4. Preprocess each crop gently for OCR
      5. PaddleOCR recognizes digits on each crop

    Returns:
        Dict with 'value' (float|None), 'raw_text', 'confidence',
        'all_results', 'pipeline' (detection method used).
    """
    # Auto-orient only — no aggressive preprocessing before YOLO
    original = _auto_orient(image)

    # Stage 1 — YOLO detection on original image
    yolo_conf = float(os.getenv("YOLO_CONFIDENCE_THRESHOLD", "0.3"))
    regions = _detect_digit_regions(original, confidence_threshold=yolo_conf)

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
        # Fallback — run PaddleOCR on the full original image
        pipeline_used = "paddleocr-fullimage"
        logger.info("YOLO detected no regions, falling back to full-image PaddleOCR")

        raw_text, avg_confidence = _recognize_digits(original)
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

    Vietnamese electricity meters have 5 integer digits + 1 decimal digit.
    The last digit (usually red) is the decimal part.
    Example: OCR reads "246813" → actual value is 24681.3 kWh.

    Handles formats:
      - '246813'   → 24681.3  (6 digits, no dot → insert before last)
      - '24681.3'  → 24681.3  (already has dot)
      - '12345'    → 1234.5   (5 digits, no dot → insert before last)
      - '1234.5'   → 1234.5   (already has dot)
    """
    # Remove non-numeric chars except dots
    cleaned = re.sub(r"[^\d.]", "", text)

    if not cleaned:
        return None

    # Handle multiple dots (keep only the last one)
    parts = cleaned.split(".")
    if len(parts) > 2:
        cleaned = "".join(parts[:-1]) + "." + parts[-1]

    # Meter format: if pure digits (no dot) with 5-6 chars,
    # the last digit is the decimal part
    if "." not in cleaned and len(cleaned) >= 5:
        cleaned = cleaned[:-1] + "." + cleaned[-1]

    try:
        value = float(cleaned)
        # Sanity check: meter readings are typically 0 - 99999.9
        if 0 <= value <= 99999.9:
            return round(value, 1)
        return None
    except ValueError:
        return None
