"use client";

import { AlertTriangle, Zap, Moon, Radio } from "lucide-react";

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  time: string;
}

const DEMO_ALERTS: Alert[] = [
  { id: "1", type: "spike", severity: "high", title: "Tiêu thụ bất thường - Công tơ #003", time: "15 phút trước" },
  { id: "2", type: "night_spike", severity: "medium", title: "Tiêu thụ đêm cao - Công tơ #007", time: "2 giờ trước" },
  { id: "3", type: "zero_usage", severity: "medium", title: "Mất tín hiệu - Công tơ #011", time: "5 giờ trước" },
];

const typeIcons: Record<string, React.ReactNode> = {
  spike: <Zap size={14} />,
  night_spike: <Moon size={14} />,
  zero_usage: <Radio size={14} />,
  reverse_flow: <AlertTriangle size={14} />,
};

const severityClass: Record<string, string> = {
  critical: "badge-red",
  high: "badge-amber",
  medium: "badge-blue",
  low: "badge-green",
};

export default function AlertsList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {DEMO_ALERTS.map((alert) => (
        <div
          key={alert.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            padding: "0.75rem",
            borderRadius: "var(--radius-md)",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border-subtle)",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
        >
          <div className={`severity-${alert.severity}`} style={{ marginTop: 2 }}>
            {typeIcons[alert.type] || <AlertTriangle size={14} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.25rem" }}>
              {alert.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className={`badge ${severityClass[alert.severity]}`}>{alert.severity}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{alert.time}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
