import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * ใช้ใน Server Component / Server Action / Route Handler เท่านั้น
 * ยังใช้ publishable key เหมือนฝั่งเบราว์เซอร์ (ไม่ใช่ secret key) สิทธิ์อ้างอิง RLS ตามผู้ใช้ที่ล็อกอิน
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // เรียกจาก Server Component ได้ (เขียนคุกกี้ไม่ได้) ปล่อยให้ proxy.ts เป็นตัวรีเฟรช session แทน
          }
        },
      },
    },
  );
}