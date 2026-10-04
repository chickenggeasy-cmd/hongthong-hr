import { createServiceClient } from "@/lib/supabase/service";
import type { AuditAction } from "./labels";

/**
 * บันทึกประวัติการแก้ไข เรียกหลังงานสำเร็จแล้วเท่านั้น และหลังตรวจสิทธิ์ด้วย getCurrentEmployee() แล้ว
 * actorId ต้องมาจาก getCurrentEmployee() ไม่ใช่จากฟอร์ม
 * บันทึกไม่สำเร็จไม่ทำให้งานหลักล้ม (งานเสร็จไปแล้ว) แต่เขียน log ไว้ให้ผู้ดูแลเห็น
 */
export async function recordAudit(
  actorId: string,
  action: AuditAction,
  target: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await createServiceClient()
    .from("audit_logs")
    .insert({ actor_id: actorId, action, target, details: details as never });
  if (error) console.error("audit log failed:", action, error.message);
}
