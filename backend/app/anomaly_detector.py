"""Anomaly detection for electricity consumption patterns."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Detects abnormal electricity consumption patterns."""

    def __init__(self, supabase_client, settings):
        self.db = supabase_client
        self.spike_multiplier = settings.ANOMALY_SPIKE_MULTIPLIER
        self.zero_hours = settings.ANOMALY_ZERO_HOURS

    async def check_all(self, device_id: str, current_kwh: float) -> list[dict]:
        """Run all anomaly checks and return list of detected anomalies."""
        anomalies = []

        spike = await self._check_spike(device_id, current_kwh)
        if spike:
            anomalies.append(spike)

        zero = await self._check_zero_usage(device_id)
        if zero:
            anomalies.append(zero)

        reverse = await self._check_reverse_flow(device_id)
        if reverse:
            anomalies.append(reverse)

        night = await self._check_night_spike(device_id)
        if night:
            anomalies.append(night)

        return anomalies

    async def _check_spike(self, device_id: str, current_kwh: float) -> dict | None:
        """Detect consumption spike: current > multiplier × 7-day average."""
        try:
            seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            result = self.db.table("readings").select("pulse_kwh").eq(
                "device_id", device_id
            ).gte("read_at", seven_days_ago).execute()

            if not result.data or len(result.data) < 3:
                return None

            avg_kwh = sum(r["pulse_kwh"] or 0 for r in result.data) / len(result.data)

            if avg_kwh > 0 and current_kwh > avg_kwh * self.spike_multiplier:
                return {
                    "alert_type": "spike",
                    "severity": "high",
                    "title": "⚡ Tiêu thụ điện bất thường",
                    "message": f"Mức tiêu thụ hiện tại ({current_kwh:.2f} kWh) cao gấp {current_kwh/avg_kwh:.1f} lần trung bình 7 ngày ({avg_kwh:.2f} kWh). Có thể xảy ra rò rỉ điện hoặc thiết bị hoạt động bất thường.",
                    "metadata": {"current": current_kwh, "avg_7d": avg_kwh},
                }
        except Exception as e:
            logger.error(f"Spike check failed: {e}")
        return None

    async def _check_zero_usage(self, device_id: str) -> dict | None:
        """Detect zero usage: no pulse data for configured hours."""
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=self.zero_hours)).isoformat()
            result = self.db.table("readings").select("id").eq(
                "device_id", device_id
            ).gte("read_at", cutoff).eq("source", "pulse").execute()

            if result.data is not None and len(result.data) == 0:
                return {
                    "alert_type": "zero_usage",
                    "severity": "medium",
                    "title": "🔌 Không có dữ liệu tiêu thụ",
                    "message": f"Không nhận được dữ liệu tiêu thụ trong {self.zero_hours} giờ qua. Kiểm tra thiết bị hoặc nguồn điện.",
                    "metadata": {"hours_without_data": self.zero_hours},
                }
        except Exception as e:
            logger.error(f"Zero usage check failed: {e}")
        return None

    async def _check_reverse_flow(self, device_id: str) -> dict | None:
        """Detect reverse meter flow: new OCR value < previous OCR value."""
        try:
            result = self.db.table("readings").select("ocr_value, read_at").eq(
                "device_id", device_id
            ).eq("source", "ocr").order("read_at", desc=True).limit(2).execute()

            if not result.data or len(result.data) < 2:
                return None

            newest, previous = result.data[0], result.data[1]
            if newest["ocr_value"] and previous["ocr_value"]:
                if newest["ocr_value"] < previous["ocr_value"]:
                    return {
                        "alert_type": "reverse_flow",
                        "severity": "critical",
                        "title": "🚨 Nghi ngờ gian lận điện",
                        "message": f"Chỉ số công tơ giảm từ {previous['ocr_value']} xuống {newest['ocr_value']}. Nghi ngờ có can thiệp vào công tơ điện.",
                        "metadata": {"old": previous["ocr_value"], "new": newest["ocr_value"]},
                    }
        except Exception as e:
            logger.error(f"Reverse flow check failed: {e}")
        return None

    async def _check_night_spike(self, device_id: str) -> dict | None:
        """Detect abnormal night consumption: 22:00-05:00 usage > 50% of daily."""
        try:
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
            result = self.db.table("readings").select("pulse_kwh, read_at").eq(
                "device_id", device_id
            ).gte("read_at", today_start).eq("source", "pulse").execute()

            if not result.data or len(result.data) < 6:
                return None

            total = sum(r["pulse_kwh"] or 0 for r in result.data)
            night_total = sum(
                r["pulse_kwh"] or 0 for r in result.data
                if _is_night_hour(r["read_at"])
            )

            if total > 0 and night_total / total > 0.5:
                return {
                    "alert_type": "night_spike",
                    "severity": "medium",
                    "title": "🌙 Tiêu thụ đêm cao bất thường",
                    "message": f"Tiêu thụ điện ban đêm (22h-5h) chiếm {night_total/total*100:.0f}% tổng ngày. Kiểm tra thiết bị hoạt động ban đêm.",
                    "metadata": {"night_kwh": night_total, "total_kwh": total},
                }
        except Exception as e:
            logger.error(f"Night spike check failed: {e}")
        return None


def _is_night_hour(timestamp_str: str) -> bool:
    """Check if timestamp falls in night hours (22:00-05:00)."""
    try:
        dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        return dt.hour >= 22 or dt.hour < 5
    except (ValueError, AttributeError):
        return False
