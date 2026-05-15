"use client";

import { useEffect, useState } from "react";
import { Camera, Radio, PenTool, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { apiFetch } from "@/lib/supabase";

interface Reading {
  id: string;
  device_id: string;
  source: string;
  ocr_value?: number;
  pulse_kwh?: number;
  ocr_confidence?: number;
  read_at: string;
}

const sourceConfig: Record<string, { label: string; icon: typeof Camera; badge: string }> = {
  ocr: { label: "Camera OCR", icon: Camera, badge: "badge-green" },
  pulse: { label: "Cảm biến quang", icon: Radio, badge: "badge-blue" },
  manual: { label: "Nhập tay", icon: PenTool, badge: "badge-amber" },
};

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-active)", borderRadius: "var(--radius-sm)", padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}>
      <div style={{ color: "var(--text-muted)" }}>{label}</div>
      <div style={{ color: "var(--accent-primary)", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
        {payload[0].value} kWh
      </div>
    </div>
  );
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("vi-VN", {
    hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export default function ReadingsPage() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");

  useEffect(() => {
    apiFetch<Reading[]>("/readings/?limit=50")
      .then(setReadings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = sourceFilter === "all" ? readings : readings.filter((r) => r.source === sourceFilter);

  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const kwh = readings
      .filter((r) => r.source === "pulse" && new Date(r.read_at).getHours() === i)
      .reduce((sum, r) => sum + (r.pulse_kwh || 0), 0);
    return { hour: `${i}h`, kwh: Math.round(kwh * 100) / 100 };
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>📈 Lịch sử chỉ số</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Dữ liệu đọc từ camera OCR và cảm biến quang</p>
        </div>
        <button className="btn btn-ghost"><Download size={14} /> Xuất CSV</button>
      </div>

      <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
        <div className="section-title" style={{ marginBottom: "1rem" }}>Tiêu thụ theo giờ (hôm nay)</div>
        <div style={{ width: "100%", height: 220, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} width={35} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="kwh" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {["all", "ocr", "pulse", "manual"].map((s) => (
          <button key={s} className={`btn ${sourceFilter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setSourceFilter(s)} style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}>
            {s === "all" ? "Tất cả" : sourceConfig[s]?.label || s}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: "0" }}>
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Chưa có dữ liệu chỉ số</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Thiết bị</th><th>Nguồn</th><th>Giá trị</th><th>Độ tin cậy</th><th>Thời gian</th></tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const config = sourceConfig[r.source] || sourceConfig.manual;
                const Icon = config.icon;
                const value = r.source === "pulse" ? (r.pulse_kwh || 0) : (r.ocr_value || 0);
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.device_id}</td>
                    <td><span className={`badge ${config.badge}`}><Icon size={10} /> {config.label}</span></td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "var(--accent-primary)" }}>
                      {r.source === "pulse" ? `${value.toFixed(2)} kWh` : `${value.toLocaleString()} kWh`}
                    </td>
                    <td>
                      {r.ocr_confidence ? (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem", color: r.ocr_confidence > 0.9 ? "var(--accent-primary)" : "var(--accent-secondary)" }}>
                          {(r.ocr_confidence * 100).toFixed(0)}%
                        </span>
                      ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{formatTime(r.read_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
