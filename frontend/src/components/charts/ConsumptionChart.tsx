"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/supabase";

interface ChartDataPoint {
  day: string;
  kwh: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-active)",
        borderRadius: "var(--radius-sm)",
        padding: "0.5rem 0.75rem",
        fontSize: "0.8rem",
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ color: "var(--accent-primary)", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
        {payload[0].value.toLocaleString()} kWh
      </div>
    </div>
  );
}

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function ConsumptionChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: ChartDataPoint[] }>("/dashboard/consumption-7d")
      .then((res) => setData(res.data || []))
      .catch(() => {
        // Generate empty 7-day structure
        const emptyData: ChartDataPoint[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          emptyData.push({ day: DAY_LABELS[d.getDay()], kwh: 0 });
        }
        setData(emptyData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ width: "100%", height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        Đang tải...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 260, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradientKwh" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="kwh"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#gradientKwh)"
            dot={false}
            activeDot={{ r: 4, fill: "#10b981", stroke: "#0a0e17", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
