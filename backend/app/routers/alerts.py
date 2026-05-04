"""Alert management endpoints."""

from typing import Optional, List

from fastapi import APIRouter, Query
from app.models import AlertResponse
from app.dependencies import get_db

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/", response_model=List[AlertResponse])
async def list_alerts(
    device_id: Optional[str] = None,
    is_read: Optional[bool] = None,
    severity: Optional[str] = Query(None, pattern="^(low|medium|high|critical)$"),
    limit: int = Query(50, ge=1, le=200),
):
    """List alerts with optional filters."""
    db = get_db()
    query = db.table("alerts").select("*")

    if device_id:
        query = query.eq("device_id", device_id)
    if is_read is not None:
        query = query.eq("is_read", is_read)
    if severity:
        query = query.eq("severity", severity)

    result = query.order("created_at", desc=True).limit(limit).execute()
    return result.data


@router.get("/unread-count")
async def get_unread_count(device_id: Optional[str] = None):
    """Get count of unread alerts."""
    db = get_db()
    query = db.table("alerts").select("id", count="exact").eq("is_read", False)
    if device_id:
        query = query.eq("device_id", device_id)
    result = query.execute()
    return {"count": result.count or 0}


@router.patch("/{alert_id}/read")
async def mark_alert_read(alert_id: str):
    """Mark an alert as read."""
    db = get_db()
    db.table("alerts").update({"is_read": True}).eq("id", alert_id).execute()
    return {"status": "ok"}


@router.patch("/read-all")
async def mark_all_read(device_id: Optional[str] = None):
    """Mark all alerts as read."""
    db = get_db()
    query = db.table("alerts").update({"is_read": True}).eq("is_read", False)
    if device_id:
        query = query.eq("device_id", device_id)
    query.execute()
    return {"status": "ok"}
