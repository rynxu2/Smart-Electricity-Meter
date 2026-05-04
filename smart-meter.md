# Công Tơ Điện Thông Minh - Đọc Chỉ Số Từ Xa

## Goal
Thiết kế hệ thống IoT gắn vào công tơ điện cơ truyền thống để tự động đọc số và truyền dữ liệu lên cloud. Kết hợp ESP32-CAM (OCR) + cảm biến quang (đếm xung) để đảm bảo độ chính xác.

## Project Type
**IoT Full-Stack** (Hardware + Backend + Frontend)

## Success Criteria
- [ ] ESP32-CAM chụp ảnh công tơ → Server nhận dạng chữ số chính xác ≥ 90%
- [ ] Cảm biến quang đếm xung → Tính kWh tiêu thụ real-time
- [ ] Dashboard hiển thị chỉ số, biểu đồ, cảnh báo
- [ ] Tính tiền điện tự động theo bậc thang giá VN
- [ ] Cảnh báo bất thường qua Zalo

---

## Tech Stack

| Layer | Technology | Lý do |
|-------|-----------|-------|
| **MCU** | ESP32-CAM + ESP32 | Camera tích hợp, WiFi, GPIO cho cảm biến quang |
| **Protocol** | MQTT (HiveMQ Cloud free) | Lightweight, real-time, chuẩn IoT, QoS support |
| **Backend** | FastAPI (Python) | Async, OCR processing (EasyOCR), MQTT subscriber |
| **Database** | Supabase (PostgreSQL) | Free tier, Realtime subscriptions, Auth tích hợp |
| **Frontend** | Next.js 14 (App Router) | SSR, real-time updates, responsive dashboard |
| **OCR** | EasyOCR / PaddleOCR | Nhận dạng chữ số tiếng Việt, chạy trên server |
| **Alert** | Zalo OA API (ZNS) | Phổ biến VN, gửi thông báo qua Zalo |

---

## Architecture

```
┌─────────────────────┐     MQTT      ┌──────────────────┐
│  ESP32-CAM          │──────────────→│  HiveMQ Broker   │
│  + IR Sensor        │   (images +   │  (Cloud Free)    │
│  + Photodiode       │    pulses)    └────────┬─────────┘
└─────────────────────┘                        │
                                               ▼
                                    ┌──────────────────┐
                                    │  FastAPI Server   │
                                    │  - MQTT Subscribe │
                                    │  - EasyOCR        │
                                    │  - Anomaly Detect │
                                    │  - Bill Calculate │
                                    │  - Zalo Alert     │
                                    └────────┬─────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                        ┌──────────┐  ┌──────────┐  ┌──────────┐
                        │ Supabase │  │ Next.js  │  │ Zalo OA  │
                        │ (DB)     │  │Dashboard │  │ (Alert)  │
                        └──────────┘  └──────────┘  └──────────┘
```

---

## File Structure

```
Smart-Electricity-Meter/
├── firmware/                    # ESP32 Arduino code
│   ├── smart_meter/
│   │   ├── smart_meter.ino      # Main firmware
│   │   ├── camera.h             # Camera capture module
│   │   ├── mqtt_client.h        # MQTT connection
│   │   ├── pulse_counter.h      # IR sensor pulse counting
│   │   ├── config.h             # WiFi, MQTT, device config
│   │   └── led_status.h         # Status LED indicators
│   └── README.md
│
├── backend/                     # FastAPI server
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Environment config
│   │   ├── mqtt_handler.py      # MQTT subscriber + message handler
│   │   ├── ocr_service.py       # EasyOCR image processing
│   │   ├── anomaly_detector.py  # Anomaly detection logic
│   │   ├── bill_calculator.py   # Vietnam tiered pricing
│   │   ├── zalo_notifier.py     # Zalo OA API integration
│   │   ├── models.py            # Pydantic models
│   │   └── routers/
│   │       ├── meters.py        # Meter CRUD endpoints
│   │       ├── readings.py      # Reading history endpoints
│   │       ├── bills.py         # Bill calculation endpoints
│   │       └── alerts.py        # Alert endpoints
│   ├── requirements.txt
│   └── README.md
│
├── frontend/                    # Next.js dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx         # Dashboard home
│   │   │   ├── meters/          # Meter management
│   │   │   ├── readings/        # Reading history
│   │   │   ├── bills/           # Bill calculation
│   │   │   └── alerts/          # Alert management
│   │   ├── components/
│   │   │   ├── charts/          # Recharts components
│   │   │   ├── ui/              # Shared UI components
│   │   │   └── layout/          # Layout components
│   │   └── lib/
│   │       ├── supabase.ts      # Supabase client
│   │       └── api.ts           # API client
│   └── package.json
│
├── database/                    # Supabase schema
│   └── schema.sql               # Tables + RLS policies
│
├── docs/                        # Documentation
│   ├── hardware-setup.md        # Wiring diagram + assembly
│   ├── api-docs.md              # API documentation
│   └── deploy-guide.md          # Deployment guide
│
├── smart-meter.md               # This plan file
└── README.md                    # Project overview
```

---

## Database Schema (Supabase)

```sql
-- Devices (công tơ)
devices: id, name, location, meter_serial, esp_mac_address, status, created_at

-- Readings (chỉ số đọc được)
readings: id, device_id, ocr_value, pulse_kwh, image_url, confidence, read_at

-- Bills (hóa đơn)
bills: id, device_id, period_start, period_end, kwh_consumed, total_amount, tier_breakdown, created_at

-- Alerts (cảnh báo)
alerts: id, device_id, type(theft|leak|abnormal), severity, message, is_read, created_at
```

---

## Bậc Thang Giá Điện Việt Nam (2024)

| Bậc | kWh | Đơn giá (VNĐ/kWh) |
|-----|-----|---------------------|
| 1 | 0-50 | 1,893 |
| 2 | 51-100 | 1,956 |
| 3 | 101-200 | 2,271 |
| 4 | 201-300 | 2,860 |
| 5 | 301-400 | 3,197 |
| 6 | >400 | 3,302 |

*+ VAT 8%*

---

## Task Breakdown

### Phase 1: Foundation (Database + Backend Core)
**Agent:** `backend-specialist` | **Skills:** `database-design`, `api-patterns`

- [ ] **T1:** Tạo Supabase project + schema.sql → Verify: tables hiển thị trên Supabase dashboard
- [ ] **T2:** Setup FastAPI project (main.py, config.py, models.py) → Verify: `uvicorn` chạy, `/docs` hiển thị
- [ ] **T3:** Implement MQTT handler (subscribe topics từ ESP32) → Verify: nhận message test từ MQTT Explorer
- [ ] **T4:** Implement OCR service (EasyOCR nhận dạng số từ ảnh) → Verify: test với 5 ảnh mẫu công tơ, accuracy ≥ 90%

### Phase 2: Business Logic
**Agent:** `backend-specialist` | **Skills:** `python-patterns`

- [ ] **T5:** Implement bill_calculator.py (6 bậc giá + VAT) → Verify: unit test với các mốc kWh
- [ ] **T6:** Implement anomaly_detector.py (spike detection, zero-usage) → Verify: unit test với dữ liệu giả
- [ ] **T7:** Implement Zalo notifier (ZNS API) → Verify: gửi test notification thành công
- [ ] **T8:** Implement REST API routers (meters, readings, bills, alerts) → Verify: test tất cả endpoints qua `/docs`

### Phase 3: Firmware (ESP32)
**Agent:** `backend-specialist` | **Skills:** `clean-code`

- [ ] **T9:** Setup ESP32-CAM firmware (WiFi + MQTT connect) → Verify: connect MQTT broker thành công
- [ ] **T10:** Camera capture module (chụp ảnh, encode base64, gửi MQTT) → Verify: server nhận ảnh
- [ ] **T11:** Pulse counter module (IR sensor interrupt, đếm kWh) → Verify: serial monitor hiển thị pulse count
- [ ] **T12:** Scheduling (chụp ảnh mỗi 6h, gửi pulse mỗi 5 phút) → Verify: timing chính xác

### Phase 4: Frontend Dashboard
**Agent:** `frontend-specialist` | **Skills:** `frontend-design`, `react-best-practices`

- [ ] **T13:** Setup Next.js 14 project + Supabase client + UI library → Verify: `npm run dev` chạy
- [ ] **T14:** Dashboard home (tổng quan: số công tơ, kWh hôm nay, alerts) → Verify: hiển thị dữ liệu
- [ ] **T15:** Meter detail page (chỉ số, ảnh OCR, biểu đồ tiêu thụ) → Verify: chart render đúng
- [ ] **T16:** Bill calculation page (tính tiền theo bậc, history) → Verify: tính đúng theo bậc thang
- [ ] **T17:** Alert management page (list, mark read, filter) → Verify: realtime alert hiển thị
- [ ] **T18:** Responsive design + dark mode → Verify: mobile + desktop đều OK

### Phase 5: Integration & Demo
- [ ] **T19:** End-to-end test: ESP32 → MQTT → FastAPI → Supabase → Dashboard
- [ ] **T20:** Tạo demo data + documentation (README, hardware-setup, api-docs)

---

## Anomaly Detection Logic

```
1. Spike Detection: usage_current > 2 × avg_7_days → alert "Tiêu thụ bất thường"
2. Zero Usage: 24h không có pulse → alert "Có thể mất điện hoặc lỗi thiết bị"  
3. Reverse Flow: ocr_new < ocr_old → alert "Nghi ngờ gian lận điện"
4. Night Spike: usage_22h_05h > 50% daily → alert "Tiêu thụ đêm cao bất thường"
```

---

## Phase X: Verification

- [ ] Backend API: tất cả endpoints trả đúng response
- [ ] OCR accuracy ≥ 90% trên 10 ảnh test
- [ ] Bill calculation: unit test pass cho tất cả bậc giá
- [ ] Dashboard: responsive, hiển thị realtime data
- [ ] MQTT: ESP32 ↔ Server giao tiếp ổn định
- [ ] Zalo alert: gửi notification thành công
- [ ] Security: API key, MQTT credentials không hardcode
- [ ] Documentation: README + hardware setup + API docs hoàn chỉnh
