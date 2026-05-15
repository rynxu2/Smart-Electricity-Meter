"""Anomaly detection for electricity consumption patterns.

Hybrid approach:
  Layer 1 — Rule-based checks (reverse flow, zero usage, etc.)
  Layer 2 — ML ensemble (Isolation Forest + ECOD) via PyOD.

The ML layer trains both IForest and ECOD per device. ECOD adds
parameter-free, interpretable anomaly scoring. Ensemble consensus
(both must agree) reduces false positives.
"""

from __future__ import annotations

import logging
import pickle
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

# ── ML model persistence path ──────────────────────────────────────────
_MODELS_DIR = Path(__file__).parent.parent / "ml_models"
_MODELS_DIR.mkdir(exist_ok=True)


class AnomalyDetector:
    """Detects abnormal electricity consumption patterns using hybrid approach."""

    def __init__(self, supabase_client, settings):
        self.db = supabase_client
        self.spike_multiplier = settings.ANOMALY_SPIKE_MULTIPLIER
        self.zero_hours = settings.ANOMALY_ZERO_HOURS
        self._ml_models: dict[str, dict] = {}  # device_id → {"iforest": ..., "ecod": ...}

    # ── Public API ──────────────────────────────────────────────────────

    async def check_all(self, device_id: str, current_kwh: float) -> list[dict]:
        """Run all anomaly checks and return list of detected anomalies."""
        anomalies = []

        # Layer 1: Rule-based checks
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

        # Layer 2: ML ensemble (IForest + ECOD)
        ml_anomaly = await self._check_ml_anomaly(device_id, current_kwh)
        if ml_anomaly:
            anomalies.append(ml_anomaly)

        return anomalies

    async def train_model(self, device_id: str) -> dict:
        """Train/retrain IForest + ECOD ensemble for a specific device.

        Should be called periodically (e.g., weekly) or when enough new data
        has accumulated (20+ readings).
        """
        try:
            features, timestamps = await self._build_feature_matrix(device_id)
            if features is None or len(features) < 20:
                return {
                    "status": "skipped",
                    "reason": f"Insufficient data ({len(features) if features is not None else 0} readings, need 20+)",
                }

            from pyod.models.iforest import IForest
            from pyod.models.ecod import ECOD

            # Train both models
            iforest = IForest(
                n_estimators=100,
                contamination=0.05,
                random_state=42,
            )
            ecod = ECOD(contamination=0.05)

            iforest.fit(features)
            ecod.fit(features)

            # Save as ensemble dict
            ensemble = {"iforest": iforest, "ecod": ecod}
            self._ml_models[device_id] = ensemble

            model_path = _MODELS_DIR / f"ensemble_{device_id}.pkl"
            with open(model_path, "wb") as f:
                pickle.dump(ensemble, f)

            logger.info(
                f"Ensemble trained for {device_id}: "
                f"{len(features)} samples, "
                f"iforest_threshold={iforest.threshold_:.4f}, "
                f"ecod_threshold={ecod.threshold_:.4f}"
            )
            return {
                "status": "trained",
                "algorithm": "iforest+ecod",
                "samples": len(features),
                "iforest_threshold": round(iforest.threshold_, 4),
                "ecod_threshold": round(ecod.threshold_, 4),
            }

        except Exception as e:
            logger.error(f"ML model training failed for {device_id}: {e}")
            return {"status": "error", "reason": str(e)}

    # ── Layer 1: Rule-based checks ──────────────────────────────────────

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

    # ── Layer 2: ML-based Isolation Forest ─────────────────────────────

    async def _check_ml_anomaly(self, device_id: str, current_kwh: float) -> dict | None:
        """Run IForest + ECOD ensemble prediction on the current reading.

        Consensus mode: anomaly only if BOTH models agree (reduces false positives).
        """
        try:
            models = self._load_models(device_id)
            if models is None:
                return None

            features = await self._build_current_features(device_id, current_kwh)
            if features is None:
                return None

            feature_array = np.array([features])
            feature_names = ["kwh", "hour", "weekday", "avg_7d", "delta"]

            iforest = models["iforest"]
            ecod = models["ecod"]

            if_pred = iforest.predict(feature_array)[0]
            ecod_pred = ecod.predict(feature_array)[0]

            if_score = float(iforest.decision_function(feature_array)[0])
            ecod_score = float(ecod.decision_function(feature_array)[0])

            # Ensemble consensus: both must flag anomaly
            is_anomaly = (if_pred == 1) and (ecod_pred == 1)

            if is_anomaly:
                # ECOD feature-wise explanation
                explanation = ""
                try:
                    conf_matrix = ecod.decision_function(feature_array)
                    top_idx = int(np.argmax(np.abs(feature_array[0])))
                    explanation = f" Yếu tố chính: {feature_names[top_idx]}."
                except Exception:
                    pass

                avg_score = (if_score + ecod_score) / 2
                return {
                    "alert_type": "ml_anomaly",
                    "severity": "medium",
                    "title": "🤖 AI phát hiện bất thường",
                    "message": (
                        f"Ensemble AI (IForest + ECOD) đồng thuận phát hiện bất thường. "
                        f"Mức tiêu thụ hiện tại ({current_kwh:.2f} kWh) "
                        f"không khớp pattern lịch sử."
                        f"{explanation}"
                    ),
                    "metadata": {
                        "iforest_score": round(if_score, 4),
                        "ecod_score": round(ecod_score, 4),
                        "ensemble_score": round(avg_score, 4),
                        "current_kwh": current_kwh,
                        "model": "iforest+ecod",
                    },
                }
        except Exception as e:
            logger.error(f"ML anomaly check failed for {device_id}: {e}")
        return None

    def _load_models(self, device_id: str) -> dict | None:
        """Load ensemble models from memory cache or disk."""
        if device_id in self._ml_models:
            return self._ml_models[device_id]

        # Try new ensemble format first
        ensemble_path = _MODELS_DIR / f"ensemble_{device_id}.pkl"
        if ensemble_path.exists():
            try:
                with open(ensemble_path, "rb") as f:
                    models = pickle.load(f)
                self._ml_models[device_id] = models
                logger.info(f"Loaded ensemble model for {device_id}")
                return models
            except Exception as e:
                logger.error(f"Failed to load ensemble for {device_id}: {e}")

        # Backward compat: try old single IForest format
        old_path = _MODELS_DIR / f"iforest_{device_id}.pkl"
        if old_path.exists():
            try:
                with open(old_path, "rb") as f:
                    clf = pickle.load(f)
                # Wrap in ensemble dict (ECOD will be None)
                models = {"iforest": clf, "ecod": None}
                self._ml_models[device_id] = models
                logger.info(f"Loaded legacy IForest model for {device_id}")
                return models
            except Exception as e:
                logger.error(f"Failed to load model for {device_id}: {e}")
        return None

    async def _build_current_features(
        self, device_id: str, current_kwh: float
    ) -> list[float] | None:
        """Build feature vector for the current reading.

        Features: [kwh, hour_of_day, day_of_week, avg_7d, delta_from_avg]
        """
        try:
            now = datetime.now(timezone.utc)
            seven_days_ago = (now - timedelta(days=7)).isoformat()

            result = self.db.table("readings").select("pulse_kwh").eq(
                "device_id", device_id
            ).gte("read_at", seven_days_ago).eq("source", "pulse").execute()

            readings = [r["pulse_kwh"] or 0 for r in (result.data or [])]
            avg_7d = sum(readings) / len(readings) if readings else current_kwh
            delta = current_kwh - avg_7d

            return [
                current_kwh,
                float(now.hour),
                float(now.weekday()),
                avg_7d,
                delta,
            ]
        except Exception as e:
            logger.error(f"Feature building failed for {device_id}: {e}")
            return None

    async def _build_feature_matrix(
        self, device_id: str
    ) -> tuple[np.ndarray | None, list[str] | None]:
        """Build training feature matrix from historical readings.

        Returns (features_array, timestamps_list) or (None, None).
        """
        try:
            result = self.db.table("readings").select(
                "pulse_kwh, read_at"
            ).eq(
                "device_id", device_id
            ).eq("source", "pulse").order("read_at").execute()

            if not result.data or len(result.data) < 20:
                return None, None

            features = []
            timestamps = []

            kwh_values = [r["pulse_kwh"] or 0 for r in result.data]

            for i, reading in enumerate(result.data):
                kwh = reading["pulse_kwh"] or 0
                ts = reading["read_at"]

                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                hour = float(dt.hour)
                weekday = float(dt.weekday())

                # Rolling 7-reading average (proxy for 7-day average)
                window_start = max(0, i - 7)
                window = kwh_values[window_start:i] if i > 0 else [kwh]
                avg_window = sum(window) / len(window) if window else kwh
                delta = kwh - avg_window

                features.append([kwh, hour, weekday, avg_window, delta])
                timestamps.append(ts)

            return np.array(features), timestamps

        except Exception as e:
            logger.error(f"Feature matrix build failed for {device_id}: {e}")
            return None, None


def _is_night_hour(timestamp_str: str) -> bool:
    """Check if timestamp falls in night hours (22:00-05:00)."""
    try:
        dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        return dt.hour >= 22 or dt.hour < 5
    except (ValueError, AttributeError):
        return False
