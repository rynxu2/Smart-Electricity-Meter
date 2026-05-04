import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Smart Meter Dashboard | Công tơ điện thông minh",
  description: "Hệ thống đọc chỉ số công tơ điện thông minh từ xa - Giám sát tiêu thụ điện năng, phát hiện bất thường, tính tiền tự động",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar />
          <main style={{ flex: 1, padding: "1.5rem", overflow: "auto" }} className="grid-bg">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
