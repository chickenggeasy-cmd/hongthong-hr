import Link from "next/link";
import { Compass } from "lucide-react";

// หน้า 404 (ลิงก์ผิด/หน้าที่ไม่มีอยู่) ใช้ร่วมกันทั้งเว็บ
export default function NotFound() {
  return (
    <main className="ht-canvas flex min-h-dvh items-center justify-center px-4">
      <div className="ht-card w-full max-w-md p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FC] text-[#1E5FA8]">
          <Compass className="h-7 w-7" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-semibold text-[#1E5FA8]">404</p>
        <h1 className="mt-1 text-2xl font-bold text-[#0F2D52]">ไม่พบหน้าที่ต้องการ</h1>
        <p className="mt-2 text-sm text-[#5B6B7B]">ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว</p>
        <Link href="/" className="ht-btn-primary mt-6 inline-block px-6 py-2.5">
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
