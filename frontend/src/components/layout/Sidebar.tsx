"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gauge,
  BarChart3,
  Receipt,
  Bell,
  Settings,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/meters", label: "Công tơ", icon: Gauge },
  { href: "/readings", label: "Chỉ số", icon: BarChart3 },
  { href: "/bills", label: "Hóa đơn", icon: Receipt },
  { href: "/alerts", label: "Cảnh báo", icon: Bell },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 240,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-subtle)",
        padding: "1.5rem 0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.5rem 1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, var(--accent-primary), #059669)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Zap size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
            SmartMeter
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "1px", textTransform: "uppercase" }}>
            IoT Platform
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive ? "active" : ""}`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ marginTop: "auto", padding: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div className="pulse-dot" />
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>MQTT Connected</span>
        </div>
      </div>
    </aside>
  );
}
