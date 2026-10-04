"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

// หน้าแจ้งข้อผิดพลาดของทุกหน้าหลังล็อกอิน (เมนูด้านข้างยังอยู่ กดไปหน้าอื่นต่อได้)
// ไม่แสดงรายละเอียด error ให้ผู้ใช้เห็น (อาจมีข้อมูลภายใน) แสดงแค่รหัสอ้างอิงไว้แจ้งผู้ดูแล
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="ht-card mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D64545]/10 text-[#D64545]">
        <TriangleAlert className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-bold text-[#0F2D52]">เกิดข้อผิดพลาด โหลดหน้านี้ไม่สำเร็จ</h1>
      <p className="mt-2 text-sm text-[#5B6B7B]">ลองอีกครั้ง ถ้ายังไม่ได้ให้แจ้ง HR พร้อมรหัสอ้างอิงด้านล่าง</p>
      {error.digest ? <p className="mt-3 font-mono text-xs text-[#5B6B7B]">รหัสอ้างอิง: {error.digest}</p> : null}
      <button type="button" onClick={reset} className="ht-btn-primary mt-6 inline-flex items-center gap-2 px-6 py-2.5">
        <RefreshCw className="h-4 w-4" aria-hidden />
        ลองอีกครั้ง
      </button>
    </div>
  );
}
