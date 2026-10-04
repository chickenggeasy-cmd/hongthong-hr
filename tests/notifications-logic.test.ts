import { describe, expect, it } from "vitest";
import {
  badgeLabel,
  base64UrlToBytes,
  buildPushPayload,
  isAllowedPushEndpoint,
  isGoneSubscriptionStatus,
  markRead,
  notificationIcon,
  parsePushSubscription,
  relativeTimeThai,
  safeInternalLink,
  toNotificationItem,
  unreadCount,
  upsertNotification,
  type NotificationItem,
} from "../src/lib/notifications/logic";

const item = (id: string, createdAt: string, readAt: string | null = null): NotificationItem => ({
  id,
  kind: "leave.new",
  title: "คำขอลาใหม่",
  body: "",
  link: "/approvals",
  readAt,
  createdAt,
});

describe("รายการแจ้งเตือน", () => {
  it("แปลงแถวจากฐานข้อมูล", () => {
    expect(
      toNotificationItem({ id: "1", kind: "ot.new", title: "t", body: "b", link: "/ot", read_at: null, created_at: "2026-10-05T01:00:00Z" }),
    ).toEqual({ id: "1", kind: "ot.new", title: "t", body: "b", link: "/ot", readAt: null, createdAt: "2026-10-05T01:00:00Z" });
  });

  it("เพิ่มรายการใหม่ไว้บนสุด กันซ้ำ และตัดตามจำนวน", () => {
    const list = [item("a", "2026-10-05T01:00:00Z"), item("b", "2026-10-05T00:00:00Z")];
    expect(upsertNotification(list, item("c", "2026-10-05T02:00:00Z")).map((n) => n.id)).toEqual(["c", "a", "b"]);
    // ได้รายการเดิมซ้ำ (เช่น ดึงใหม่ตอนกลับมาเปิดหน้า) แทนที่ ไม่เพิ่มซ้ำ
    expect(upsertNotification(list, { ...item("a", "2026-10-05T01:00:00Z"), readAt: "x" })).toHaveLength(2);
    expect(upsertNotification(list, item("c", "2026-10-05T02:00:00Z"), 2).map((n) => n.id)).toEqual(["c", "a"]);
  });

  it("อ่านแล้วรายการเดียว / ทั้งหมด และนับที่ยังไม่อ่าน", () => {
    const list = [item("a", "1"), item("b", "2"), item("c", "3", "old")];
    expect(unreadCount(list)).toBe(2);
    const one = markRead(list, "a", "now");
    expect(unreadCount(one)).toBe(1);
    expect(one.find((n) => n.id === "c")?.readAt).toBe("old"); // อ่านไปแล้วไม่เปลี่ยนเวลา
    expect(unreadCount(markRead(list, null, "now"))).toBe(0);
  });

  it("ตัวเลขบนกระดิ่ง", () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(7)).toBe("7");
    expect(badgeLabel(150)).toBe("99+");
  });

  it("ไอคอนตามชนิด", () => {
    expect(notificationIcon("leave.approved")).toBe("approved");
    expect(notificationIcon("ot.rejected")).toBe("rejected");
    expect(notificationIcon("leave.new")).toBe("leave");
    expect(notificationIcon("leave.team")).toBe("team");
    expect(notificationIcon("ot.new")).toBe("ot");
    expect(notificationIcon("warning.issued")).toBe("warning");
    expect(notificationIcon("payslip.ready")).toBe("payslip");
    expect(notificationIcon("system.test")).toBe("bell");
  });

  it("เวลาแบบสั้น", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    expect(relativeTimeThai("2026-10-05T11:59:30Z", now)).toBe("เมื่อสักครู่");
    expect(relativeTimeThai("2026-10-05T11:55:00Z", now)).toBe("5 นาทีที่แล้ว");
    expect(relativeTimeThai("2026-10-05T09:00:00Z", now)).toBe("3 ชม.ที่แล้ว");
    expect(relativeTimeThai("2026-10-03T12:00:00Z", now)).toBe("2 วันที่แล้ว");
    expect(relativeTimeThai("2026-09-01T12:00:00Z", now)).toMatch(/1 ก\.ย\./);
    // นาฬิกาเครื่องเพี้ยนไปข้างหน้า ไม่แสดงเวลาติดลบ
    expect(relativeTimeThai("2026-10-05T12:05:00Z", now)).toBe("เมื่อสักครู่");
  });

  it("ลิงก์ต้องเป็นหน้าในเว็บเท่านั้น", () => {
    expect(safeInternalLink("/approvals")).toBe("/approvals");
    expect(safeInternalLink("https://evil.example")).toBe("/");
    expect(safeInternalLink("//evil.example")).toBe("/");
    expect(safeInternalLink("/a?x=<script>")).toBe("/");
    expect(safeInternalLink(null)).toBe("/");
  });
});

describe("Web Push", () => {
  it("ยอมรับเฉพาะบริการแจ้งเตือนของเบราว์เซอร์จริง", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QK2x")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://evilfcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://user:pw@fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://localhost/x")).toBe(false);
    expect(isAllowedPushEndpoint("not a url")).toBe(false);
  });

  it("ตรวจข้อมูลเครื่องที่เบราว์เซอร์ส่งมา", () => {
    const ok = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNc-x_1", auth: "tBH_aw" } };
    expect(parsePushSubscription(ok)).toEqual({ endpoint: ok.endpoint, p256dh: "BNc-x_1", auth: "tBH_aw" });
    expect(parsePushSubscription(null)).toBeNull();
    expect(parsePushSubscription({ endpoint: ok.endpoint })).toBeNull();
    expect(parsePushSubscription({ ...ok, keys: { p256dh: "a b", auth: "x" } })).toBeNull();
    expect(parsePushSubscription({ ...ok, keys: { p256dh: "", auth: "x" } })).toBeNull();
    expect(parsePushSubscription({ ...ok, endpoint: "https://evil.example/x" })).toBeNull();
    expect(parsePushSubscription({ ...ok, keys: { p256dh: "a".repeat(201), auth: "x" } })).toBeNull();
  });

  it("ข้อมูลที่ส่งไปเครื่อง ลิงก์ปลอดภัยเสมอ", () => {
    expect(buildPushPayload({ id: "1", kind: "ot.new", title: "t", body: "b", link: "//x" })).toEqual({
      id: "1",
      kind: "ot.new",
      title: "t",
      body: "b",
      link: "/",
    });
  });

  it("เครื่องที่ไม่มีอยู่แล้ว", () => {
    expect(isGoneSubscriptionStatus(410)).toBe(true);
    expect(isGoneSubscriptionStatus(404)).toBe(true);
    expect(isGoneSubscriptionStatus(500)).toBe(false);
    expect(isGoneSubscriptionStatus(undefined)).toBe(false);
  });

  it("แปลง VAPID key เป็น bytes", () => {
    expect(Array.from(base64UrlToBytes("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
  });
});
