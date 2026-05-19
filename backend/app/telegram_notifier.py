"""Telegram Bot notification service for alerts and reports."""

from __future__ import annotations

import logging
from telegram import Bot
from telegram.constants import ParseMode

logger = logging.getLogger(__name__)


class TelegramNotifier:
    """Send notifications via Telegram Bot API."""

    def __init__(self, bot_token: str, default_chat_id: str):
        self.bot = Bot(token=bot_token) if bot_token else None
        self.default_chat_id = default_chat_id

    async def send_alert(self, alert: dict, chat_id: str | None = None) -> bool:
        """Send anomaly alert notification."""
        if not self.bot:
            logger.warning("Telegram bot not configured, skipping notification")
            return False

        target = chat_id or self.default_chat_id
        if not target:
            logger.warning("No chat_id configured for notification")
            return False

        severity_emoji = {
            "low": "ℹ️",
            "medium": "⚠️",
            "high": "🔶",
            "critical": "🚨",
        }

        emoji = severity_emoji.get(alert.get("severity", ""), "📢")
        text = (
            f"{emoji} *{alert['title']}*\n\n"
            f"{alert['message']}\n\n"
            f"Mức độ: *{alert.get('severity', 'N/A').upper()}*\n"
            f"Loại: `{alert.get('alert_type', 'N/A')}`"
        )

        try:
            await self.bot.send_message(
                chat_id=target,
                text=text,
                parse_mode=ParseMode.MARKDOWN,
            )
            logger.info(f"Alert sent to Telegram chat {target}")
            return True
        except Exception as e:
            logger.error(f"Telegram send failed: {e}")
            return False

    async def send_bill_report(self, bill_text: str, chat_id: str | None = None) -> bool:
        """Send monthly bill report."""
        if not self.bot:
            return False

        target = chat_id or self.default_chat_id
        try:
            await self.bot.send_message(
                chat_id=target,
                text=bill_text,
                parse_mode=ParseMode.MARKDOWN,
            )
            return True
        except Exception as e:
            logger.error(f"Telegram bill report failed: {e}")
            return False

    async def send_reading_update(self, device_name: str, reading_value: float, source: str, chat_id: str | None = None) -> bool:
        """Send meter reading update notification."""
        if not self.bot:
            return False

        target = chat_id or self.default_chat_id
        source_label = {"ocr": "📷 Camera OCR", "manual": "✏️ Nhập tay"}
        text = (
            f"📊 *Cập nhật chỉ số điện*\n\n"
            f"Công tơ: *{device_name}*\n"
            f"Chỉ số: *{reading_value:,.2f}* kWh\n"
            f"Nguồn: {source_label.get(source, source)}"
        )

        try:
            await self.bot.send_message(chat_id=target, text=text, parse_mode=ParseMode.MARKDOWN)
            return True
        except Exception as e:
            logger.error(f"Telegram reading update failed: {e}")
            return False
