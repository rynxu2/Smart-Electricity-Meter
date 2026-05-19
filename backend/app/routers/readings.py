"""Meter readings endpoints."""

from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from app.models import ReadingResponse, ReadingManual
from app.dependencies import get_db

router = APIRouter(prefix="/readings", tags=["Readings"])


@router.get("/", response_model=List[ReadingResponse])
async def list_all_readings(
    source: Optional[str] = Query(None, pattern="^(ocr|manual)$"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List recent readings across all devices."""
    db = get_db()
    query = db.table("readings").select("*")

    if source:
        query = query.eq("source", source)

    result = query.order("read_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data


@router.get("/device/{device_id}", response_model=List[ReadingResponse])
async def get_device_readings(
    device_id: str,
    source: Optional[str] = Query(None, pattern="^(ocr|manual)$"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Get readings for a specific device with optional source filter."""
    db = get_db()
    query = db.table("readings").select("*").eq("device_id", device_id)

    if source:
        query = query.eq("source", source)

    result = query.order("read_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data


@router.get("/device/{device_id}/latest")
async def get_latest_reading(device_id: str, source: Optional[str] = None):
    """Get the most recent reading for a device."""
    db = get_db()
    query = db.table("readings").select("*").eq("device_id", device_id)
    if source:
        query = query.eq("source", source)
    result = query.order("read_at", desc=True).limit(1).execute()
    return result.data[0] if result.data else None


@router.post("/manual", response_model=ReadingResponse, status_code=201)
async def add_manual_reading(reading: ReadingManual):
    """Add a manual meter reading."""
    db = get_db()
    result = db.table("readings").insert({
        "device_id": str(reading.device_id),
        "ocr_value": reading.ocr_value,
        "source": "manual",
    }).execute()
    return result.data[0]
