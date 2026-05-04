"use client";

import { useState } from "react";
import { Bell, CheckCircle, Filter, AlertTriangle, Zap, Moon, Radio, ShieldAlert } from "lucide-react";

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  device: string;
  time: string;
  isRead: boolean;
}

const DEMO_ALERTS: Alert[] = [
  { id: "1", type: "spike", severity: "high", title: "⚡ Tiêu thụ điện bất thường", message: "Mức tiêu thụ hiện tại (45.2 kWh) cao gấp 3.1 lần trung bình 7 ngày (14.6 kWh).", device: "Công tơ #003", time: "15 phút trước", isRead: false },
  { id: "2", type: "reverse_flow", severity: "critical", title: "🚨 Nghi ngờ gian lận điện", message: "Chỉ số công tơ giảm từ 22145.8 xuống 22100.2. Nghi ngờ có can thiệp vào công tơ điện.", device: "Công tơ #005", time: "1 giờ trước", isRead: false },
  { id: "3", type: "night_spike", severity: "medium", title: "🌙 Tiêu thụ đêm cao bất thường", message: "Tiêu thụ điện ban đêm (22h-5h) chiếm 65% tổng ngày.", device: "Công tơ #007", time: "2 giờ trước", isRead: false },
  { id: "4", type: "zero_usage", severity: "medium", title: "🔌 Mất tín hiệu thiết bị", message: "Không nhận được dữ liệu tiêu thụ trong 24 giờ qua.", device: "Công tơ #011", time: "5 giờ trước", isRead: true },
  { id: "5", type: "spike", severity: "high", title: "⚡ Tiêu thụ bất thường", message: "Tiêu thụ tăng đột biến vào lúc 14:30.", device: "Công tơ #002", time: "1 ngày trước", isRead: true },
];

const severityColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#3b82f6",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(DEMO_ALERTS);
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? alerts : filter === "unread" ? alerts.filter((a) => !a.isRead) : alerts.filter((a) => a.severity === filter);

  const markAllRead = () => setAlerts(alerts.map((a) => ({ ...a, isRead: true })));

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>🔔 Cảnh báo</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {alerts.filter((a) => !a.isRead).length} cảnh báo chưa đọc
          </p>
        </div>
        <button className="btn btn-primary" onClick={markAllRead}>
          <CheckCircle size={14} /> Đánh dấu tất cả đã đọc
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {["all", "unread", "critical", "high", "medium"].map((f) => (
          <button
            key={f}
            className={`btn ${filter === f ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter(f)}
            style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}
          >
            {f === "all" ? "Tất cả" : f === "unread" ? "Chưa đọc" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Alert Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {filtered.map((alert) => (
          <div
            key={alert.id}
            className="card"
            style={{
              padding: "1.25rem",
              borderLeft: `3px solid ${severityColors[alert.severity]}`,
              opacity: alert.isRead ? 0.6 : 1,
              cursor: "pointer",
            }}
            onClick={() => setAlerts(alerts.map((a) => (a.id === alert.id ? { ...a, isRead: true } : a)))}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{alert.title}</span>
                  {!alert.isRead && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-primary)", display: "inline-block" }} />}
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.75rem", lineHeight: 1.5 }}>
                  {alert.message}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.75rem" }}>
                  <span className={`badge ${alert.severity === "critical" ? "badge-red" : alert.severity === "high" ? "badge-amber" : "badge-blue"}`}>
                    {alert.severity}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>{alert.device}</span>
                  <span style={{ color: "var(--text-muted)" }}>{alert.time}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
