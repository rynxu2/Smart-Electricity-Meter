-- ============================================
-- Migration: UUID → TEXT for device IDs
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Drop dependent foreign keys first
ALTER TABLE readings DROP CONSTRAINT IF EXISTS readings_device_id_fkey;
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_device_id_fkey;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_device_id_fkey;
ALTER TABLE device_settings DROP CONSTRAINT IF EXISTS device_settings_device_id_fkey;

-- 2. Change devices.id from UUID to TEXT
ALTER TABLE devices ALTER COLUMN id SET DEFAULT NULL;
ALTER TABLE devices ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE devices ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

-- 3. Change all device_id foreign key columns
ALTER TABLE readings ALTER COLUMN device_id TYPE TEXT USING device_id::TEXT;
ALTER TABLE bills ALTER COLUMN device_id TYPE TEXT USING device_id::TEXT;
ALTER TABLE alerts ALTER COLUMN device_id TYPE TEXT USING device_id::TEXT;
ALTER TABLE device_settings ALTER COLUMN device_id TYPE TEXT USING device_id::TEXT;

-- 4. Change all id (primary key) columns to TEXT
ALTER TABLE readings ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE readings ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

ALTER TABLE bills ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE bills ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

ALTER TABLE alerts ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE alerts ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

ALTER TABLE device_settings ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE device_settings ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

-- 5. Re-add foreign key constraints
ALTER TABLE readings ADD CONSTRAINT readings_device_id_fkey
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;

ALTER TABLE bills ADD CONSTRAINT bills_device_id_fkey
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;

ALTER TABLE alerts ADD CONSTRAINT alerts_device_id_fkey
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;

ALTER TABLE device_settings ADD CONSTRAINT device_settings_device_id_fkey
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;
