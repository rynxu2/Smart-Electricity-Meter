"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/supabase";

interface Device {
  id: string;
  name: string;
  location: string;
  status: string;
}

export default function DeviceStatusTable() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Device[]>("/devices/")
      .then((data) => setDevices(data.slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false));
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
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id} style={{ cursor: "pointer" }}>
              <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                {device.name}
              </td>
              <td>{device.location || "—"}</td>
              <td>
                <span className={`badge ${device.status === "active" ? "badge-green" : device.status === "maintenance" ? "badge-amber" : "badge-red"}`}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: device.status === "active" ? "#34d399" : device.status === "maintenance" ? "#fbbf24" : "#f87171",
                      display: "inline-block",
                    }}
                  />
                  {device.status === "active" ? "Hoạt động" : device.status === "maintenance" ? "Bảo trì" : "Offline"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
