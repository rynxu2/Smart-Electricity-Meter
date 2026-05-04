"""Bill calculation and history endpoints."""

from typing import List
from fastapi import APIRouter, HTTPException
from app.models import BillCalculateRequest, BillResponse
from app.bill_calculator import calculate_bill
from app.dependencies import get_db

router = APIRouter(prefix="/bills", tags=["Bills"])


@router.get("/device/{device_id}", response_model=List[BillResponse])
async def get_device_bills(device_id: str):
    """Get bill history for a device."""
    db = get_db()
    result = db.table("bills").select("*").eq(
        "device_id", device_id
    ).order("period_end", desc=True).execute()
    return result.data


@router.post("/calculate", response_model=BillResponse, status_code=201)
async def calculate_and_save_bill(request: BillCalculateRequest):
    """Calculate electricity bill for a period and save it."""
    db = get_db()

    # Get start and end OCR readings for the period
    start_reading = db.table("readings").select("ocr_value").eq(
        "device_id", str(request.device_id)
    ).eq("source", "ocr").gte(
        "read_at", request.period_start.isoformat()
    ).order("read_at", desc=False).limit(1).execute()

    end_reading = db.table("readings").select("ocr_value").eq(
        "device_id", str(request.device_id)
    ).eq("source", "ocr").lte(
        "read_at", request.period_end.isoformat()
    ).order("read_at", desc=True).limit(1).execute()

    if not start_reading.data or not end_reading.data:
        raise HTTPException(
            status_code=400,
            detail="Không đủ dữ liệu OCR trong khoảng thời gian này. Cần ít nhất 2 lần đọc chỉ số.",
        )

    start_val = start_reading.data[0]["ocr_value"]
    end_val = end_reading.data[0]["ocr_value"]

    if start_val is None or end_val is None:
        raise HTTPException(status_code=400, detail="Chỉ số OCR không hợp lệ.")

    kwh_consumed = end_val - start_val
    if kwh_consumed < 0:
        raise HTTPException(status_code=400, detail="Chỉ số cuối kỳ nhỏ hơn đầu kỳ. Kiểm tra lại dữ liệu.")

    # Calculate bill
    bill_data = calculate_bill(kwh_consumed)

    # Save to database
    bill_record = {
        "device_id": str(request.device_id),
        "period_start": request.period_start.isoformat(),
        "period_end": request.period_end.isoformat(),
        "start_reading": start_val,
        "end_reading": end_val,
        "kwh_consumed": kwh_consumed,
        "tier_breakdown": bill_data["tier_breakdown"],
        "subtotal": bill_data["subtotal"],
        "vat_rate": bill_data["vat_rate"],
        "vat_amount": bill_data["vat_amount"],
        "total_amount": bill_data["total_amount"],
    }

    result = db.table("bills").insert(bill_record).execute()
    return result.data[0]


@router.post("/estimate")
async def estimate_bill(kwh: float):
    """Quick bill estimation from kWh value (no database involved)."""
    if kwh < 0:
        raise HTTPException(status_code=400, detail="kWh phải >= 0")
    return calculate_bill(kwh)
