"use client";

import { useState } from "react";
import { X, Camera, Eye, Cpu, Percent, Type, Zap } from "lucide-react";

interface Reading {
  id: string;
  device_id: string;
  ocr_value?: number;
  ocr_confidence?: number;
  image_url?: string;
  annotated_url?: string;
  ocr_raw_text?: string;
  ocr_pipeline?: string;
  read_at: string;
}

interface Props {
  reading: Reading;
  onClose: () => void;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ReadingImageModal({ reading, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"annotated" | "original">(
    reading.annotated_url ? "annotated" : "original"
  );

  const imageUrl = activeTab === "annotated" && reading.annotated_url
    ? reading.annotated_url
    : reading.image_url;

  const hasAnnotated = !!reading.annotated_url;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-active)",
          borderRadius: "var(--radius-lg)",
          width: "100%",
          maxWidth: 680,
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px var(--accent-primary-glow)",
          animation: "modalIn 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="stat-icon green" style={{ width: 36, height: 36 }}>
              <Camera size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                Ảnh nhận dạng — {reading.device_id}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {formatTime(reading.read_at)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              borderRadius: "var(--radius-sm)",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        {hasAnnotated && (
          <div
            style={{
              display: "flex",
              gap: "0.25rem",
              padding: "0.75rem 1.25rem 0",
            }}
          >
            <button
              className={`btn ${activeTab === "annotated" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveTab("annotated")}
              style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem" }}
            >
              <Eye size={12} /> Kết quả nhận dạng
            </button>
            <button
              className={`btn ${activeTab === "original" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveTab("original")}
              style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem" }}
            >
              <Camera size={12} /> Ảnh gốc
            </button>
          </div>
        )}

        {/* Image */}
        <div style={{ padding: "1rem 1.25rem" }}>
          {imageUrl ? (
            <div
              style={{
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                border: "1px solid var(--border-subtle)",
                background: "#000",
              }}
            >
              <img
                src={imageUrl}
                alt={activeTab === "annotated" ? "Annotated meter image" : "Original meter image"}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  maxHeight: 420,
                  objectFit: "contain",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                padding: "3rem",
                textAlign: "center",
                color: "var(--text-muted)",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <Camera size={40} style={{ marginBottom: "0.5rem", opacity: 0.3 }} />
              <div>Không có ảnh</div>
            </div>
          )}
        </div>

        {/* OCR Details */}
        <div style={{ padding: "0 1.25rem 1.25rem" }}>
          <div
            style={{
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-md)",
              padding: "1rem",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
            }}
          >
            <DetailItem
              icon={<Zap size={13} />}
              label="Giá trị"
              value={
                reading.ocr_value != null
                  ? `${reading.ocr_value} kWh`
                  : "Không đọc được"
              }
              highlight
            />
            <DetailItem
              icon={<Percent size={13} />}
              label="Confidence"
              value={
                reading.ocr_confidence != null
                  ? `${(reading.ocr_confidence * 100).toFixed(1)}%`
                  : "—"
              }
              color={
                (reading.ocr_confidence || 0) >= 0.8
                  ? "#34d399"
                  : (reading.ocr_confidence || 0) >= 0.5
                  ? "#fbbf24"
                  : "#f87171"
              }
            />
            <DetailItem
              icon={<Type size={13} />}
              label="Raw text"
              value={reading.ocr_raw_text ? `"${reading.ocr_raw_text}"` : "—"}
              mono
            />
            <DetailItem
              icon={<Cpu size={13} />}
              label="Pipeline"
              value={reading.ocr_pipeline || "—"}
              mono
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
  mono,
  highlight,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.7rem",
          color: "var(--text-muted)",
          marginBottom: "0.25rem",
        }}
      >
        {icon} {label}
      </div>
      <div
        style={{
          fontSize: highlight ? "1.1rem" : "0.85rem",
          fontWeight: highlight ? 700 : 500,
          fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
          color: color || (highlight ? "var(--accent-primary)" : "var(--text-primary)"),
        }}
      >
        {value}
      </div>
    </div>
  );
}
