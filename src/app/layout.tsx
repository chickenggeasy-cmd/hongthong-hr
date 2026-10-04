import type { Metadata, Viewport } from "next";
import { Geist_Mono, Sarabun } from "next/font/google";
import "./globals.css";

// ฟอนต์หลักของเว็บ: Sarabun มีทั้งภาษาไทยและอังกฤษ ตัวเดียวกับสลิป PDF ให้เว็บและเอกสารดูเป็นชุดเดียวกัน
// ตั้งชื่อตัวแปรเป็น --font-sans ให้ตรงกับที่ globals.css (Tailwind/shadcn) ใช้
const sarabun = Sarabun({
  variable: "--font-sans",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "หงส์ทอง · ระบบพนักงาน", template: "%s · หงส์ทอง" },
  description: "ระบบลงเวลา ลา OT และเงินเดือนพนักงาน บริษัท หงส์ทอง จำกัด",
  applicationName: "หงส์ทอง",
  appleWebApp: { capable: true, title: "หงส์ทอง", statusBarStyle: "default" },
  // ระบบภายในบริษัท ไม่ให้เครื่องมือค้นหาเก็บไปแสดง
  robots: { index: false, follow: false },
};

// สีแถบด้านบนของเบราว์เซอร์มือถือ / แอปที่ติดตั้ง
export const viewport: Viewport = { themeColor: "#0F2D52" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${sarabun.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
