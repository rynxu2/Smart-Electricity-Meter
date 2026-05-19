"use client";

import { useEffect, useState, useCallback } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { apiFetch } from "@/lib/supabase";

interface Device {
  id: string;
  name: string;
  location: string;
  status: string;
  last_seen_at?: string;
  wifi_rssi?: number;
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function rssiIcon(rssi?: number) {
  if (rssi == null) return null;
  const strength = rssi >= -50 ? 3 : rssi >= -70 ? 2 : rssi >= -85 ? 1 : 0;
  const color = strength >= 2 ? "#34d399" : strength === 1 ? "#fbbf24" : "#f87171";
  return (
    <span title={`${rssi} dBm`} style={{ display: "inline-flex", alignItems: "flex-end", gap: 1, height: 14 }}>
      {[4, 7, 11].map((h, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: h,
            borderRadius: 1,
            background: i < strength ? color : "var(--border-subtle)",
            transition: "background 0.3s",
          }}
        />
      ))}
    </span>
  );
}

const REFRESH_INTERVAL = 15_000; // 15 seconds

export default function DeviceStatusTable() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    try {
      const data = await apiFetch<Device[]>("/devices/");
      setDevices(data.slice(0, 5));
    } catch {
      // API unavailable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  // Refresh relative time display every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        Đang tải...
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        Chưa có công tơ nào được đăng ký
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Thiết bị</th>
            <th>Vị trí</th>
            <th>Trạng thái</th>
            <th>Tín hiệu</th>
            <th>Lần cuối</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => {
            const isOnline = device.status === "online";
            return (
              <tr key={device.id} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                  {device.name}
                </td>
                <td>{device.location || "—"}</td>
                <td>
                  <span
                    className={`badge ${isOnline ? "badge-green" : device.status === "maintenance" ? "badge-amber" : "badge-red"}`}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: isOnline ? "#34d399" : device.status === "maintenance" ? "#fbbf24" : "#f87171",
                        display: "inline-block",
                        animation: isOnline ? "pulse-dot 2s infinite" : "none",
                      }}
                    />
                    {isOnline ? "Online" : device.status === "maintenance" ? "Bảo trì" : "Offline"}
                  </span>
                </td>
                <td>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isOnline ? <Wifi size={13} style={{ color: "#34d399" }} /> : <WifiOff size={13} style={{ color: "#f87171" }} />}
                    {rssiIcon(device.wifi_rssi)}
                  </span>
                </td>
                <td style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {relativeTime(device.last_seen_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
