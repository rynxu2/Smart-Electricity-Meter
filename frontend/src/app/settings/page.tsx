"use client";

import { useState } from "react";
import { Settings, Wifi, Bot, Clock, Bell, Save, TestTube } from "lucide-react";

export default function SettingsPage() {
  const [mqttHost, setMqttHost] = useState("broker.hivemq.com");
  const [mqttPort, setMqttPort] = useState("1883");
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [captureInterval, setCaptureInterval] = useState("6");
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>⚙️ Cài đặt hệ thống</h1>
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Cấu hình MQTT, Telegram Bot và các thông số thiết bị
      </p>

      {/* MQTT Settings */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
        <div className="section-title" style={{ marginBottom: "1rem" }}>
          <Wifi size={16} /> Cấu hình MQTT Broker
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.375rem" }}>
              Broker Host
            </label>
            <input className="input" value={mqttHost} onChange={(e) => setMqttHost(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.375rem" }}>
              Port
            </label>
            <input className="input" value={mqttPort} onChange={(e) => setMqttPort(e.target.value)} style={{ width: "100%" }} />
          </div>
        </div>
      </div>

      {/* Telegram Settings */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
        <div className="section-title" style={{ marginBottom: "1rem" }}>
          <Bot size={16} /> Cấu hình Telegram Bot
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.375rem" }}>
              Bot Token (từ @BotFather)
            </label>
            <input className="input" type="password" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" value={telegramToken} onChange={(e) => setTelegramToken(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.375rem" }}>
              Chat ID
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input className="input" placeholder="-100123456789" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-ghost">
                <TestTube size={13} /> Test
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Device Timing */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
        <div className="section-title" style={{ marginBottom: "1rem" }}>
          <Clock size={16} /> Chu kỳ đọc dữ liệu
        </div>
        <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.375rem" }}>
              Chụp ảnh OCR (giờ)
            </label>
            <input className="input" type="number" min={1} max={24} value={captureInterval} onChange={(e) => setCaptureInterval(e.target.value)} style={{ width: "100%" }} />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Mặc định: 6 giờ/lần</span>
          </div>
      </div>

      {/* Alert Settings */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div className="section-title" style={{ marginBottom: "1rem" }}>
          <Bell size={16} /> Cảnh báo
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={alertEnabled}
            onChange={(e) => setAlertEnabled(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent-primary)" }}
          />
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Bật cảnh báo qua Telegram</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Gửi thông báo khi phát hiện tiêu thụ bất thường, mất tín hiệu, hoặc nghi ngờ gian lận
            </div>
          </div>
        </label>
      </div>

      {/* Save Button */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
        {saved && (
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--accent-primary)" }}>
            ✓ Đã lưu thành công
          </span>
        )}
        <button className="btn btn-primary" onClick={handleSave} style={{ padding: "0.625rem 1.5rem" }}>
          <Save size={14} /> Lưu cài đặt
        </button>
      </div>
    </div>
  );
}
