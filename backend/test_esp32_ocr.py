# -*- coding: utf-8 -*-
"""
ESP32-CAM + YOLOv11n/PaddleOCR Test Tool
=================================
Test the two-stage OCR pipeline (YOLOv11n detect + PaddleOCR v4 recognize).

Usage:
  python test_esp32_ocr.py --generate
  python test_esp32_ocr.py --image test_output/sample_meter.jpg
  python test_esp32_ocr.py --image meter.jpg --mqtt
  python test_esp32_ocr.py --camera
"""

import argparse
import base64
import json
import os
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import Image, ImageDraw, ImageFont


def log(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", errors="replace").decode())


# ── Generate sample meter image ───────────────────────────────────
def generate_sample_meter(reading="15234.6", output_path="test_output/sample_meter.jpg"):
    log("\n" + "=" * 60)
    log("  [GEN] GENERATING SAMPLE METER IMAGE")
    log("=" * 60)

    width, height = 400, 120
    img = Image.new("RGB", (width, height), color=(20, 20, 30))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([10, 10, width - 10, height - 10], radius=8,
                           fill=(240, 240, 235), outline=(100, 100, 100), width=2)

    digits = reading.replace(".", "")
    dot_pos = reading.find(".")
    box_w, box_h, start_x, y = 40, 60, 30, 25

    for i, digit in enumerate(digits):
        x = start_x + i * (box_w + 5)
        is_decimal = dot_pos >= 0 and i >= dot_pos
        fill = (200, 50, 50) if is_decimal else (30, 30, 30)
        draw.rounded_rectangle([x, y, x + box_w, y + box_h], radius=4,
                               fill=fill, outline=(80, 80, 80))
        try:
            font = ImageFont.truetype("arial.ttf", 36)
        except (OSError, IOError):
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), digit, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text((x + (box_w - tw) // 2, y + (box_h - th) // 2 - 2),
                  digit, fill=(255, 255, 255), font=font)
        if dot_pos >= 0 and i == dot_pos - 1:
            draw.ellipse([x + box_w + 1, y + box_h - 10, x + box_w + 5, y + box_h - 6],
                         fill=(200, 50, 50))

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    img.save(output_path, quality=90)
    log(f"   Generated: {output_path} ({reading} kWh)")
    return output_path


# ── Local OCR test ────────────────────────────────────────────────
def test_ocr_local(image_path):
    from app.ocr_service import preprocess_image, extract_digits

    log("\n" + "=" * 60)
    log("  [OCR] YOLOv11n + PaddleOCR PIPELINE TEST")
    log("=" * 60)

    log(f"\n[IMG] Loading: {image_path}")
    image = Image.open(image_path)
    log(f"   Size: {image.size[0]}x{image.size[1]}, Mode: {image.mode}")

    log("\n[PRE] Preprocessing...")
    t0 = time.time()
    processed = preprocess_image(image)
    t_pre = time.time() - t0
    log(f"   Done ({t_pre:.2f}s)")

    output_dir = "test_output"
    os.makedirs(output_dir, exist_ok=True)
    processed.save(os.path.join(output_dir, "preprocessed.jpg"))

    log("\n[OCR] Running YOLOv11n + PaddleOCR (first run downloads models)...")
    t0 = time.time()
    result = extract_digits(image)
    t_ocr = time.time() - t0

    log(f"\n{'-' * 50}")
    log("  OCR RESULTS")
    log(f"{'-' * 50}")
    log(f"  Pipeline     : {result.get('pipeline', 'unknown')}")
    log(f"  Meter Value  : {result['value']}")
    log(f"  Raw Text     : '{result['raw_text']}'")
    log(f"  Confidence   : {result['confidence']:.1%}")
    log(f"  OCR Time     : {t_ocr:.2f}s")
    log(f"  Total Time   : {t_pre + t_ocr:.2f}s")

    if result["all_results"]:
        log(f"\n  Detected fragments:")
        for i, r in enumerate(result["all_results"]):
            bbox_info = f" bbox={r['bbox']}" if r.get("bbox") else ""
            yolo_info = f" yolo={r['yolo_confidence']}" if r.get("yolo_confidence") else ""
            bar_len = int(r["confidence"] * 20)
            bar = "#" * bar_len + "." * (20 - bar_len)
            log(f"    [{i+1}] '{r['text']}' -> {r['confidence']:.1%} [{bar}]{bbox_info}{yolo_info}")

    # Annotate image with bounding boxes
    try:
        annotated = image.copy().convert("RGB")
        draw = ImageDraw.Draw(annotated)
        for r in result["all_results"]:
            if r.get("bbox"):
                x1, y1, x2, y2 = r["bbox"]
                color = (0, 255, 0) if r["confidence"] >= 0.6 else (255, 165, 0)
                draw.rectangle([x1, y1, x2, y2], outline=color, width=2)
                draw.text((x1, y1 - 15), f"{r['text']} ({r['confidence']:.0%})", fill=color)
        annotated.save(os.path.join(output_dir, "annotated.jpg"))
        log(f"\n  Saved: test_output/annotated.jpg")
    except Exception as e:
        log(f"  Warning: Annotation failed: {e}")

    # Bill estimation
    if result["value"] is not None and result["value"] > 0:
        try:
            from app.bill_calculator import calculate_bill
            demo_kwh = min(result["value"], 500)
            bill = calculate_bill(demo_kwh)
            log(f"\n  [BILL] {demo_kwh:.0f} kWh -> {bill['total_amount']:,.0f} VND")
        except Exception:
            pass

    log(f"\n{'=' * 60}")
    return result


# ── MQTT simulation ──────────────────────────────────────────────
def test_mqtt_send(image_path, device_id="meter-test-001",
                   broker="broker.hivemq.com", port=1883):
    import paho.mqtt.client as mqtt

    log("\n" + "=" * 60)
    log("  [MQTT] ESP32-CAM SIMULATION")
    log("=" * 60)

    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = json.dumps({"device_id": device_id, "image": image_b64,
                          "timestamp": int(time.time() * 1000)})
    topic = f"smart-meter/{device_id}/image"

    log(f"\n[MQTT] Connecting to {broker}:{port}")
    connected = False

    def on_connect(client, userdata, flags, rc, properties=None):
        nonlocal connected
        connected = rc == 0
        log(f"   {'Connected OK!' if connected else f'Failed (rc={rc})'}")

    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                         client_id=f"test-sim-{device_id}")
    client.on_connect = on_connect

    try:
        client.connect(broker, port, keepalive=30)
        client.loop_start()
        for _ in range(10):
            if connected:
                break
            time.sleep(0.5)

        if connected:
            client.publish(topic, payload, qos=1).wait_for_publish(timeout=10)
            log(f"   Sent to {topic} ({len(payload):,} bytes)")

            # Status + pulse
            client.publish(f"smart-meter/{device_id}/status",
                           json.dumps({"status": "active", "wifi_rssi": -45}))
            client.publish(f"smart-meter/{device_id}/pulse",
                           json.dumps({"count": 25, "pulse_per_kwh": 1600}))
            log("   Status + pulse sent")
            time.sleep(2)
    except Exception as e:
        log(f"   Error: {e}")
    finally:
        client.loop_stop()
        client.disconnect()

    log(f"\n[TIP] Check FastAPI server logs for OCR result!")
    log("=" * 60)


# ── Webcam capture ───────────────────────────────────────────────
def test_webcam_capture(output_path="test_output/webcam_capture.jpg"):
    try:
        import cv2
    except ImportError:
        log("ERROR: pip install opencv-python")
        return None

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        log("ERROR: Cannot open webcam!")
        return None

    log("\n   Press SPACE to capture, ESC to cancel")
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        cv2.imshow("ESP32-CAM Simulator - SPACE to capture", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == 32:
            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
            cv2.imwrite(output_path, frame)
            log(f"   Captured: {output_path}")
            break
        elif key == 27:
            cap.release()
            cv2.destroyAllWindows()
            return None

    cap.release()
    cv2.destroyAllWindows()
    return output_path


# ── Main ─────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="ESP32-CAM + YOLO/TrOCR Test Tool")
    parser.add_argument("--image", "-i", type=str, help="Path to meter image")
    parser.add_argument("--generate", "-g", action="store_true", help="Generate sample meter image")
    parser.add_argument("--reading", "-r", type=str, default="15234.6", help="Reading for generated image")
    parser.add_argument("--mqtt", "-m", action="store_true", help="Send image via MQTT")
    parser.add_argument("--device-id", "-d", type=str, default="meter-test-001")
    parser.add_argument("--broker", "-b", type=str, default="broker.hivemq.com")
    parser.add_argument("--port", "-p", type=int, default=1883)
    parser.add_argument("--camera", "-c", action="store_true", help="Capture from webcam")
    args = parser.parse_args()

    log(f"\n{'=' * 60}")
    log(f"  Smart Meter - YOLOv11n + PaddleOCR Test Tool")
    log(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log(f"{'=' * 60}")

    image_path = args.image
    if args.generate:
        image_path = generate_sample_meter(reading=args.reading)
    if args.camera:
        image_path = test_webcam_capture()
    if not image_path or not os.path.exists(image_path):
        log("\nERROR: No image! Use --image, --generate, or --camera")
        parser.print_help()
        return

    test_ocr_local(image_path)
    if args.mqtt:
        test_mqtt_send(image_path, args.device_id, args.broker, args.port)
    log("\n[OK] Test complete!\n")


if __name__ == "__main__":
    main()
