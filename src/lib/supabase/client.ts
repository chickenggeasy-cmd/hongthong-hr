import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** ใช้ใน Client Component เท่านั้น ใช้ publishable key ซึ่งปลอดภัยที่จะอยู่ในเบราว์เซอร์ (มี RLS คุมอยู่) */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}