import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Client สิทธิ์เต็ม (bypass RLS) ด้วย service role key
 *
 * ใช้ได้เฉพาะในโค้ดที่รันบนเซิร์ฟเวอร์เท่านั้น (Server Action / Route Handler)
 * ห้าม import จากไฟล์ที่มี "use client" หรือส่งค่าที่สร้างจากตัวนี้กลับไปเบราว์เซอร์
 *
 * ใช้เมื่อ RLS ปกติทำงานไม่ได้ตามที่ต้องการ เช่น:
 *  - อ่านตารางที่ authenticated ไม่มีสิทธิ์เลย (app_settings)
 *  - เขียนตารางที่เปิดให้เขียนได้จาก service role เท่านั้น (attendance_logs)
 * เมื่อใช้ ต้องตรวจตัวตนผู้ใช้ด้วย createClient() ปกติ (server.ts) ก่อนเสมอ
 * แล้วค่อยใช้ id ที่ตรวจแล้วนั้น ห้ามเชื่อ id ที่ฝั่งเบราว์เซอร์ส่งมาตรงๆ
 */
export function createServiceClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}