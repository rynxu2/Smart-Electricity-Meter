"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, Zap, Moon, Radio } from "lucide-react";
import { apiFetch } from "@/lib/supabase";

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  device_id: string;
  is_read: boolean;
  created_at: string;
}

const severityColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#3b82f6",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    apiFetch<Alert[]>("/alerts/")
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? alerts : filter === "unread" ? alerts.filter((a) => !a.is_read) : alerts.filter((a) => a.severity === filter);

  const markAllRead = () => setAlerts(alerts.map((a) => ({ ...a, is_read: true })));

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>🔔 Cảnh báo</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {alerts.filter((a) => !a.is_read).length} cảnh báo chưa đọc
          </p>
        </div>
        <button className="btn btn-primary" onClick={markAllRead}>
          <CheckCircle size={14} /> Đánh dấu tất cả đã đọc
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {["all", "unread", "critical", "high", "medium"].map((f) => (
          <button key={f} className={`btn ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)} style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}>
            {f === "all" ? "Tất cả" : f === "unread" ? "Chưa đọc" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>Không có cảnh báo</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filtered.map((alert) => (
            <div key={alert.id} className="card" style={{ padding: "1.25rem", borderLeft: `3px solid ${severityColors[alert.severity] || "#3b82f6"}`, opacity: alert.is_read ? 0.6 : 1, cursor: "pointer" }}
              onClick={() => setAlerts(alerts.map((a) => (a.id === alert.id ? { ...a, is_read: true } : a)))}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{alert.title}</span>
                    {!alert.is_read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-primary)", display: "inline-block" }} />}
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.75rem", lineHeight: 1.5 }}>{alert.message}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.75rem" }}>
                    <span className={`badge ${alert.severity === "critical" ? "badge-red" : alert.severity === "high" ? "badge-amber" : "badge-blue"}`}>{alert.severity}</span>
                    <span style={{ color: "var(--text-muted)" }}>{alert.device_id}</span>
                    <span style={{ color: "var(--text-muted)" }}>{timeAgo(alert.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
