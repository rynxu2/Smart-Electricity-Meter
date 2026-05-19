-- Migration: Add device diagnostic columns + update status constraint
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)

-- Step 1: Drop old CHECK constraint
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_status_check;

-- Step 2: Migrate existing status values FIRST (before adding new constraint)
UPDATE devices SET status = 'online' WHERE status = 'active';
UPDATE devices SET status = 'offline' WHERE status = 'inactive';

-- Step 3: Change default status from 'active' to 'offline'
ALTER TABLE devices ALTER COLUMN status SET DEFAULT 'offline';

-- Step 4: NOW add new CHECK constraint (all rows are already valid)
ALTER TABLE devices ADD CONSTRAINT devices_status_check
  CHECK (status IN ('online', 'offline', 'maintenance'));

-- Step 5: Add diagnostic columns
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS wifi_rssi int4 DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS uptime_ms int8 DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS free_heap int4 DEFAULT NULL;

-- Step 6: Documentation
COMMENT ON COLUMN devices.wifi_rssi IS 'WiFi signal strength in dBm (from ESP32 heartbeat)';
COMMENT ON COLUMN devices.uptime_ms IS 'ESP32 uptime in milliseconds';
COMMENT ON COLUMN devices.free_heap IS 'ESP32 free heap memory in bytes';
