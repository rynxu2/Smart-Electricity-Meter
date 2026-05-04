"use client";

interface Device {
  id: string;
  name: string;
  location: string;
  status: string;
  lastReading: number;
  lastSeen: string;
}

const DEMO_DEVICES: Device[] = [
  { id: "1", name: "Công tơ #001", location: "Tòa A - Tầng 1", status: "active", lastReading: 15234.5, lastSeen: "2 phút trước" },
  { id: "2", name: "Công tơ #002", location: "Tòa A - Tầng 2", status: "active", lastReading: 8912.3, lastSeen: "5 phút trước" },
  { id: "3", name: "Công tơ #003", location: "Tòa B - Tầng 1", status: "active", lastReading: 22145.8, lastSeen: "1 phút trước" },
  { id: "4", name: "Công tơ #007", location: "Tòa C - Tầng 3", status: "active", lastReading: 5678.1, lastSeen: "8 phút trước" },
  { id: "5", name: "Công tơ #011", location: "Tòa D - Tầng 1", status: "inactive", lastReading: 12890.0, lastSeen: "5 giờ trước" },
];

export default function DeviceStatusTable() {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Thiết bị</th>
            <th>Vị trí</th>
            <th>Trạng thái</th>
            <th>Chỉ số (kWh)</th>
            <th>Cập nhật</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_DEVICES.map((device) => (
            <tr key={device.id} style={{ cursor: "pointer" }}>
              <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                {device.name}
              </td>
              <td>{device.location}</td>
              <td>
                <span className={`badge ${device.status === "active" ? "badge-green" : "badge-red"}`}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: device.status === "active" ? "#34d399" : "#f87171",
                      display: "inline-block",
                    }}
                  />
                  {device.status === "active" ? "Hoạt động" : "Offline"}
                </span>
              </td>
              <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: "var(--accent-primary)" }}>
                {device.lastReading.toLocaleString("vi-VN")}
              </td>
              <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {device.lastSeen}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
