import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // ทำงานกับทุกหน้ายกเว้นไฟล์ static รูปภาพ manifest และ sw.js (ต้องโหลดได้ก่อนล็อกอิน เพื่อให้ติดตั้งเป็นแอป/รับแจ้งเตือนได้)
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};