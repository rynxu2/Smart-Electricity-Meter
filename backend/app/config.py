"""Environment configuration using pydantic-settings."""

from __future__ import annotations

from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from functools import lru_cache

load_dotenv()

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "Smart Electricity Meter API"
    APP_VERSION: str = "3.0.0"
    DEBUG: bool = False

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_STORAGE_BUCKET: str = "meter-images"

    # MQTT Broker
    MQTT_BROKER_HOST: str = "broker.hivemq.com"
    MQTT_BROKER_PORT: int = 1883
    MQTT_USERNAME: str = ""
    MQTT_PASSWORD: str = ""
    MQTT_TOPIC_IMAGE: str = "smart-meter/+/image"
    MQTT_TOPIC_PULSE: str = "smart-meter/+/pulse"
    MQTT_TOPIC_STATUS: str = "smart-meter/+/status"

    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_DEFAULT_CHAT_ID: str = ""

    # OCR — YOLOv11n + PaddleOCR v4 Pipeline
    YOLO_MODEL_PATH: str = "yolo11n.pt"
    OCR_CONFIDENCE_THRESHOLD: float = 0.6
    YOLO_CONFIDENCE_THRESHOLD: float = 0.3

    # Anomaly Detection
    ANOMALY_SPIKE_MULTIPLIER: float = 2.0
    ANOMALY_ZERO_HOURS: int = 24
    ANOMALY_ML_ENABLED: bool = True
    ANOMALY_ML_ALGORITHM: str = "ensemble"  # "iforest" | "ecod" | "ensemble"
    ANOMALY_IFOREST_CONTAMINATION: float = 0.05
    ANOMALY_ECOD_CONTAMINATION: float = 0.05
    ANOMALY_MIN_TRAINING_SAMPLES: int = 20

    # Bill Calculation
    VAT_RATE: float = 8.0

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

@lru_cache
def get_settings() -> Settings:
    return Settings()
