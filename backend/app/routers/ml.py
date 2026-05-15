"""ML model management endpoints — train and query anomaly detection models."""

from fastapi import APIRouter, HTTPException
from app.dependencies import get_db
from app.config import get_settings

router = APIRouter(prefix="/ml", tags=["Machine Learning"])


@router.post("/train/{device_id}")
async def train_anomaly_model(device_id: str):
    """Train/retrain Isolation Forest anomaly detection model for a device.

    Requires at least 20 pulse readings in the database.
    Should be called periodically (e.g., weekly via cron) or manually.
    """
    from app.anomaly_detector import AnomalyDetector

    db = get_db()
    settings = get_settings()

    # Verify device exists
    result = db.table("devices").select("id").eq("id", device_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Device not found")

    detector = AnomalyDetector(db, settings)
    train_result = await detector.train_model(device_id)

    return {
        "device_id": device_id,
        **train_result,
    }


@router.post("/train-all")
async def train_all_models():
    """Train anomaly detection models for all active devices."""
    from app.anomaly_detector import AnomalyDetector

    db = get_db()
    settings = get_settings()

    devices = db.table("devices").select("id").eq("status", "active").execute()
    if not devices.data:
        return {"trained": 0, "results": []}

    detector = AnomalyDetector(db, settings)
    results = []

    for device in devices.data:
        device_id = device["id"]
        result = await detector.train_model(device_id)
        results.append({"device_id": device_id, **result})

    trained_count = sum(1 for r in results if r.get("status") == "trained")
    return {
        "trained": trained_count,
        "total_devices": len(devices.data),
        "results": results,
    }


@router.get("/status/{device_id}")
async def get_model_status(device_id: str):
    """Check if a trained model exists for a device."""
    from pathlib import Path

    models_dir = Path(__file__).parent.parent / "ml_models"
    model_path = models_dir / f"iforest_{device_id}.pkl"

    return {
        "device_id": device_id,
        "model_exists": model_path.exists(),
        "model_path": str(model_path) if model_path.exists() else None,
        "model_size_bytes": model_path.stat().st_size if model_path.exists() else 0,
    }
