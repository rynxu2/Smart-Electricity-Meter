"use client";

import { useEffect, useState, useCallback } from "react";
import { Camera, PenTool, Download, Eye, ImageOff } from "lucide-react";
import { apiFetch } from "@/lib/supabase";
import ReadingImageModal from "@/components/ReadingImageModal";

interface Reading {
  id: string;
  device_id: string;
  source: string;
  ocr_value?: number;
  ocr_confidence?: number;
  image_url?: string;
  annotated_url?: string;
  ocr_raw_text?: string;
  ocr_pipeline?: string;
  read_at: string;
}

interface Device {
  id: string;
  name: string;
}

const sourceConfig: Record<string, { label: string; icon: typeof Camera; badge: string }> = {
  ocr: { label: "Camera OCR", icon: Camera, badge: "badge-green" },
  manual: { label: "Nhập tay", icon: PenTool, badge: "badge-amber" },
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("vi-VN", {
    hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}


export default function ReadingsPage() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [readingsData, devicesData] = await Promise.all([
        apiFetch<Reading[]>("/readings/?limit=100"),
        apiFetch<Device[]>("/devices/"),
      ]);
      setReadings(readingsData);
      setDevices(devicesData);
    } catch {
      // API unavailable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = readings.filter((r) => {
    const matchSource = sourceFilter === "all" || r.source === sourceFilter;
    const matchDevice = deviceFilter === "all" || r.device_id === deviceFilter;
    return matchSource && matchDevice;
  });

  const ocrCount = readings.filter((r) => r.source === "ocr").length;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>📈 Lịch sử chỉ số</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {readings.length} bản ghi · {ocrCount} ảnh OCR
          </p>
        </div>
        <button className="btn btn-ghost"><Download size={14} /> Xuất CSV</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        {/* Source filter */}
        {["all", "ocr", "manual"].map((s) => (
          <button key={s} className={`btn ${sourceFilter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setSourceFilter(s)} style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}>
            {s === "all" ? "Tất cả" : sourceConfig[s]?.label || s}
          </button>
        ))}

        {/* Device filter */}
        {devices.length > 0 && (
          <>
            <span style={{ color: "var(--border-subtle)", margin: "0 0.25rem" }}>|</span>
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="input"
              style={{ fontSize: "0.75rem", padding: "0.375rem 0.5rem", width: "auto", minWidth: 140 }}
            >
              <option value="all">Tất cả thiết bị</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="card" style={{ padding: "0" }}>
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Chưa có dữ liệu chỉ số</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Thiết bị</th>
                <th>Nguồn</th>
                <th>Giá trị</th>
                <th>Độ tin cậy</th>
                <th>Ảnh</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const config = sourceConfig[r.source] || sourceConfig.manual;
                const Icon = config.icon;
                const value = r.ocr_value || 0;
                const hasImage = !!(r.image_url || r.annotated_url);
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      {devices.find((d) => d.id === r.device_id)?.name || r.device_id}
                    </td>
                    <td><span className={`badge ${config.badge}`}><Icon size={10} /> {config.label}</span></td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "var(--accent-primary)" }}>
                      {`${value.toLocaleString()} kWh`}
                    </td>
                    <td>
                      {r.ocr_confidence ? (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem", color: r.ocr_confidence > 0.9 ? "var(--accent-primary)" : "var(--accent-secondary)" }}>
                          {(r.ocr_confidence * 100).toFixed(0)}%
                        </span>
                      ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td>
                      {hasImage ? (
                        <button
                          className="btn btn-ghost"
                          onClick={() => setSelectedReading(r)}
                          style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem", gap: "0.25rem" }}
                          title="Xem ảnh"
                        >
                          <Eye size={12} /> Xem
                        </button>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
                          <ImageOff size={12} /> —
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{formatTime(r.read_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedReading && (
        <ReadingImageModal
          reading={selectedReading}
          onClose={() => setSelectedReading(null)}
        />
      )}
    </div>
  );
}
