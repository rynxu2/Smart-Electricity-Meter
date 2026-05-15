"""Vietnam tiered electricity bill calculator (Bậc thang giá điện Việt Nam 2025)."""

from dataclasses import dataclass


@dataclass
class TierInfo:
    tier: int
    min_kwh: float
    max_kwh: float
    price: float  # VNĐ/kWh
    label: str


# Bậc thang giá điện sinh hoạt Việt Nam 2025
ELECTRICITY_TIERS: list[TierInfo] = [
    TierInfo(1, 0, 50, 1984, "0 - 50 kWh"),
    TierInfo(2, 50, 100, 2050, "51 - 100 kWh"),
    TierInfo(3, 100, 200, 2380, "101 - 200 kWh"),
    TierInfo(4, 200, 300, 2998, "201 - 300 kWh"),
    TierInfo(5, 300, 400, 3350, "301 - 400 kWh"),
    TierInfo(6, 400, float("inf"), 3460, "> 400 kWh"),
]

DEFAULT_VAT_RATE = 8.0  # %


def calculate_bill(kwh_consumed: float, vat_rate: float = DEFAULT_VAT_RATE) -> dict:
    """Calculate electricity bill based on Vietnam's tiered pricing.

    Args:
        kwh_consumed: Total kWh consumed in the billing period.
        vat_rate: VAT percentage (default 8%).

    Returns:
        Dict with tier_breakdown, subtotal, vat_amount, total_amount.
    """
    if kwh_consumed < 0:
        raise ValueError("kWh consumed cannot be negative")

    tier_breakdown = []
    remaining = kwh_consumed
    subtotal = 0.0

    for tier in ELECTRICITY_TIERS:
        if remaining <= 0:
            break

        tier_capacity = tier.max_kwh - tier.min_kwh
        kwh_in_tier = min(remaining, tier_capacity)
        amount = kwh_in_tier * tier.price

        tier_breakdown.append({
            "tier": tier.tier,
            "range_label": tier.label,
            "kwh": round(kwh_in_tier, 2),
            "price": tier.price,
            "amount": round(amount, 0),
        })

        subtotal += amount
        remaining -= kwh_in_tier

    vat_amount = round(subtotal * vat_rate / 100, 0)
    total_amount = round(subtotal + vat_amount, 0)

    return {
        "kwh_consumed": kwh_consumed,
        "tier_breakdown": tier_breakdown,
        "subtotal": round(subtotal, 0),
        "vat_rate": vat_rate,
        "vat_amount": vat_amount,
        "total_amount": total_amount,
    }


def format_bill_text(bill_data: dict) -> str:
    """Format bill data as readable Vietnamese text for Telegram notifications."""
    lines = ["📊 HÓA ĐƠN TIỀN ĐIỆN", "═" * 30]

    for t in bill_data["tier_breakdown"]:
        lines.append(f"  Bậc {t['tier']} ({t['range_label']}): {t['kwh']} kWh × {t['price']:,.0f}đ = {t['amount']:,.0f}đ")

    lines.append("─" * 30)
    lines.append(f"  Tổng tiêu thụ: {bill_data['kwh_consumed']:,.1f} kWh")
    lines.append(f"  Thành tiền: {bill_data['subtotal']:,.0f}đ")
    lines.append(f"  VAT ({bill_data['vat_rate']}%): {bill_data['vat_amount']:,.0f}đ")
    lines.append(f"  💰 TỔNG CỘNG: {bill_data['total_amount']:,.0f}đ")

    return "\n".join(lines)
