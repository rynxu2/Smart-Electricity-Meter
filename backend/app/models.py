"""Pydantic models for API request/response schemas."""

from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List


# ── Device ──────────────────────────────────
class DeviceBase(BaseModel):
    name: str = Field(..., max_length=100)
    location: Optional[str] = None
    meter_serial: str = Field(..., max_length=50)
    esp_mac_address: Optional[str] = None


class DeviceCreate(DeviceBase):
    id: Optional[str] = None


class DeviceResponse(DeviceBase):
    id: str
    status: str
    last_seen_at: Optional[datetime] = None
    wifi_rssi: Optional[int] = None
    uptime_ms: Optional[int] = None
    free_heap: Optional[int] = None
    created_at: datetime


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None


# ── Reading ──────────────────────────────────
class ReadingBase(BaseModel):
    device_id: str
    source: str = Field(..., pattern="^(ocr|manual)$")


class ReadingOCR(ReadingBase):
    source: str = "ocr"
    ocr_value: float
    ocr_confidence: float
    image_url: Optional[str] = None



class ReadingManual(ReadingBase):
    source: str = "manual"
    ocr_value: float


class ReadingResponse(BaseModel):
    id: str
    device_id: str
    ocr_value: Optional[float] = None
    ocr_confidence: Optional[float] = None
    image_url: Optional[str] = None
    annotated_url: Optional[str] = None
    ocr_raw_text: Optional[str] = None
    ocr_pipeline: Optional[str] = None
    source: str
    read_at: datetime


# ── Bill ──────────────────────────────────
class TierBreakdown(BaseModel):
    tier: int
    range_label: str
    kwh: float
    price: float
    amount: float


class BillResponse(BaseModel):
    id: str
    device_id: str
    period_start: date
    period_end: date
    start_reading: float
    end_reading: float
    kwh_consumed: float
    tier_breakdown: List[TierBreakdown]
    subtotal: float
    vat_rate: float
    vat_amount: float
    total_amount: float
    created_at: datetime


class BillCalculateRequest(BaseModel):
    device_id: str
    period_start: date
    period_end: date


# ── Alert ──────────────────────────────────
class AlertResponse(BaseModel):
    id: str
    device_id: str
    alert_type: str
    severity: str
    title: str
    message: str
    metadata: Optional[dict] = None
    is_read: bool
    notified_at: Optional[datetime] = None
    created_at: datetime


# ── Device Settings ──────────────────────────
class DeviceSettingsUpdate(BaseModel):
    capture_interval_hours: Optional[int] = None
    telegram_chat_id: Optional[str] = None
    alert_enabled: Optional[bool] = None


class DeviceSettingsResponse(BaseModel):
    id: str
    device_id: str
    capture_interval_hours: int
    telegram_chat_id: Optional[str] = None
    alert_enabled: bool


# ── Dashboard Stats ──────────────────────────
class DashboardStats(BaseModel):
    total_devices: int
    active_devices: int
    total_kwh_today: float
    unread_alerts: int
    latest_reading: Optional[ReadingResponse] = None
