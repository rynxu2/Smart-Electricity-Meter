"use client";

import { useEffect, useState, useCallback } from "react";
import { Gauge, Plus, MapPin, Wifi, WifiOff, Settings, Eye, X, Loader2, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/supabase";
import DeviceDetailModal from "@/components/DeviceDetailModal";
import DeviceSettingsModal from "@/components/DeviceSettingsModal";

interface Device {
  id: string;
  name: string;
  location: string;
  meter_serial: string;
  esp_mac_address: string;
  status: string;
  last_seen_at?: string;
  created_at: string;
}

interface NewDeviceForm {
  name: string;
  location: string;
  meter_serial: string;
  esp_mac_address: string;
}

const EMPTY_FORM: NewDeviceForm = { name: "", location: "", meter_serial: "", esp_mac_address: "" };

const statusConfig: Record<string, { label: string; badge: string; icon: typeof Wifi }> = {
  active: { label: "Hoạt động", badge: "badge-green", icon: Wifi },
  inactive: { label: "Offline", badge: "badge-red", icon: WifiOff },
  maintenance: { label: "Bảo trì", badge: "badge-amber", icon: Settings },
};

export default function MetersPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewDeviceForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [detailDevice, setDetailDevice] = useState<Device | null>(null);
  const [settingsDevice, setSettingsDevice] = useState<Device | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const data = await apiFetch<Device[]>("/devices/");
      setDevices(data);
    } catch {
      // API unavailable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const filtered = devices.filter((d) => {
    const matchSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.location || "").toLowerCase().includes(search.toLowerCase()) ||
      d.meter_serial.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openModal = () => {
    setForm(EMPTY_FORM);
    setSubmitError("");
    setSubmitSuccess(false);
    setShowModal(true);
  };

  const closeModal = () => {
    if (!submitting) setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!form.name.trim() || !form.meter_serial.trim()) {
      setSubmitError("Tên công tơ và số serial là bắt buộc.");
      return;
    }

    setSubmitting(true);
    try {
      const newDevice = await apiFetch<Device>("/devices/", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          location: form.location.trim() || null,
          meter_serial: form.meter_serial.trim(),
          esp_mac_address: form.esp_mac_address.trim() || null,
        }),
      });

      setDevices((prev) => [newDevice, ...prev]);
      setSubmitSuccess(true);

      setTimeout(() => {
        setShowModal(false);
        setSubmitSuccess(false);
      }, 1200);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Lỗi khi thêm công tơ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof NewDeviceForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (submitError) setSubmitError("");
  };

  const activeCount = devices.filter((d) => d.status === "active").length;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>📊 Quản lý công tơ</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {devices.length} thiết bị · {activeCount} đang hoạt động
          </p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          <Plus size={14} /> Thêm công tơ
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <input
          className="input"
          placeholder="Tìm kiếm theo tên, vị trí, serial..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 320 }}
        />
        {["all", "active", "inactive", "maintenance"].map((s) => (
          <button
            key={s}
            className={`btn ${statusFilter === s ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setStatusFilter(s)}
            style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}
          >
            {s === "all" ? "Tất cả" : statusConfig[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Device Grid */}
      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
          <Gauge size={40} style={{ color: "var(--text-muted)", marginBottom: "0.75rem" }} />
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Chưa có công tơ nào</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>Nhấn &quot;Thêm công tơ&quot; để đăng ký thiết bị mới</div>
          <button className="btn btn-primary" onClick={openModal}>
            <Plus size={14} /> Thêm công tơ
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "1rem" }}>
          {filtered.map((device) => {
            const config = statusConfig[device.status] || statusConfig.inactive;
            const StatusIcon = config.icon;
            return (
              <div key={device.id} className="card" style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div className="stat-icon green" style={{ width: 40, height: 40 }}>
                      <Gauge size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{device.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{device.meter_serial}</div>
                    </div>
                  </div>
                  <span className={`badge ${config.badge}`}>
                    <StatusIcon size={10} /> {config.label}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)" }}>
                    <MapPin size={13} /> {device.location || "Chưa cài đặt"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>MAC Address</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem" }}>{device.esp_mac_address || "—"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.75rem", justifyContent: "center" }} onClick={() => setDetailDevice(device)}>
                    <Eye size={13} /> Chi tiết
                  </button>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.75rem", justifyContent: "center" }} onClick={() => setSettingsDevice(device)}>
                    <Settings size={13} /> Cấu hình
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Device Modal ── */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border-active)",
              borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 480,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px var(--accent-primary-glow)",
              animation: "modalIn 0.2s ease-out",
            }}
          >
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="stat-icon green" style={{ width: 36, height: 36 }}>
                  <Plus size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "1rem" }}>Thêm công tơ mới</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Đăng ký thiết bị đo điện</div>
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, borderRadius: "var(--radius-sm)", display: "flex", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <X size={18} />
              </button>
            </div>

            {submitSuccess ? (
              <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                <CheckCircle2 size={48} style={{ color: "var(--accent-primary)", marginBottom: "0.75rem" }} />
                <div style={{ fontWeight: 600, fontSize: "1.1rem", marginBottom: "0.25rem" }}>Thêm thành công!</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Công tơ đã được đăng ký vào hệ thống</div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.375rem" }}>
                      Tên công tơ <span style={{ color: "var(--accent-danger)" }}>*</span>
                    </label>
                    <input className="input" style={{ width: "100%" }} placeholder="VD: Công tơ #012" value={form.name} onChange={(e) => updateField("name", e.target.value)} autoFocus required maxLength={100} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.375rem" }}>
                      Số serial <span style={{ color: "var(--accent-danger)" }}>*</span>
                    </label>
                    <input className="input" style={{ width: "100%", fontFamily: "'JetBrains Mono', monospace" }} placeholder="VD: EV-2024-012" value={form.meter_serial} onChange={(e) => updateField("meter_serial", e.target.value)} required maxLength={50} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.375rem" }}>Vị trí lắp đặt</label>
                    <input className="input" style={{ width: "100%" }} placeholder="VD: Tòa A - Tầng 2 - Phòng 201" value={form.location} onChange={(e) => updateField("location", e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.375rem" }}>MAC Address (ESP32)</label>
                    <input className="input" style={{ width: "100%", fontFamily: "'JetBrains Mono', monospace" }} placeholder="VD: AA:BB:CC:DD:05:01" value={form.esp_mac_address} onChange={(e) => updateField("esp_mac_address", e.target.value)} />
                  </div>
                </div>

                {submitError && (
                  <div style={{ marginTop: "1rem", padding: "0.625rem 0.875rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", color: "#f87171" }}>
                    {submitError}
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={submitting}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 120 }}>
                    {submitting ? (<><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Đang lưu...</>) : (<><Plus size={14} /> Thêm công tơ</>)}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailDevice && (
        <DeviceDetailModal
          device={detailDevice}
          onClose={() => setDetailDevice(null)}
          onUpdated={(updated) => {
            setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            setDetailDevice(updated);
          }}
          onDeleted={(id) => {
            setDevices((prev) => prev.filter((d) => d.id !== id));
            setDetailDevice(null);
          }}
        />
      )}

      {/* Settings Modal */}
      {settingsDevice && (
        <DeviceSettingsModal
          deviceId={settingsDevice.id}
          deviceName={settingsDevice.name}
          onClose={() => setSettingsDevice(null)}
        />
      )}

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
