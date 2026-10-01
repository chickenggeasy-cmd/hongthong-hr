import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";

/**
 * ตัวกั้นของ Route Handler ดาวน์โหลดรายงาน (ไม่ผ่าน page.tsx จึงต้องเช็กสิทธิ์เองที่นี่)
 * ไม่มีสิทธิ์ → คืน Response 404 (ไม่บอกว่ามีรายงานนี้อยู่) | มีสิทธิ์ → คืน null ให้ทำงานต่อ
 */
export async function reportGuard(): Promise<Response | null> {
  const employee = await getCurrentEmployee();
  if (!employee || !can(employee.role, "payroll.view")) return new Response("ไม่พบหน้านี้", { status: 404 });
  return null;
}

export function badRequest(message: string): Response {
  return new Response(message, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
