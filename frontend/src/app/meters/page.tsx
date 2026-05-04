"use client";

import { useState } from "react";
import { Gauge, Plus, MapPin, Wifi, WifiOff, Settings, Trash2, Eye } from "lucide-react";
import Link from "next/link";

interface Device {
  id: string;
  name: string;
  location: string;
  meter_serial: string;
  esp_mac_address: string;
  status: string;
  lastReading: number;
  lastSeen: string;
}

const DEMO_DEVICES: Device[] = [
  { id: "1", name: "Công tơ #001", location: "Tòa A - Tầng 1 - Phòng 101", meter_serial: "EV-2024-001", esp_mac_address: "AA:BB:CC:DD:01:01", status: "active", lastReading: 15234.5, lastSeen: "2 phút trước" },
  { id: "2", name: "Công tơ #002", location: "Tòa A - Tầng 2 - Phòng 205", meter_serial: "EV-2024-002", esp_mac_address: "AA:BB:CC:DD:01:02", status: "active", lastReading: 8912.3, lastSeen: "5 phút trước" },
  { id: "3", name: "Công tơ #003", location: "Tòa B - Tầng 1 - Phòng 102", meter_serial: "EV-2024-003", esp_mac_address: "AA:BB:CC:DD:02:01", status: "active", lastReading: 22145.8, lastSeen: "1 phút trước" },
  { id: "4", name: "Công tơ #005", location: "Tòa B - Tầng 3 - Phòng 312", meter_serial: "EV-2024-005", esp_mac_address: "AA:BB:CC:DD:02:03", status: "maintenance", lastReading: 3420.1, lastSeen: "2 ngày trước" },
  { id: "5", name: "Công tơ #007", location: "Tòa C - Tầng 3 - Phòng 301", meter_serial: "EV-2024-007", esp_mac_address: "AA:BB:CC:DD:03:01", status: "active", lastReading: 5678.1, lastSeen: "8 phút trước" },
  { id: "6", name: "Công tơ #011", location: "Tòa D - Tầng 1 - Phòng 101", meter_serial: "EV-2024-011", esp_mac_address: "AA:BB:CC:DD:04:01", status: "inactive", lastReading: 12890.0, lastSeen: "5 giờ trước" },
];

const statusConfig: Record<string, { label: string; badge: string; icon: typeof Wifi }> = {
  active: { label: "Hoạt động", badge: "badge-green", icon: Wifi },
  inactive: { label: "Offline", badge: "badge-red", icon: WifiOff },
  maintenance: { label: "Bảo trì", badge: "badge-amber", icon: Settings },
};

export default function MetersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = DEMO_DEVICES.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>📊 Quản lý công tơ</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {DEMO_DEVICES.length} thiết bị · {DEMO_DEVICES.filter((d) => d.status === "active").length} đang hoạt động
          </p>
        </div>
        <button className="btn btn-primary">
          <Plus size={14} /> Thêm công tơ
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <input
          className="input"
          placeholder="Tìm kiếm theo tên, vị trí..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 320 }}
        />
        {["all", "active", "inactive", "maintenance"].map((s) => (
          <button
            key={s}
            className={`btn ${statusFilter === s ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setStatusFilter(s)}
            style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}
          >
            {s === "all" ? "Tất cả" : statusConfig[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Device Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "1rem" }}>
        {filtered.map((device) => {
          const config = statusConfig[device.status] || statusConfig.inactive;
          const StatusIcon = config.icon;
          return (
            <div key={device.id} className="card" style={{ padding: "1.25rem" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div className="stat-icon green" style={{ width: 40, height: 40 }}>
                    <Gauge size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{device.name}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{device.meter_serial}</div>
                  </div>
                </div>
                <span className={`badge ${config.badge}`}>
                  <StatusIcon size={10} /> {config.label}
                </span>
              </div>

              {/* Info */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)" }}>
                  <MapPin size={13} /> {device.location}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Chỉ số hiện tại</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "var(--accent-primary)" }}>
                    {device.lastReading.toLocaleString("vi-VN")} kWh
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>MAC Address</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem" }}>{device.esp_mac_address}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Cập nhật</span>
                  <span style={{ fontSize: "0.75rem" }}>{device.lastSeen}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.5rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.75rem", justifyContent: "center" }}>
                  <Eye size={13} /> Chi tiết
                </button>
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.75rem", justifyContent: "center" }}>
                  <Settings size={13} /> Cấu hình
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
