"""Meter devices CRUD endpoints."""

from typing import List
from fastapi import APIRouter, HTTPException
from app.models import DeviceCreate, DeviceResponse, DeviceUpdate, DeviceSettingsResponse, DeviceSettingsUpdate
from app.dependencies import get_db

router = APIRouter(prefix="/devices", tags=["Devices"])


@router.get("/", response_model=List[DeviceResponse])
async def list_devices():
    """List all registered meter devices."""
    db = get_db()
    result = db.table("devices").select("*").order("created_at", desc=True).execute()
    return result.data


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(device_id: str):
    """Get a specific device by ID."""
    db = get_db()
    result = db.table("devices").select("*").eq("id", device_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Device not found")
    return result.data


@router.post("/", response_model=DeviceResponse, status_code=201)
async def create_device(device: DeviceCreate):
    """Register a new meter device."""
    db = get_db()
    try:
        result = db.table("devices").insert(device.model_dump()).execute()
        device_data = result.data[0]

        # Create default settings
        db.table("device_settings").insert({"device_id": device_data["id"]}).execute()

        return device_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{device_id}", response_model=DeviceResponse)
async def update_device(device_id: str, update: DeviceUpdate):
    """Update device information."""
    db = get_db()
    data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = db.table("devices").update(data).eq("id", device_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Device not found")
    return result.data[0]


@router.delete("/{device_id}", status_code=204)
async def delete_device(device_id: str):
    """Delete a meter device."""
    db = get_db()
    db.table("devices").delete().eq("id", device_id).execute()


@router.get("/{device_id}/settings", response_model=DeviceSettingsResponse)
async def get_device_settings(device_id: str):
    """Get device settings."""
    db = get_db()
    result = db.table("device_settings").select("*").eq("device_id", device_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Settings not found")
    return result.data


@router.patch("/{device_id}/settings", response_model=DeviceSettingsResponse)
async def update_device_settings(device_id: str, update: DeviceSettingsUpdate):
    """Update device settings."""
    db = get_db()
    data = {k: v for k, v in update.model_dump().items() if v is not None}
    result = db.table("device_settings").update(data).eq("device_id", device_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Settings not found")
    return result.data[0]
