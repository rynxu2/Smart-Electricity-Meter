"use client";

import { useEffect, useState } from "react";
import { Zap, Gauge, Bell, Activity, TrendingUp, Clock } from "lucide-react";
import ConsumptionChart from "@/components/charts/ConsumptionChart";
import AlertsList from "@/components/AlertsList";
import DeviceStatusTable from "@/components/DeviceStatusTable";

interface DashboardStats {
  total_devices: number;
  active_devices: number;
  total_kwh_today: number;
  unread_alerts: number;
}

// Demo data for initial display
const DEMO_STATS: DashboardStats = {
  total_devices: 12,
  active_devices: 10,
  total_kwh_today: 847.5,
  unread_alerts: 3,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(DEMO_STATS);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            ⚡ Dashboard
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Tổng quan hệ thống công tơ điện thông minh
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          <Clock size={14} />
          {currentTime}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="card stat-card">
          <div className="stat-icon green"><Gauge size={22} /></div>
          <div>
            <div className="stat-value">{stats.total_devices}</div>
            <div className="stat-label">Công tơ</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon green"><Activity size={22} /></div>
          <div>
            <div className="stat-value">{stats.active_devices}</div>
            <div className="stat-label">Đang hoạt động</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon amber"><TrendingUp size={22} /></div>
          <div>
            <div className="stat-value">{stats.total_kwh_today.toLocaleString()}</div>
            <div className="stat-label">kWh hôm nay</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon red"><Bell size={22} /></div>
          <div>
            <div className="stat-value">{stats.unread_alerts}</div>
            <div className="stat-label">Cảnh báo mới</div>
          </div>
        </div>
      </div>

      {/* Charts + Alerts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* Consumption Chart */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <div className="section-header">
            <div className="section-title">Tiêu thụ điện 7 ngày</div>
          </div>
          <ConsumptionChart />
        </div>

        {/* Recent Alerts */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <div className="section-header">
            <div className="section-title">Cảnh báo gần đây</div>
          </div>
          <AlertsList />
        </div>
      </div>

      {/* Device Status Table */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div className="section-header">
          <div className="section-title">Trạng thái công tơ</div>
          <button className="btn btn-ghost" style={{ fontSize: "0.75rem" }}>
            Xem tất cả →
          </button>
        </div>
        <DeviceStatusTable />
      </div>
    </div>
  );
}
