import type { NextConfig } from "next";

// ส่วนหัวความปลอดภัยที่ส่งไปกับทุกหน้า (ระบบมีข้อมูลส่วนบุคคลและเงินเดือน)
const SECURITY_HEADERS = [
  // บังคับใช้ HTTPS ต่อเนื่อง 2 ปี (มีผลเมื่อเปิดผ่าน HTTPS เท่านั้น localhost ไม่กระทบ)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // ห้ามเว็บอื่นเอาหน้าเราไปฝังใน iframe (กันหลอกให้กดปุ่มอนุมัติ/ออกจากระบบ)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // ใช้ได้เฉพาะตำแหน่ง (เช็คอิน) และกล้อง (ถ่ายรูปเช็คอิน) จากเว็บเราเอง
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    serverActions: {
      // รูปเช็คอินรับได้ถึง 5MB (ตรวจซ้ำใน attendance/actions.ts) ค่าเริ่มต้นของ Next.js คือ 1MB
      // ปกติเบราว์เซอร์ย่อรูปเหลือไม่กี่ร้อย KB ก่อนส่ง (compress-photo.ts) เพราะ Vercel รับได้ ~4.5MB ต่อครั้ง
      bodySizeLimit: "6mb",
    },
  },
  // ไฟล์ฟอนต์ภาษาไทยสำหรับสลิป PDF ถูกอ่านด้วย path ตอนรัน ต้องบอกให้รวมไปด้วยตอน deploy (เช่น Vercel)
  outputFileTracingIncludes: {
    "/payslip/[id]/pdf": ["./src/lib/export/fonts/**"],
  },
};

export default nextConfig;
