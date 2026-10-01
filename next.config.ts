import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ไฟล์ฟอนต์ภาษาไทยสำหรับสลิป PDF ถูกอ่านด้วย path ตอนรัน ต้องบอกให้รวมไปด้วยตอน deploy (เช่น Vercel)
  outputFileTracingIncludes: {
    "/payslip/[id]/pdf": ["./src/lib/export/fonts/**"],
  },
};

export default nextConfig;
