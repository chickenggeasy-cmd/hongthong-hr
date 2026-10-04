// Service worker ของหงส์ทอง: รับแจ้งเตือนจากเซิร์ฟเวอร์ (Web Push) แล้วเด้งบนเครื่อง แม้ปิดเว็บไปแล้ว
// ไม่เก็บหน้าเว็บไว้ใช้ออฟไลน์ (ข้อมูลเงินเดือน/การลาต้องสดจากเซิร์ฟเวอร์เสมอ)

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function safeLink(link) {
  return typeof link === "string" && /^\/[a-z0-9/_-]*$/.test(link) && !link.startsWith("//") ? link : "/";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "หงส์ทอง", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    (async () => {
      // มีหน้าเว็บเปิดอยู่และกำลังใช้งาน: หน้าเว็บเด้งกล่องแจ้งเตือน+เสียงเองแล้ว ไม่ต้องเด้งซ้ำ
      // (ยกเว้นปุ่ม "ลองส่งแจ้งเตือน" ที่ต้องเห็นแจ้งเตือนของเครื่องจริงๆ)
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const focused = windows.some((w) => w.focused && w.visibilityState === "visible");
      if (focused && data.kind !== "system.test") return;

      await self.registration.showNotification(data.title || "หงส์ทอง", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: data.id || undefined,
        lang: "th",
        data: { url: safeLink(data.link) },
        vibrate: [120, 60, 120],
      });
    })(),
  );
});

// แตะแจ้งเตือน: ใช้หน้าต่างเว็บที่เปิดอยู่ (ถ้ามี) แล้วไปหน้าที่เกี่ยวข้อง ไม่งั้นเปิดหน้าต่างใหม่
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeLink(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
