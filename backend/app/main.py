"""Smart Electricity Meter - FastAPI Application."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.dependencies import get_db
from app.mqtt_handler import MQTTHandler
from app.anomaly_detector import AnomalyDetector
from app.telegram_notifier import TelegramNotifier
from app.device_monitor import DeviceMonitor
from app.routers import meters, readings, bills, alerts, ml

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-20s | %(levelname)-7s | %(message)s",
)
logger = logging.getLogger(__name__)

# Global service instances
mqtt_handler: MQTTHandler | None = None
device_monitor: DeviceMonitor | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle: initialize MQTT, DeviceMonitor, services."""
    global mqtt_handler, device_monitor
    settings = get_settings()
    db = get_db()

    # Initialize services
    telegram = TelegramNotifier(settings.TELEGRAM_BOT_TOKEN, settings.TELEGRAM_DEFAULT_CHAT_ID)
    anomaly = AnomalyDetector(db, settings)

    # Start MQTT listener
    mqtt_handler = MQTTHandler(db, anomaly, telegram)
    mqtt_handler.connect()

    # Start device heartbeat monitor
    device_monitor = DeviceMonitor(
        db,
        timeout_seconds=settings.DEVICE_OFFLINE_TIMEOUT_SECONDS,
        interval_seconds=settings.DEVICE_MONITOR_INTERVAL_SECONDS,
    )
    device_monitor.start()

    logger.info(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} started")
    yield

    # Shutdown
    if device_monitor:
        await device_monitor.stop()
    if mqtt_handler:
        mqtt_handler.disconnect()
    logger.info("Server shutdown complete")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="API cho hệ thống đọc chỉ số công tơ điện thông minh từ xa",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    app.include_router(meters.router, prefix="/api")
    app.include_router(readings.router, prefix="/api")
    app.include_router(bills.router, prefix="/api")
    app.include_router(alerts.router, prefix="/api")
    app.include_router(ml.router, prefix="/api")

    @app.get("/")
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running",
            "docs": "/docs",
        }

    @app.get("/api/dashboard/stats")
    async def dashboard_stats():
        """Dashboard overview statistics."""
        db = get_db()

        devices = db.table("devices").select("id", count="exact").execute()
        active = db.table("devices").select("id", count="exact").eq("status", "online").execute()
        unread = db.table("alerts").select("id", count="exact").eq("is_read", False).execute()

        # Today's OCR readings count
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
        today_readings = db.table("readings").select("id", count="exact").eq(
            "source", "ocr"
        ).gte("read_at", today).execute()

        return {
            "total_devices": devices.count or 0,
            "active_devices": active.count or 0,
            "readings_today": today_readings.count or 0,
            "unread_alerts": unread.count or 0,
        }

    return app


app = create_app()
