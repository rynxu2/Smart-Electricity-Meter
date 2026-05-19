"""MQTT handler for receiving ESP32 sensor data."""

from __future__ import annotations

import json
import base64
import logging
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from app.config import get_settings
from app.ocr_service import decode_base64_image, extract_digits

logger = logging.getLogger(__name__)


class MQTTHandler:
    """MQTT client that subscribes to ESP32 topics and processes messages."""

    def __init__(self, supabase_client, anomaly_detector, telegram_notifier):
        self.db = supabase_client
        self.anomaly = anomaly_detector
        self.notifier = telegram_notifier
        self.settings = get_settings()
        self.client = None
        self._known_devices = set()

    def connect(self):
        """Initialize and connect MQTT client."""
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id="smart-meter-server",
        )

        if self.settings.MQTT_USERNAME:
            self.client.username_pw_set(
                self.settings.MQTT_USERNAME,
                self.settings.MQTT_PASSWORD,
            )

        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect

        try:
            self.client.connect(
                self.settings.MQTT_BROKER_HOST,
                self.settings.MQTT_BROKER_PORT,
                keepalive=60,
            )
            self.client.loop_start()
            logger.info(f"MQTT connecting to {self.settings.MQTT_BROKER_HOST}:{self.settings.MQTT_BROKER_PORT}")
        except Exception as e:
            logger.error(f"MQTT connection failed: {e}")

    def disconnect(self):
        """Disconnect MQTT client."""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info("MQTT disconnected")

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        """Handle MQTT connection and subscribe to topics."""
        if rc == 0:
            logger.info("MQTT connected successfully")
            client.subscribe(self.settings.MQTT_TOPIC_IMAGE)
            client.subscribe(self.settings.MQTT_TOPIC_STATUS)
            logger.info("Subscribed to topics: image, status")
        else:
            logger.error(f"MQTT connect failed with code {rc}")

    def _on_disconnect(self, client, userdata, flags, rc, properties=None):
        """Handle MQTT disconnection."""
        if rc != 0:
            logger.warning(f"MQTT unexpected disconnect (rc={rc}), will auto-reconnect")

    def _on_message(self, client, userdata, msg):
        """Route incoming MQTT messages to appropriate handlers."""
        topic = msg.topic
        logger.info(f"MQTT message on {topic} ({len(msg.payload)} bytes)")

        try:
            parts = topic.split("/")
            if len(parts) < 3:
                logger.warning(f"Invalid topic format: {topic}")
                return

            device_id = parts[1]
            message_type = parts[2]

            # Auto-register device if first time seen
            self._ensure_device_exists(device_id)

            if message_type == "image":
                self._handle_image(device_id, msg.payload)
            elif message_type == "status":
                self._handle_status(device_id, msg.payload)
            else:
                logger.warning(f"Unknown message type: {message_type}")

        except Exception as e:
            logger.error(f"Message handling error: {e}", exc_info=True)

    def _ensure_device_exists(self, device_id: str):
        """Auto-register a device in the database if it doesn't exist yet."""
        if device_id in self._known_devices:
            return

        try:
            result = self.db.table("devices").select("id").eq("id", device_id).execute()
            if result.data:
                self._known_devices.add(device_id)
                return

            # Auto-register new device
            self.db.table("devices").insert({
                "id": device_id,
                "name": device_id,
                "meter_serial": device_id,
                "status": "offline",
            }).execute()

            # Create default settings
            self.db.table("device_settings").insert({
                "device_id": device_id,
            }).execute()

            self._known_devices.add(device_id)
            logger.info(f"Auto-registered new device: {device_id}")

        except Exception as e:
            logger.error(f"Device registration check failed for {device_id}: {e}")

    def _handle_image(self, device_id: str, payload: bytes):
        """Process camera image: decode → YOLOv11n+PaddleOCR → annotate → store."""
        try:
            data = json.loads(payload)
            image_b64 = data.get("image", "")

            if not image_b64:
                logger.warning(f"Empty image from device {device_id}")
                return

            image = decode_base64_image(image_b64)
            ocr_result = extract_digits(
                image,
                confidence_threshold=self.settings.OCR_CONFIDENCE_THRESHOLD,
            )

            logger.info(
                f"OCR result for {device_id}: value={ocr_result['value']}, "
                f"confidence={ocr_result['confidence']}, pipeline={ocr_result.get('pipeline', 'unknown')}"
            )

            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

            # Upload raw image
            image_url = self._upload_image_bytes(
                device_id, base64.b64decode(image_b64), f"{timestamp}.jpg"
            )

            # Generate and upload annotated image (YOLO boxes + OCR text)
            annotated_url = self._generate_and_upload_annotated(
                device_id, image, ocr_result, timestamp
            )

            reading_data = {
                "device_id": device_id,
                "ocr_value": ocr_result["value"],
                "ocr_confidence": ocr_result["confidence"],
                "image_url": image_url,
                "annotated_url": annotated_url,
                "ocr_raw_text": ocr_result.get("raw_text", ""),
                "ocr_pipeline": ocr_result.get("pipeline", "unknown"),
                "source": "ocr",
            }
            self.db.table("readings").insert(reading_data).execute()

            self.db.table("devices").update(
                {"last_seen_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", device_id).execute()

        except Exception as e:
            logger.error(f"Image handling error for {device_id}: {e}", exc_info=True)

    def _generate_and_upload_annotated(
        self, device_id: str, image, ocr_result: dict, timestamp: str
    ):
        """Draw YOLO bounding boxes and OCR text on the image, then upload."""
        try:
            from PIL import ImageDraw, ImageFont

            annotated = image.copy().convert("RGB")
            draw = ImageDraw.Draw(annotated)

            # Try to use a readable font, fall back to default
            try:
                font = ImageFont.truetype("arial.ttf", 16)
                font_small = ImageFont.truetype("arial.ttf", 12)
            except (IOError, OSError):
                font = ImageFont.load_default()
                font_small = font

            for r in ocr_result.get("all_results", []):
                bbox = r.get("bbox")
                if not bbox:
                    continue

                x1, y1, x2, y2 = bbox
                conf = r.get("confidence", 0)
                yolo_conf = r.get("yolo_confidence", 0)
                text = r.get("text", "")

                # Box color based on confidence
                if conf >= 0.8:
                    box_color = (52, 211, 153)   # green
                elif conf >= 0.5:
                    box_color = (251, 191, 36)    # amber
                else:
                    box_color = (248, 113, 113)   # red

                # Draw bounding box
                draw.rectangle([x1, y1, x2, y2], outline=box_color, width=3)

                # Draw label background
                label = f'"{text}" {conf:.0%}'
                label_y = max(0, y1 - 22)
                bbox_text = draw.textbbox((x1, label_y), label, font=font_small)
                draw.rectangle(
                    [bbox_text[0] - 2, bbox_text[1] - 2, bbox_text[2] + 2, bbox_text[3] + 2],
                    fill=box_color,
                )
                draw.text((x1, label_y), label, fill=(0, 0, 0), font=font_small)

            # Draw parsed value at top
            parsed_value = ocr_result.get("value")
            if parsed_value is not None:
                value_label = f"OCR: {parsed_value} kWh ({ocr_result.get('pipeline', '')})"
                draw.text((8, 8), value_label, fill=(52, 211, 153), font=font)

            # Convert to bytes and upload
            import io
            buf = io.BytesIO()
            annotated.save(buf, format="JPEG", quality=90)
            annotated_bytes = buf.getvalue()

            return self._upload_image_bytes(
                device_id, annotated_bytes, f"{timestamp}_annotated.jpg"
            )

        except Exception as e:
            logger.error(f"Annotated image generation failed: {e}")
            return None

    def _upload_image_bytes(self, device_id: str, image_bytes: bytes, filename: str):
        """Upload image bytes to Supabase Storage and return public URL."""
        try:
            path = f"{device_id}/{filename}"

            self.db.storage.from_(self.settings.SUPABASE_STORAGE_BUCKET).upload(
                path,
                image_bytes,
                file_options={"content-type": "image/jpeg"},
            )

            url = self.db.storage.from_(self.settings.SUPABASE_STORAGE_BUCKET).get_public_url(path)
            return url

        except Exception as e:
            logger.error(f"Image upload failed: {e}")
            return None

    def _handle_status(self, device_id: str, payload: bytes):
        """Process device status heartbeat or LWT offline message."""
        try:
            data = json.loads(payload)

            # Handle LWT (Last Will) — broker sends this when ESP32 disconnects
            if data.get("status") == "offline":
                self.db.table("devices").update(
                    {"status": "offline"}
                ).eq("id", device_id).execute()
                logger.warning(f"LWT: device {device_id} went offline (broker notification)")
                return

            # Normal heartbeat — mark online and save diagnostics
            update_data = {
                "last_seen_at": datetime.now(timezone.utc).isoformat(),
                "status": "online",
            }

            if "wifi_rssi" in data:
                update_data["wifi_rssi"] = data["wifi_rssi"]
            if "uptime_ms" in data:
                update_data["uptime_ms"] = data["uptime_ms"]
            if "free_heap" in data:
                update_data["free_heap"] = data["free_heap"]

            self.db.table("devices").update(update_data).eq("id", device_id).execute()

            logger.info(
                f"Heartbeat from {device_id}: RSSI={data.get('wifi_rssi')}dBm, "
                f"uptime={data.get('uptime_ms', 0) // 1000}s, heap={data.get('free_heap')}"
            )

        except Exception as e:
            logger.error(f"Status handling error for {device_id}: {e}", exc_info=True)
