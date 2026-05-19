"""Background task to detect offline devices based on heartbeat timeout."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


class DeviceMonitor:
    """Periodically checks device heartbeats and marks stale ones as offline."""

    def __init__(self, supabase_client, timeout_seconds: int = 300, interval_seconds: int = 30):
        self.db = supabase_client
        self.timeout = timeout_seconds
        self.interval = interval_seconds
        self._task: asyncio.Task | None = None

    def start(self):
        """Start the background monitoring loop."""
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info(
            f"DeviceMonitor started (timeout={self.timeout}s, interval={self.interval}s)"
        )

    async def stop(self):
        """Stop the background monitoring loop."""
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            logger.info("DeviceMonitor stopped")

    async def _monitor_loop(self):
        """Main loop: check for stale devices every interval."""
        while True:
            try:
                await self._check_stale_devices()
            except Exception as e:
                logger.error(f"DeviceMonitor error: {e}", exc_info=True)

            await asyncio.sleep(self.interval)

    async def _check_stale_devices(self):
        """Find devices whose last_seen_at exceeds timeout and mark them offline."""
        cutoff = (datetime.now(timezone.utc) - timedelta(seconds=self.timeout)).isoformat()

        # Find online devices that haven't sent a heartbeat since cutoff
        result = (
            self.db.table("devices")
            .select("id, last_seen_at")
            .eq("status", "online")
            .lt("last_seen_at", cutoff)
            .execute()
        )

        stale_devices = result.data or []

        if not stale_devices:
            return

        # Mark all stale devices as offline in one batch
        stale_ids = [d["id"] for d in stale_devices]
        for device_id in stale_ids:
            self.db.table("devices").update(
                {"status": "offline"}
            ).eq("id", device_id).execute()

        logger.warning(
            f"Marked {len(stale_ids)} device(s) as offline: {stale_ids}"
        )
