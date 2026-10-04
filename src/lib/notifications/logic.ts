// กติกาของระบบแจ้งเตือนที่ไม่ผูกกับหน้าเว็บ (มีเทสต์ใน tests/notifications-logic.test.ts)
// แจ้งเตือนสร้างโดย trigger ในฐานข้อมูล (supabase/migrations/..._notifications.sql) ไฟล์นี้ดูแลการแสดงผลและการส่งต่อ

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
};

/** จำนวนรายการล่าสุดที่เก็บไว้ในกล่องแจ้งเตือนบนหน้าเว็บ */
export const NOTIFICATION_LIST_LIMIT = 30;

export function toNotificationItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** เพิ่ม/แทนที่รายการ (กันซ้ำด้วย id) เรียงใหม่สุดก่อน และตัดให้เหลือไม่เกิน limit */
export function upsertNotification(
  list: NotificationItem[],
  item: NotificationItem,
  limit = NOTIFICATION_LIST_LIMIT,
): NotificationItem[] {
  const rest = list.filter((n) => n.id !== item.id);
  return [item, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

/** ทำเครื่องหมายว่าอ่านแล้ว: ระบุ id = รายการเดียว / null = ทั้งหมด */
export function markRead(list: NotificationItem[], id: string | null, readAt: string): NotificationItem[] {
  return list.map((n) => (n.readAt === null && (id === null || n.id === id) ? { ...n, readAt } : n));
}

export function unreadCount(list: NotificationItem[]): number {
  return list.filter((n) => n.readAt === null).length;
}

/** ตัวเลขบนกระดิ่ง: เกิน 99 แสดง "99+" */
export function badgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

export type NotificationIcon = "leave" | "team" | "ot" | "approved" | "rejected" | "warning" | "payslip" | "bell";

/** ไอคอนของแจ้งเตือนจาก kind เช่น "leave.approved" (ผลอนุมัติใช้ไอคอนผล ไม่ใช่ไอคอนประเภทคำขอ) */
export function notificationIcon(kind: string): NotificationIcon {
  const [group, action] = kind.split(".");
  if (action === "approved") return "approved";
  if (action === "rejected") return "rejected";
  switch (group) {
    case "leave":
      return action === "team" ? "team" : "leave";
    case "ot":
      return "ot";
    case "warning":
      return "warning";
    case "payslip":
      return "payslip";
    default:
      return "bell";
  }
}

/** เวลาแบบสั้น "เมื่อสักครู่" / "5 นาทีที่แล้ว" / "3 ชม.ที่แล้ว" / "2 วันที่แล้ว" / วันที่ */
export function relativeTimeThai(iso: string, now: Date): string {
  const then = new Date(iso);
  const seconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return "เมื่อสักครู่";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วันที่แล้ว`;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(then);
}

/** ลิงก์ในแจ้งเตือนต้องเป็นหน้าในเว็บเราเท่านั้น (กันพาไปเว็บอื่น) */
export function safeInternalLink(link: string | null | undefined): string {
  return typeof link === "string" && /^\/[a-z0-9/_-]*$/.test(link) && !link.startsWith("//") ? link : "/";
}

// ---------- Web Push ----------

/**
 * บริการรับแจ้งเตือนของเบราว์เซอร์ที่ยอมให้บันทึก (Chrome/Edge/Android, Firefox, Safari/iPhone)
 * กันไม่ให้ใครส่ง endpoint ของเว็บอื่นมา แล้วให้เซิร์ฟเวอร์เรายิงคำขอไปหาเว็บนั้นแทน
 */
const PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
] as const;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string };

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** ตรวจข้อมูลเครื่องที่เบราว์เซอร์ส่งมา (PushSubscription.toJSON()) คืน null ถ้าไม่ถูกต้อง */
export function parsePushSubscription(input: unknown): PushSubscriptionInput | null {
  if (!input || typeof input !== "object") return null;
  const value = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = value.endpoint;
  const p256dh = value.keys?.p256dh;
  const auth = value.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (endpoint.length > 1000 || p256dh.length > 200 || auth.length > 100) return null;
  if (!p256dh || !auth || !BASE64URL.test(p256dh) || !BASE64URL.test(auth)) return null;
  if (!isAllowedPushEndpoint(endpoint)) return null;
  return { endpoint, p256dh, auth };
}

export type PushPayload = { id: string; kind: string; title: string; body: string; link: string };

/** ข้อมูลที่ส่งไปเครื่อง (service worker /sw.js อ่านแล้วเด้งแจ้งเตือน) */
export function buildPushPayload(row: { id: string; kind: string; title: string; body: string; link: string }): PushPayload {
  return { id: row.id, kind: row.kind, title: row.title, body: row.body, link: safeInternalLink(row.link) };
}

/** เครื่องที่ตอบว่าไม่มีอยู่แล้ว (ถอนการรับแจ้งเตือน/ล้างข้อมูลเบราว์เซอร์) ให้ลบทิ้ง */
export function isGoneSubscriptionStatus(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

/** แปลง VAPID public key (base64url) เป็น bytes สำหรับ pushManager.subscribe() */
export function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// รหัส error จาก send_test_notification() / save_push_subscription() → ข้อความไทย
export const NOTIFICATION_ERROR_MESSAGES: Record<string, string> = {
  "notification.forbidden": "กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
  "notification.too_fast": "เพิ่งส่งไป รอสักครู่แล้วลองใหม่",
};
