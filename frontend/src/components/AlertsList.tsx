"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Zap, Moon, Radio } from "lucide-react";
import { apiFetch } from "@/lib/supabase";

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  created_at: string;
}

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

export default function AlertsList() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Alert[]>("/alerts/?limit=5")
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>Đang tải...</div>;
  }

  if (alerts.length === 0) {
    return <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>Không có cảnh báo</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {alerts.map((alert) => (
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
            {typeIcons[alert.alert_type] || <AlertTriangle size={14} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.25rem" }}>
              {alert.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className={`badge ${severityClass[alert.severity]}`}>{alert.severity}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{timeAgo(alert.created_at)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
