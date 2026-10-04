import { after } from "next/server";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";
import { buildPushPayload, isAllowedPushEndpoint, isGoneSubscriptionStatus } from "./logic";

// ส่ง Web Push (แจ้งเตือนตอนปิดเว็บ) ใช้กุญแจ VAPID 2 ตัวจาก env (ดู docs/DEPLOY.md)
// ไม่ได้ตั้งค่า = ปิด Web Push เฉยๆ แจ้งเตือนบนหน้าเว็บ (Realtime) ยังทำงานตามปกติ

// แจ้งเตือนที่เก่ากว่านี้ไม่ส่งแล้ว (เช่น ช่วงที่ยังไม่ได้ตั้งค่า VAPID)
const PUSH_MAX_AGE_MS = 10 * 60 * 1000;
// ลบแจ้งเตือนที่เก่ากว่านี้ทิ้ง ตารางจะได้ไม่โตเรื่อยๆ
const KEEP_NOTIFICATIONS_DAYS = 90;

function vapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:hr@hongthong.local" };
}

export function isPushConfigured(): boolean {
  return vapidConfig() !== null;
}

/**
 * ส่งแจ้งเตือนที่ยังไม่ได้ส่ง ไปยังทุกเครื่องของผู้รับ
 * ใช้ service role ได้เพราะไม่ได้รับ id ใดๆ จากผู้ใช้: หยิบเฉพาะแถวที่ trigger ในฐานข้อมูลสร้าง
 * "หยิบ" ด้วยการตั้ง pushed_at ก่อนส่ง (ถ้ามีหลายคำขอทำงานพร้อมกัน แถวเดียวจะไม่ถูกส่งซ้ำ)
 */
export async function deliverPendingPush(): Promise<void> {
  const config = vapidConfig();
  if (!config) return;

  const service = createServiceClient();
  const now = new Date();
  const { data: rows, error } = await service
    .from("notifications")
    .update({ pushed_at: now.toISOString() })
    .is("pushed_at", null)
    .gt("created_at", new Date(now.getTime() - PUSH_MAX_AGE_MS).toISOString())
    .select("id, recipient_id, kind, title, body, link");
  if (error) {
    console.error("push: claim failed:", error.message);
    return;
  }
  if (!rows?.length) return;

  const recipientIds = [...new Set(rows.map((r) => r.recipient_id))];
  const { data: subscriptions } = await service
    .from("push_subscriptions")
    .select("id, employee_id, endpoint, p256dh, auth")
    .in("employee_id", recipientIds);
  if (!subscriptions?.length) return;

  const gone: string[] = [];
  const sends = rows.flatMap((row) =>
    subscriptions
      .filter((sub) => sub.employee_id === row.recipient_id && isAllowedPushEndpoint(sub.endpoint))
      .map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(buildPushPayload(row)),
            {
              vapidDetails: config,
              TTL: 60 * 60 * 24, // เครื่องปิดอยู่ เก็บไว้ส่งต่อได้ 1 วัน
              urgency: "high",
              timeout: 10_000,
            },
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (isGoneSubscriptionStatus(statusCode)) gone.push(sub.id);
          else console.error("push: send failed:", statusCode ?? (err as Error).message);
        }
      }),
  );
  await Promise.allSettled(sends);

  if (gone.length) await service.from("push_subscriptions").delete().in("id", gone);
  await service
    .from("notifications")
    .delete()
    .lt("created_at", new Date(now.getTime() - KEEP_NOTIFICATIONS_DAYS * 86_400_000).toISOString());
}

/**
 * เรียกหลัง Server Action ที่ทำให้เกิดแจ้งเตือนสำเร็จ: ส่ง Web Push หลังตอบกลับผู้ใช้แล้ว (ผู้ใช้ไม่ต้องรอ)
 * แจ้งเตือนบนหน้าเว็บไม่ต้องรออันนี้ Supabase Realtime ส่งให้ทันทีที่ trigger สร้างแถว
 */
export function schedulePushDelivery(): void {
  if (!isPushConfigured()) return;
  after(async () => {
    try {
      await deliverPendingPush();
    } catch (err) {
      console.error("push: delivery crashed:", (err as Error).message);
    }
  });
}
