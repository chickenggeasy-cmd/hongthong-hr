"use server";

import { headers } from "next/headers";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/approvals/logic";
import { NOTIFICATION_ERROR_MESSAGES, parsePushSubscription } from "@/lib/notifications/logic";
import { schedulePushDelivery } from "@/lib/notifications/push";

// งานของกระดิ่งแจ้งเตือน (เรียกจาก notification-center.tsx ซึ่งไม่ใช่ฟอร์ม จึงคืนผลเป็น object ธรรมดา)
// ทุกฟังก์ชันเรียก SECURITY DEFINER function ที่หาตัวผู้ใช้จาก auth.uid() เอง แตะได้เฉพาะข้อมูลของตัวเอง

export type NotificationActionResult = { error: string | null };

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_EXPIRED = "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";

/** อ่านแล้ว: ส่ง id = รายการเดียว / null = ทั้งหมด */
export async function markNotificationsRead(notificationId: string | null): Promise<NotificationActionResult> {
  if (!(await getCurrentEmployee())) return { error: SESSION_EXPIRED };
  if (notificationId !== null && !ID_PATTERN.test(notificationId)) return { error: null };

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "mark_notifications_read",
    notificationId === null ? {} : { p_notification_id: notificationId },
  );
  return { error: error ? dbErrorMessage(error.message, NOTIFICATION_ERROR_MESSAGES) : null };
}

/** ส่งแจ้งเตือนทดสอบให้ตัวเอง (เช็กว่าเครื่องนี้รับแจ้งเตือนได้จริง) */
export async function sendTestNotification(): Promise<NotificationActionResult> {
  if (!(await getCurrentEmployee())) return { error: SESSION_EXPIRED };

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_test_notification");
  if (error) return { error: dbErrorMessage(error.message, NOTIFICATION_ERROR_MESSAGES) };

  schedulePushDelivery();
  return { error: null };
}

/** เครื่องนี้เปิดรับแจ้งเตือนตอนปิดเว็บ (ข้อมูลจาก PushSubscription.toJSON() ของเบราว์เซอร์) */
export async function savePushSubscription(subscription: unknown): Promise<NotificationActionResult> {
  if (!(await getCurrentEmployee())) return { error: SESSION_EXPIRED };

  const parsed = parsePushSubscription(subscription);
  if (!parsed) return { error: "เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน" };

  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? undefined;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.endpoint,
    p_p256dh: parsed.p256dh,
    p_auth: parsed.auth,
    p_user_agent: userAgent,
  });
  return { error: error ? dbErrorMessage(error.message, NOTIFICATION_ERROR_MESSAGES) : null };
}

/** ปิดการแจ้งเตือนบนเครื่องนี้ */
export async function deletePushSubscription(endpoint: string): Promise<NotificationActionResult> {
  if (!(await getCurrentEmployee())) return { error: SESSION_EXPIRED };
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { error: null };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
  return { error: error ? dbErrorMessage(error.message, NOTIFICATION_ERROR_MESSAGES) : null };
}
