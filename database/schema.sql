-- ============================================
-- Smart Electricity Meter - Supabase Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. DEVICES (Công tơ điện)
-- ============================================
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    meter_serial VARCHAR(50) UNIQUE NOT NULL,
    esp_mac_address VARCHAR(17) UNIQUE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. READINGS (Chỉ số đọc được)
-- ============================================
CREATE TABLE readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    
    -- OCR reading from camera
    ocr_value NUMERIC(10, 2),
    ocr_confidence NUMERIC(5, 2),
    image_url TEXT,
    
    -- Pulse sensor reading
    pulse_count INTEGER DEFAULT 0,
    pulse_kwh NUMERIC(10, 4) DEFAULT 0,
    
    -- Source of reading
    source VARCHAR(10) NOT NULL CHECK (source IN ('ocr', 'pulse', 'manual')),
    
    read_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_readings_device_id ON readings(device_id);
CREATE INDEX idx_readings_read_at ON readings(read_at DESC);
CREATE INDEX idx_readings_device_read ON readings(device_id, read_at DESC);

-- ============================================
-- 3. BILLS (Hóa đơn tiền điện)
-- ============================================
CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    start_reading NUMERIC(10, 2) NOT NULL,
    end_reading NUMERIC(10, 2) NOT NULL,
    kwh_consumed NUMERIC(10, 2) NOT NULL,
    
    -- Tier breakdown (JSONB for flexibility)
    tier_breakdown JSONB NOT NULL DEFAULT '[]',
    -- Example: [{"tier": 1, "kwh": 50, "price": 1893, "amount": 94650}, ...]
    
    subtotal NUMERIC(12, 0) NOT NULL DEFAULT 0,
    vat_rate NUMERIC(4, 2) DEFAULT 8.00,
    vat_amount NUMERIC(12, 0) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 0) NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bills_device_id ON bills(device_id);
CREATE INDEX idx_bills_period ON bills(period_start, period_end);

-- ============================================
-- 4. ALERTS (Cảnh báo bất thường)
-- ============================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('spike', 'zero_usage', 'reverse_flow', 'night_spike', 'device_offline')),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    is_read BOOLEAN DEFAULT FALSE,
    notified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_device_id ON alerts(device_id);
CREATE INDEX idx_alerts_unread ON alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

-- ============================================
-- 5. DEVICE_SETTINGS (Cấu hình thiết bị)
-- ============================================
CREATE TABLE device_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID UNIQUE NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    
    capture_interval_hours INTEGER DEFAULT 6,
    pulse_report_interval_minutes INTEGER DEFAULT 5,
    pulse_per_kwh NUMERIC(8, 2) DEFAULT 1600,
    
    telegram_chat_id VARCHAR(50),
    alert_enabled BOOLEAN DEFAULT TRUE,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. Supabase Storage Bucket (run via Dashboard)
-- ============================================
-- Create bucket: 'meter-images' (public: false)
-- Policy: allow insert from service_role only

-- ============================================
-- 7. RLS Policies
-- ============================================
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_settings ENABLE ROW LEVEL SECURITY;

-- Service role has full access (backend API)
CREATE POLICY "Service role full access" ON devices FOR ALL USING (true);
CREATE POLICY "Service role full access" ON readings FOR ALL USING (true);
CREATE POLICY "Service role full access" ON bills FOR ALL USING (true);
CREATE POLICY "Service role full access" ON alerts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON device_settings FOR ALL USING (true);

-- ============================================
-- 8. Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER device_settings_updated_at
    BEFORE UPDATE ON device_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
