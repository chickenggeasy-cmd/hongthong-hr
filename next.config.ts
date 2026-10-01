import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // รูปเช็คอินรับได้ถึง 5MB (ตรวจซ้ำใน attendance/actions.ts) ค่าเริ่มต้นของ Next.js คือ 1MB
      // เผื่อพื้นที่ให้ส่วนหัวของฟอร์ม (multipart) อีกเล็กน้อย
      bodySizeLimit: "6mb",
    },
  },
  // ไฟล์ฟอนต์ภาษาไทยสำหรับสลิป PDF ถูกอ่านด้วย path ตอนรัน ต้องบอกให้รวมไปด้วยตอน deploy (เช่น Vercel)
  outputFileTracingIncludes: {
    "/payslip/[id]/pdf": ["./src/lib/export/fonts/**"],
  },
};

export default nextConfig;
