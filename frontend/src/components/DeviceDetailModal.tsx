"use client";

import { useState, useEffect } from "react";
import { X, MapPin, Wifi, WifiOff, Settings, Save, Loader2, Trash2, Gauge, Calendar, Hash } from "lucide-react";
import { apiFetch } from "@/lib/supabase";

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

interface Props {
  device: Device;
  onClose: () => void;
  onUpdated: (updated: Device) => void;
  onDeleted: (id: string) => void;
}

const statusOptions = [
  { value: "online", label: "Online", badge: "badge-green" },
  { value: "offline", label: "Offline", badge: "badge-red" },
  { value: "maintenance", label: "Bảo trì", badge: "badge-amber" },
];

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("vi-VN");
}

export default function DeviceDetailModal({ device, onClose, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: device.name, location: device.location || "", status: device.status });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<Device>(`/devices/${device.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          location: form.location.trim() || undefined,
          status: form.status,
        }),
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi cập nhật");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/devices/${device.id}`, { method: "DELETE" });
      onDeleted(device.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi xóa thiết bị");
      setDeleting(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-active)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px var(--accent-primary-glow)", animation: "modalIn 0.2s ease-out", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="stat-icon green" style={{ width: 36, height: 36 }}><Gauge size={16} /></div>
            <div>
              <div style={{ fontWeight: 600 }}>{device.name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{device.meter_serial}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem" }}>
          {editing ? (
            /* Edit Form */
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.375rem" }}>Tên công tơ</label>
                <input className="input" style={{ width: "100%" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.375rem" }}>Vị trí</label>
                <input className="input" style={{ width: "100%" }} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.375rem" }}>Trạng thái</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {statusOptions.map((opt) => (
                    <button key={opt.value} className={`btn ${form.status === opt.value ? "btn-primary" : "btn-ghost"}`} onClick={() => setForm({ ...form, status: opt.value })} style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Detail View */
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <InfoRow icon={<Hash size={14} />} label="ID" value={device.id} mono />
              <InfoRow icon={<Gauge size={14} />} label="Serial" value={device.meter_serial} mono />
              <InfoRow icon={<MapPin size={14} />} label="Vị trí" value={device.location || "Chưa cài đặt"} />
              <InfoRow icon={<Wifi size={14} />} label="MAC Address" value={device.esp_mac_address || "—"} mono />
              <InfoRow icon={<Settings size={14} />} label="Trạng thái" value={
                <span className={`badge ${statusOptions.find((s) => s.value === device.status)?.badge || "badge-red"}`}>
                  {statusOptions.find((s) => s.value === device.status)?.label || device.status}
                </span>
              } />
              <InfoRow icon={<Calendar size={14} />} label="Hoạt động lần cuối" value={formatDate(device.last_seen_at)} />
              <InfoRow icon={<Calendar size={14} />} label="Ngày đăng ký" value={formatDate(device.created_at)} />
            </div>
          )}

          {error && (
            <div style={{ marginTop: "1rem", padding: "0.625rem 0.875rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", color: "#f87171" }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "1rem 1.5rem", borderTop: "1px solid var(--border-subtle)" }}>
          <div>
            {!editing && !confirmDelete && (
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)} style={{ color: "var(--accent-danger)", fontSize: "0.75rem" }}>
                <Trash2 size={13} /> Xóa
              </button>
            )}
            {confirmDelete && (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--accent-danger)" }}>Xác nhận xóa?</span>
                <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)} style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}>Hủy</button>
                <button className="btn" onClick={handleDelete} disabled={deleting} style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", background: "var(--accent-danger)", color: "#fff" }}>
                  {deleting ? "Đang xóa..." : "Xóa"}
                </button>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {editing ? (
              <>
                <button className="btn btn-ghost" onClick={() => { setEditing(false); setForm({ name: device.name, location: device.location || "", status: device.status }); }} disabled={saving}>Hủy</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 100 }}>
                  {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Lưu...</> : <><Save size={14} /> Lưu</>}
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setEditing(true)}>Chỉnh sửa</button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: "0.8rem", fontWeight: 500, fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit", color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}
