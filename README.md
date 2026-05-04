# ⚡ Công Tơ Điện Thông Minh - Đọc Chỉ Số Từ Xa

> Hệ thống IoT đọc chỉ số công tơ điện cơ từ xa bằng ESP32-CAM + cảm biến quang, truyền dữ liệu qua MQTT, xử lý OCR trên server, hiển thị dashboard real-time.

## 📐 Kiến trúc hệ thống

```
ESP32-CAM + IR Sensor  →  MQTT Broker  →  FastAPI Server  →  Supabase DB
                                              ↓                    ↓
                                        EasyOCR + Anomaly    Next.js Dashboard
                                              ↓
                                        Telegram Bot Alert
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Hardware | ESP32-CAM, IR Photodiode |
| Communication | MQTT (HiveMQ Cloud) |
| Backend | FastAPI, EasyOCR, Python |
| Database | Supabase (PostgreSQL) |
| Frontend | Next.js 14, Recharts, Tailwind CSS |
| Notification | Telegram Bot API |

## 📦 Cấu trúc dự án

```
├── firmware/          # ESP32-CAM Arduino firmware
├── backend/           # FastAPI server (OCR, MQTT, API)
│   └── app/
│       ├── main.py              # FastAPI entry point
│       ├── mqtt_handler.py      # MQTT subscriber
│       ├── ocr_service.py       # EasyOCR processing
│       ├── bill_calculator.py   # Tính tiền bậc thang VN
│       ├── anomaly_detector.py  # Phát hiện bất thường
│       ├── telegram_notifier.py # Telegram Bot
│       └── routers/             # API endpoints
├── frontend/          # Next.js dashboard
├── database/          # Supabase schema
└── docs/              # Documentation
```

## 🚀 Hướng dẫn cài đặt

### 1. Database (Supabase)
1. Tạo project tại [supabase.com](https://supabase.com)
2. Chạy `database/schema.sql` trong SQL Editor
3. Tạo Storage bucket `meter-images`

### 2. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
cp .env.example .env        # Điền thông tin cấu hình
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # Điền thông tin Supabase
npm run dev
```
Dashboard: http://localhost:3000

### 4. Firmware (ESP32-CAM)
1. Mở `firmware/smart_meter/smart_meter.ino` bằng Arduino IDE
2. Cài board ESP32 và thư viện: PubSubClient, ArduinoJson, esp32-camera
3. Cấu hình WiFi, MQTT trong phần CONFIGURATION
4. Upload lên ESP32-CAM

## 📊 Tính năng

- ✅ **OCR đọc chỉ số**: Camera chụp ảnh → EasyOCR nhận dạng số
- ✅ **Cảm biến quang**: Đếm xung quay đĩa → Tính kWh real-time
- ✅ **Tính tiền tự động**: 6 bậc giá điện VN 2024 + VAT 8%
- ✅ **Phát hiện bất thường**: Spike, zero usage, reverse flow, night spike
- ✅ **Cảnh báo Telegram**: Gửi thông báo qua Telegram Bot
- ✅ **Dashboard**: Biểu đồ tiêu thụ, quản lý công tơ, lịch sử chỉ số

## 🔐 Bảo mật

- Supabase RLS policies cho database
- Environment variables cho secrets
- MQTT credentials (không hardcode)
- CORS configuration trên FastAPI

## 👥 Đồ án môn học

**Đề tài**: Công tơ điện thông minh - Đọc chỉ số từ xa
