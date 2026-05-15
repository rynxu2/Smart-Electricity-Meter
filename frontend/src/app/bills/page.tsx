"use client";

import { useState } from "react";
import { Receipt, Calculator, ChevronRight } from "lucide-react";

const TIERS = [
  { tier: 1, range: "0 - 50 kWh", price: 1984 },
  { tier: 2, range: "51 - 100 kWh", price: 2050 },
  { tier: 3, range: "101 - 200 kWh", price: 2380 },
  { tier: 4, range: "201 - 300 kWh", price: 2998 },
  { tier: 5, range: "301 - 400 kWh", price: 3350 },
  { tier: 6, range: "> 400 kWh", price: 3460 },
];

interface TierResult {
  tier: number;
  kwh: number;
  price: number;
  amount: number;
}

function calculateBill(kwh: number): { tiers: TierResult[]; subtotal: number; vat: number; total: number } {
  const tierLimits = [50, 50, 100, 100, 100, Infinity];
  const tierPrices = [1984, 2050, 2380, 2998, 3350, 3460];

  let remaining = kwh;
  const tiers: TierResult[] = [];
  let subtotal = 0;

  for (let i = 0; i < 6; i++) {
    if (remaining <= 0) break;
    const used = Math.min(remaining, tierLimits[i]);
    const amount = used * tierPrices[i];
    tiers.push({ tier: i + 1, kwh: used, price: tierPrices[i], amount });
    subtotal += amount;
    remaining -= used;
  }

  const vat = Math.round(subtotal * 0.08);
  return { tiers, subtotal: Math.round(subtotal), vat, total: Math.round(subtotal + vat) };
}

export default function BillsPage() {
  const [kwh, setKwh] = useState(250);
  const result = calculateBill(kwh);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>
        💰 Tính tiền điện
      </h1>
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Tính tiền điện tự động theo bậc thang giá Việt Nam 2025
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Left: Calculator */}
        <div>
          {/* Input */}
          <div className="card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
            <div className="section-title" style={{ marginBottom: "1rem" }}>
              <Calculator size={16} /> Nhập số kWh tiêu thụ
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <input
                type="range"
                min={0}
                max={800}
                value={kwh}
                onChange={(e) => setKwh(Number(e.target.value))}
                style={{ flex: 1, accentColor: "var(--accent-primary)" }}
              />
              <input
                type="number"
                className="input"
                value={kwh}
                onChange={(e) => setKwh(Math.max(0, Number(e.target.value)))}
                style={{ width: 100, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>kWh</span>
            </div>
          </div>

          {/* Tier Breakdown */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div className="section-title" style={{ marginBottom: "1rem" }}>Chi tiết bậc thang</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {result.tiers.map((t) => (
                <div
                  key={t.tier}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(16, 185, 129, 0.04)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span
                      className="badge badge-green"
                      style={{ minWidth: 32, justifyContent: "center" }}
                    >
                      B{t.tier}
                    </span>
                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 500 }}>
                        {t.kwh.toFixed(0)} kWh × {t.price.toLocaleString()}đ
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {TIERS[t.tier - 1].range}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: "0.85rem", color: "var(--accent-secondary)" }}>
                    {t.amount.toLocaleString()}đ
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div>
          {/* Total Card */}
          <div
            className="card"
            style={{
              padding: "2rem",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.04))",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              marginBottom: "1rem",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "1px" }}>
                Tổng thanh toán
              </div>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "var(--accent-primary)", lineHeight: 1.2 }}>
                {result.total.toLocaleString()}đ
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                {kwh.toLocaleString()} kWh tiêu thụ
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "1.5rem", paddingTop: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Thành tiền</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{result.subtotal.toLocaleString()}đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>VAT (8%)</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{result.vat.toLocaleString()}đ</span>
              </div>
            </div>
          </div>

          {/* Pricing Table */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div className="section-title" style={{ marginBottom: "1rem" }}>
              <Receipt size={16} /> Bảng giá điện
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bậc</th>
                  <th>Mức tiêu thụ</th>
                  <th>Giá (VNĐ/kWh)</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => (
                  <tr key={t.tier}>
                    <td>
                      <span className="badge badge-green">Bậc {t.tier}</span>
                    </td>
                    <td>{t.range}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                      {t.price.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
