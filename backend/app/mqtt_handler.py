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
            client.subscribe(self.settings.MQTT_TOPIC_PULSE)
            client.subscribe(self.settings.MQTT_TOPIC_STATUS)
            logger.info(f"Subscribed to topics: image, pulse, status")
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
            # Extract device_id from topic: smart-meter/{device_id}/image
            parts = topic.split("/")
            if len(parts) < 3:
                logger.warning(f"Invalid topic format: {topic}")
                return

            device_id = parts[1]
            message_type = parts[2]

            if message_type == "image":
                self._handle_image(device_id, msg.payload)
            elif message_type == "pulse":
                self._handle_pulse(device_id, msg.payload)
            elif message_type == "status":
                self._handle_status(device_id, msg.payload)
            else:
                logger.warning(f"Unknown message type: {message_type}")

        except Exception as e:
            logger.error(f"Message handling error: {e}", exc_info=True)

    def _handle_image(self, device_id: str, payload: bytes):
        """Process camera image: decode → OCR → store reading → check anomalies."""
        try:
            data = json.loads(payload)
            image_b64 = data.get("image", "")

            if not image_b64:
                logger.warning(f"Empty image from device {device_id}")
                return

            # Decode and run OCR
            image = decode_base64_image(image_b64)
            ocr_result = extract_digits(
                image,
                languages=self.settings.OCR_LANGUAGES,
                confidence_threshold=self.settings.OCR_CONFIDENCE_THRESHOLD,
            )

            logger.info(f"OCR result for {device_id}: value={ocr_result['value']}, confidence={ocr_result['confidence']}")

            # Upload image to Supabase Storage
            image_url = self._upload_image(device_id, image_b64)

            # Store reading
            reading_data = {
                "device_id": device_id,
                "ocr_value": ocr_result["value"],
                "ocr_confidence": ocr_result["confidence"],
                "image_url": image_url,
                "source": "ocr",
            }
            self.db.table("readings").insert(reading_data).execute()

            # Update device last_seen
            self.db.table("devices").update(
                {"last_seen_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", device_id).execute()

        except Exception as e:
            logger.error(f"Image handling error for {device_id}: {e}", exc_info=True)

    def _handle_pulse(self, device_id: str, payload: bytes):
        """Process pulse sensor data: store reading → check anomalies."""
        try:
            data = json.loads(payload)
            pulse_count = data.get("count", 0)
            pulse_per_kwh = data.get("pulse_per_kwh", 1600)
            pulse_kwh = pulse_count / pulse_per_kwh

            reading_data = {
                "device_id": device_id,
                "pulse_count": pulse_count,
                "pulse_kwh": round(pulse_kwh, 4),
                "source": "pulse",
            }
            self.db.table("readings").insert(reading_data).execute()

            # Update last_seen
            self.db.table("devices").update(
                {"last_seen_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", device_id).execute()

            logger.info(f"Pulse reading from {device_id}: {pulse_count} pulses = {pulse_kwh:.4f} kWh")

        except Exception as e:
            logger.error(f"Pulse handling error for {device_id}: {e}", exc_info=True)

    def _handle_status(self, device_id: str, payload: bytes):
        """Process device status heartbeat."""
        try:
            data = json.loads(payload)
            self.db.table("devices").update({
                "last_seen_at": datetime.now(timezone.utc).isoformat(),
                "status": data.get("status", "active"),
            }).eq("id", device_id).execute()

            logger.info(f"Status update from {device_id}: {data}")

        except Exception as e:
            logger.error(f"Status handling error for {device_id}: {e}", exc_info=True)

    def _upload_image(self, device_id: str, image_b64: str) -> str | None:
        """Upload image to Supabase Storage and return public URL."""
        try:
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            filename = f"{device_id}/{timestamp}.jpg"
            image_bytes = base64.b64decode(image_b64)

            self.db.storage.from_(self.settings.SUPABASE_STORAGE_BUCKET).upload(
                filename,
                image_bytes,
                file_options={"content-type": "image/jpeg"},
            )

            url = self.db.storage.from_(self.settings.SUPABASE_STORAGE_BUCKET).get_public_url(filename)
            return url

        except Exception as e:
            logger.error(f"Image upload failed: {e}")
            return None
