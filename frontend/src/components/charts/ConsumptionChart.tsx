"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const DEMO_DATA = [
  { day: "T2", kwh: 125 },
  { day: "T3", kwh: 142 },
  { day: "T4", kwh: 118 },
  { day: "T5", kwh: 167 },
  { day: "T6", kwh: 134 },
  { day: "T7", kwh: 89 },
  { day: "CN", kwh: 72 },
];

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

export default function ConsumptionChart() {
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <AreaChart data={DEMO_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
