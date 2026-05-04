"use client";

import { useState } from "react";
import { BarChart3, Camera, Radio, PenTool, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Reading {
  id: string;
  device: string;
  source: string;
  value: number;
  confidence?: number;
  time: string;
}

const DEMO_READINGS: Reading[] = [
  { id: "1", device: "Công tơ #001", source: "ocr", value: 15234.5, confidence: 0.96, time: "22:00 - 04/05/2026" },
  { id: "2", device: "Công tơ #003", source: "pulse", value: 3.24, time: "21:55 - 04/05/2026" },
  { id: "3", device: "Công tơ #002", source: "ocr", value: 8912.3, confidence: 0.91, time: "22:00 - 04/05/2026" },
  { id: "4", device: "Công tơ #007", source: "pulse", value: 1.87, time: "21:50 - 04/05/2026" },
  { id: "5", device: "Công tơ #001", source: "pulse", value: 4.12, time: "21:45 - 04/05/2026" },
  { id: "6", device: "Công tơ #003", source: "ocr", value: 22145.8, confidence: 0.88, time: "16:00 - 04/05/2026" },
  { id: "7", device: "Công tơ #002", source: "manual", value: 8900.0, time: "10:00 - 04/05/2026" },
  { id: "8", device: "Công tơ #001", source: "pulse", value: 5.67, time: "21:40 - 04/05/2026" },
];

const HOURLY_DATA = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}h`,
  kwh: Math.round((Math.sin(i / 4) + 1.5) * 15 + Math.random() * 10),
}));

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

export default function ReadingsPage() {
  const [sourceFilter, setSourceFilter] = useState("all");

  const filtered = sourceFilter === "all" ? DEMO_READINGS : DEMO_READINGS.filter((r) => r.source === sourceFilter);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>📈 Lịch sử chỉ số</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Dữ liệu đọc từ camera OCR và cảm biến quang</p>
        </div>
        <button className="btn btn-ghost">
          <Download size={14} /> Xuất CSV
        </button>
      </div>

      {/* Hourly Chart */}
      <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
        <div className="section-title" style={{ marginBottom: "1rem" }}>Tiêu thụ theo giờ (hôm nay)</div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={HOURLY_DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} width={35} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="kwh" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Source Filter */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {["all", "ocr", "pulse", "manual"].map((s) => (
          <button key={s} className={`btn ${sourceFilter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setSourceFilter(s)} style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}>
            {s === "all" ? "Tất cả" : sourceConfig[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Readings Table */}
      <div className="card" style={{ padding: "0" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Thiết bị</th>
              <th>Nguồn</th>
              <th>Giá trị</th>
              <th>Độ tin cậy</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const config = sourceConfig[r.source];
              const Icon = config.icon;
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.device}</td>
                  <td>
                    <span className={`badge ${config.badge}`}>
                      <Icon size={10} /> {config.label}
                    </span>
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "var(--accent-primary)" }}>
                    {r.source === "ocr" || r.source === "manual"
                      ? `${r.value.toLocaleString("vi-VN")} kWh`
                      : `${r.value.toFixed(2)} kWh`}
                  </td>
                  <td>
                    {r.confidence ? (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem", color: r.confidence > 0.9 ? "var(--accent-primary)" : "var(--accent-secondary)" }}>
                        {(r.confidence * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{r.time}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
