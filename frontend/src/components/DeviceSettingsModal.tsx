"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2, Settings, Clock, Bell, MessageCircle } from "lucide-react";
import { apiFetch } from "@/lib/supabase";

interface DeviceSettings {
  id: string;
  device_id: string;
  capture_interval_hours: number;
  telegram_chat_id?: string;
  alert_enabled: boolean;
}

interface Props {
  deviceId: string;
  deviceName: string;
  onClose: () => void;
}

export default function DeviceSettingsModal({ deviceId, deviceName, onClose }: Props) {
  const [settings, setSettings] = useState<DeviceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    capture_interval_hours: 6,
    telegram_chat_id: "",
    alert_enabled: true,
  });

  useEffect(() => {
    apiFetch<DeviceSettings>(`/devices/${deviceId}/settings`)
      .then((data) => {
        setSettings(data);
        setForm({
          capture_interval_hours: data.capture_interval_hours,
          telegram_chat_id: data.telegram_chat_id || "",
          alert_enabled: data.alert_enabled,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được cấu hình"))
      .finally(() => setLoading(false));
  }, [deviceId]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/devices/${deviceId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({
          capture_interval_hours: form.capture_interval_hours,
          telegram_chat_id: form.telegram_chat_id.trim() || null,
          alert_enabled: form.alert_enabled,
        }),
      });
      setSuccess(true);
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi lưu cấu hình");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-active)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px var(--accent-primary-glow)", animation: "modalIn 0.2s ease-out" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="stat-icon amber" style={{ width: 36, height: 36 }}><Settings size={16} /></div>
            <div>
              <div style={{ fontWeight: 600 }}>Cấu hình thiết bị</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{deviceName}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem" }}>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Đang tải cấu hình...</div>
          ) : success ? (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <Settings size={40} style={{ color: "var(--accent-primary)", marginBottom: "0.75rem" }} />
              <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>Đã lưu cấu hình!</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Capture Interval */}
              <SettingField
                icon={<Clock size={14} />}
                label="Chu kỳ chụp ảnh OCR"
                desc="Khoảng thời gian giữa các lần chụp ảnh công tơ"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="number" className="input" style={{ width: 80, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }} value={form.capture_interval_hours} onChange={(e) => setForm({ ...form, capture_interval_hours: Math.max(1, Number(e.target.value)) })} min={1} max={24} />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>giờ</span>
                </div>
              </SettingField>


              {/* Telegram */}
              <SettingField
                icon={<MessageCircle size={14} />}
                label="Telegram Chat ID"
                desc="Gửi cảnh báo đến chat ID riêng"
              >
                <input className="input" style={{ width: 150, fontFamily: "'JetBrains Mono', monospace" }} placeholder="VD: 5859489632" value={form.telegram_chat_id} onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })} />
              </SettingField>

              {/* Alert Toggle */}
              <SettingField
                icon={<Bell size={14} />}
                label="Bật cảnh báo"
                desc="Nhận thông báo khi phát hiện bất thường"
              >
                <button
                  onClick={() => setForm({ ...form, alert_enabled: !form.alert_enabled })}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                    background: form.alert_enabled ? "var(--accent-primary)" : "var(--bg-elevated)",
                    position: "relative", transition: "background 0.2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 2, left: form.alert_enabled ? 22 : 2,
                    width: 20, height: 20, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }} />
                </button>
              </SettingField>

              {error && (
                <div style={{ padding: "0.625rem 0.875rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", color: "#f87171" }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !success && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--border-subtle)" }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Hủy</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 120 }}>
              {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Đang lưu...</> : <><Save size={14} /> Lưu cấu hình</>}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}

function SettingField({ icon, label, desc, children }: { icon: React.ReactNode; label: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 500 }}>
          <span style={{ color: "var(--accent-secondary)" }}>{icon}</span> {label}
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>{desc}</div>
      </div>
      {children}
    </div>
  );
}
