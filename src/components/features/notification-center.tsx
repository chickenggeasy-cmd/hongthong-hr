"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, CheckCheck, Send, Volume2, VolumeX, X } from "lucide-react";
import { Sticker, type StickerName } from "@/components/brand/sticker";
import { createClient } from "@/lib/supabase/client";
import {
  badgeLabel,
  base64UrlToBytes,
  markRead,
  NOTIFICATION_LIST_LIMIT,
  notificationIcon,
  relativeTimeThai,
  safeInternalLink,
  toNotificationItem,
  unreadCount,
  upsertNotification,
  type NotificationIcon,
  type NotificationItem,
  type NotificationRow,
} from "@/lib/notifications/logic";
import { playChime, readSoundPreference, unlockAudioOnFirstGesture, writeSoundPreference } from "@/lib/notifications/sound";
import {
  deletePushSubscription,
  markNotificationsRead,
  savePushSubscription,
  sendTestNotification,
} from "@/app/(app)/notifications-actions";

// ระบบแจ้งเตือนของทุกหน้าหลังล็อกอิน
//  - ฟังแถวใหม่ในตาราง notifications ผ่าน Supabase Realtime (RLS ให้เห็นเฉพาะของตัวเอง) → เด้งกล่อง + เสียง + รีเฟรชข้อมูลหน้าเอง
//  - เปิด "แจ้งเตือนบนเครื่องนี้" = สมัคร Web Push (public/sw.js) ให้เด้งได้แม้ปิดเว็บ
// มี Provider ตัวเดียว (ฟังครั้งเดียว เสียงไม่ซ้อน) กระดิ่งบนจอใหญ่/จอเล็กใช้ข้อมูลชุดเดียวกัน

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const TOAST_MS = 6500;
const SELECT_COLUMNS = "id, kind, title, body, link, read_at, created_at";

const ICON_STICKER: Record<NotificationIcon, StickerName> = {
  leave: "calendar",
  team: "people",
  ot: "stopwatch",
  approved: "check",
  rejected: "x-circle",
  warning: "warning",
  payslip: "receipt",
  bell: "bell",
};

/** สถานะแจ้งเตือนตอนปิดเว็บของเครื่องนี้ */
type PushState = "checking" | "unconfigured" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "working";

type NotificationContextValue = {
  items: NotificationItem[];
  unread: number;
  ringKey: number;
  soundOn: boolean;
  pushState: PushState;
  message: string | null;
  setSoundOn: (on: boolean) => void;
  open: (item: NotificationItem) => void;
  readAll: () => void;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
  sendTest: () => Promise<void>;
  forgetDevice: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  return useContext(NotificationContext);
}

function isIosBrowserTab(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([promise, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))]);
}

export function NotificationProvider({
  employeeId,
  initialItems,
  children,
}: {
  employeeId: string;
  initialItems: NotificationItem[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const [ringKey, setRingKey] = useState(0);
  const [soundOn, setSoundOnState] = useState(true);
  const [pushState, setPushState] = useState<PushState>("checking");
  const [message, setMessage] = useState<string | null>(null);

  // ค่าล่าสุดสำหรับตัวรับ Realtime (ไม่ต้องสมัครช่องใหม่ทุกครั้งที่ค่าเปลี่ยน)
  const soundRef = useRef(soundOn);
  const pushRef = useRef(pushState);
  useEffect(() => {
    soundRef.current = soundOn;
    pushRef.current = pushState;
  }, [soundOn, pushState]);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPage = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 400);
  }, [router]);

  const dismissToast = useCallback((id: string) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const handleNew = useCallback(
    (item: NotificationItem) => {
      setItems((list) => upsertNotification(list, item));
      setRingKey((k) => k + 1);
      refreshPage(); // ข้อมูลในหน้าที่เปิดอยู่ (เช่น รายการรออนุมัติ) อัปเดตเอง ไม่ต้องกดรีเฟรช

      if (document.visibilityState === "visible") {
        setToasts((list) => [item, ...list.filter((t) => t.id !== item.id)].slice(0, 3));
        setTimeout(() => dismissToast(item.id), TOAST_MS);
        if (soundRef.current) playChime();
        return;
      }
      // สลับไปแท็บ/แอปอื่นอยู่: ถ้าเครื่องนี้เปิด Web Push ไว้ เซิร์ฟเวอร์ส่งแจ้งเตือนของเครื่องให้แล้ว
      // ถ้ายังไม่เปิดแต่อนุญาตแจ้งเตือนไว้ ให้หน้าเว็บเด้งแจ้งเตือนของเครื่องเอง
      if (pushRef.current !== "on" && "Notification" in window && Notification.permission === "granted") {
        void navigator.serviceWorker?.ready.then((reg) =>
          reg.showNotification(item.title, {
            body: item.body,
            icon: "/icons/icon-192.png",
            badge: "/icons/badge-96.png",
            tag: item.id,
            lang: "th",
            data: { url: safeInternalLink(item.link) },
          }),
        );
        if (soundRef.current) playChime();
      }
    },
    [dismissToast, refreshPage],
  );

  // ---------- Realtime ----------
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refetch = async () => {
      const { data } = await supabase
        .from("notifications")
        .select(SELECT_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(NOTIFICATION_LIST_LIMIT);
      if (!cancelled && data) setItems((data as NotificationRow[]).map(toNotificationItem));
    };

    (async () => {
      await supabase.realtime.setAuth(); // ใช้ token ของผู้ใช้ที่ล็อกอิน (RLS กรองให้เห็นเฉพาะของตัวเอง)
      if (cancelled) return;
      channel = supabase
        .channel(`notifications:${employeeId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${employeeId}` },
          (payload) => handleNew(toNotificationItem(payload.new as NotificationRow)),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_id=eq.${employeeId}` },
          (payload) => {
            const updated = toNotificationItem(payload.new as NotificationRow);
            setItems((list) => list.map((n) => (n.id === updated.id ? updated : n)));
          },
        )
        .subscribe((status) => {
          // ต่อสำเร็จ (รวมถึงต่อใหม่หลังเน็ตหลุด): ดึงรายการล่าสุด กันพลาดแจ้งเตือนช่วงที่หลุด
          if (status === "SUBSCRIBED") void refetch();
        });
    })();

    // กลับมาเปิดหน้าเว็บ (เช่น ปลดล็อกมือถือ): ดึงล่าสุดอีกรอบ
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [employeeId, handleNew]);

  // ---------- เสียง + สถานะ Web Push ตอนเปิดหน้า ----------
  useEffect(() => {
    const cleanup = unlockAudioOnFirstGesture();
    let cancelled = false;
    (async () => {
      const sound = readSoundPreference();
      if (cancelled) return;
      setSoundOnState(sound);

      if (!VAPID_PUBLIC_KEY) return setPushState("unconfigured");
      if (!pushSupported()) return setPushState(isIosBrowserTab() ? "ios-install" : "unsupported");

      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (sub) {
          // ผูกเครื่องนี้กับผู้ใช้ที่ล็อกอินอยู่ทุกครั้ง (เครื่องเดียวกันอาจสลับคนใช้)
          const result = await savePushSubscription(sub.toJSON());
          if (!cancelled) setPushState(result.error ? "off" : "on");
        } else {
          setPushState(Notification.permission === "denied" ? "denied" : "off");
        }
      } catch {
        if (!cancelled) setPushState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  const setSoundOn = useCallback((on: boolean) => {
    setSoundOnState(on);
    writeSoundPreference(on);
    if (on) playChime(); // ให้ได้ยินตัวอย่างเสียงทันที
  }, []);

  const open = useCallback(
    (item: NotificationItem) => {
      dismissToast(item.id);
      if (!item.readAt) {
        setItems((list) => markRead(list, item.id, new Date().toISOString()));
        void markNotificationsRead(item.id);
      }
      router.push(safeInternalLink(item.link));
    },
    [dismissToast, router],
  );

  const readAll = useCallback(() => {
    setItems((list) => markRead(list, null, new Date().toISOString()));
    void markNotificationsRead(null);
  }, []);

  const enablePush = useCallback(async () => {
    setMessage(null);
    setPushState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "off");
        return;
      }
      const subscribe = async () => {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const options = { userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) };
        try {
          return (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe(options));
        } catch {
          // เคยสมัครไว้ด้วยกุญแจชุดเก่า: ยกเลิกแล้วสมัครใหม่
          await (await reg.pushManager.getSubscription())?.unsubscribe();
          return reg.pushManager.subscribe(options);
        }
      };
      // บางเบราว์เซอร์ต่อบริการแจ้งเตือนไม่ได้แล้วค้างเงียบ (ไม่ error) ไม่ให้ปุ่มค้าง "กำลังตั้งค่า" ตลอดไป
      const sub = await withTimeout(subscribe(), 20_000);
      if (!sub) throw new Error("push subscribe timeout");
      const result = await savePushSubscription(sub.toJSON());
      if (result.error) {
        await sub.unsubscribe();
        setMessage(result.error);
        setPushState("off");
        return;
      }
      setPushState("on");
      setMessage("เปิดแล้ว ลองกด “ส่งทดสอบ” ได้เลย");
    } catch {
      setMessage("เปิดแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPushState(Notification.permission === "denied" ? "denied" : "off");
    }
  }, []);

  const forgetDevice = useCallback(async () => {
    if (!pushSupported()) return;
    const reg = await withTimeout(navigator.serviceWorker.getRegistration(), 1500);
    const sub = reg ? await withTimeout(reg.pushManager.getSubscription(), 1500) : undefined;
    if (!sub) return;
    await withTimeout(deletePushSubscription(sub.endpoint), 2500);
    await withTimeout(sub.unsubscribe(), 1500);
  }, []);

  const disablePush = useCallback(async () => {
    setMessage(null);
    setPushState("working");
    try {
      await forgetDevice();
    } finally {
      setPushState("off");
    }
  }, [forgetDevice]);

  const sendTest = useCallback(async () => {
    setMessage(null);
    const result = await sendTestNotification();
    setMessage(
      result.error ??
        (pushRef.current === "on"
          ? "ส่งแล้ว ถ้าสลับไปแอปอื่น/ล็อกจอ แจ้งเตือนจะเด้งบนเครื่องด้วย"
          : "ส่งแล้ว ดูกล่องแจ้งเตือนที่เด้งขึ้นมา"),
    );
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      unread: unreadCount(items),
      ringKey,
      soundOn,
      pushState,
      message,
      setSoundOn,
      open,
      readAll,
      enablePush,
      disablePush,
      sendTest,
      forgetDevice,
    }),
    [items, ringKey, soundOn, pushState, message, setSoundOn, open, readAll, enablePush, disablePush, sendTest, forgetDevice],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onOpen={open} onClose={dismissToast} />
    </NotificationContext.Provider>
  );
}

// ---------- กล่องเด้ง (มุมขวาล่างบนจอใหญ่ / ใต้แถบบนบนมือถือ) ----------
function ToastStack({
  toasts,
  onOpen,
  onClose,
}: {
  toasts: NotificationItem[];
  onOpen: (item: NotificationItem) => void;
  onClose: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] z-[60] flex flex-col gap-2 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-auto lg:w-96 lg:flex-col-reverse"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="ht-toast pointer-events-auto flex items-start gap-3 rounded-2xl border border-[#1E5FA8]/10 bg-white/95 p-3.5 shadow-[0_18px_40px_-16px_rgb(15_45_82/0.45)] backdrop-blur"
        >
          <button type="button" onClick={() => onOpen(toast)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
            <Sticker name={ICON_STICKER[notificationIcon(toast.kind)]} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#0F2D52]">{toast.title}</span>
              {toast.body ? <span className="mt-0.5 line-clamp-2 block text-sm text-[#5B6B7B]">{toast.body}</span> : null}
              <span className="mt-1 block text-xs font-medium text-[#1E5FA8]">แตะเพื่อดู</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onClose(toast.id)}
            aria-label="ปิด"
            className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#5B6B7B] hover:bg-[#EAF3FC]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- กระดิ่ง + กล่องรายการ ----------
export function NotificationBell({ placement }: { placement: "sidebar" | "topbar" }) {
  const ctx = useNotifications();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!ctx) return null;
  const badge = badgeLabel(ctx.unread);
  const dark = placement === "sidebar";

  const toggle = () => {
    setNow(new Date());
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={badge ? `การแจ้งเตือน ยังไม่อ่าน ${ctx.unread} รายการ` : "การแจ้งเตือน"}
        aria-expanded={open}
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
          dark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-[#0F2D52] hover:bg-[#EAF3FC]"
        }`}
      >
        <Bell key={ctx.ringKey} className={`h-[22px] w-[22px] ${ctx.ringKey > 0 ? "ht-ring" : ""}`} aria-hidden />
        {badge ? (
          <span
            key={`b${ctx.ringKey}`}
            className={`ht-pop absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D64545] px-1 text-[11px] font-bold leading-none text-white ring-2 ${
              dark ? "ring-[#123B6B]" : "ring-white"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="การแจ้งเตือน"
            className={`ht-pop fixed z-[56] flex max-h-[min(78dvh,40rem)] flex-col overflow-hidden rounded-2xl border border-[#1E5FA8]/10 bg-white text-[#1A1A1A] shadow-[0_24px_60px_-20px_rgb(15_45_82/0.5)] ${
              dark ? "left-[18.75rem] top-5 w-[25rem]" : "inset-x-3 top-[calc(env(safe-area-inset-top,0px)+4.25rem)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#1E5FA8]/10 px-4 py-3">
              <div>
                <p className="font-bold text-[#0F2D52]">การแจ้งเตือน</p>
                <p className="text-xs text-[#5B6B7B]">{ctx.unread > 0 ? `ยังไม่อ่าน ${ctx.unread} รายการ` : "อ่านครบแล้ว"}</p>
              </div>
              <div className="flex items-center gap-1">
                {ctx.unread > 0 ? (
                  <button
                    type="button"
                    onClick={ctx.readAll}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#1E5FA8] hover:bg-[#EAF3FC]"
                  >
                    <CheckCheck className="h-4 w-4" aria-hidden />
                    อ่านทั้งหมด
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="ปิด"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5B6B7B] hover:bg-[#EAF3FC]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>

            <ul className="ht-scroll-thin flex-1 overflow-y-auto">
              {ctx.items.length === 0 ? (
                <li className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <Sticker name="bell" size={48} />
                  <p className="font-medium text-[#0F2D52]">ยังไม่มีการแจ้งเตือน</p>
                  <p className="text-sm text-[#5B6B7B]">มีคำขอใหม่หรือผลอนุมัติ จะเด้งบอกที่นี่ทันที</p>
                </li>
              ) : (
                ctx.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        ctx.open(item);
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F4F8FD] ${
                        item.readAt ? "" : "bg-[#EAF3FC]/60"
                      }`}
                    >
                      <Sticker name={ICON_STICKER[notificationIcon(item.kind)]} size={38} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${item.readAt ? "font-medium text-[#1A1A1A]" : "font-bold text-[#0F2D52]"}`}>
                          {item.title}
                        </span>
                        {item.body ? <span className="mt-0.5 line-clamp-2 block text-sm text-[#5B6B7B]">{item.body}</span> : null}
                        <span className="mt-1 block text-xs text-[#5B6B7B]">{relativeTimeThai(item.createdAt, now)}</span>
                      </span>
                      {item.readAt ? null : <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#1E5FA8]" aria-label="ยังไม่อ่าน" />}
                    </button>
                  </li>
                ))
              )}
            </ul>

            <DeviceSettings ctx={ctx} />
          </div>
        </>
      ) : null}
    </>
  );
}

/** ส่วนล่างของกล่อง: เสียง + แจ้งเตือนตอนปิดเว็บบนเครื่องนี้ */
function DeviceSettings({ ctx }: { ctx: NotificationContextValue }) {
  const { pushState } = ctx;
  return (
    <div className="space-y-2.5 border-t border-[#1E5FA8]/10 bg-[#F7FAFE] px-4 py-3 text-sm">
      <button
        type="button"
        onClick={() => ctx.setSoundOn(!ctx.soundOn)}
        className="flex w-full items-center justify-between gap-3 rounded-lg py-0.5 text-left"
        aria-pressed={ctx.soundOn}
      >
        <span className="flex items-center gap-2 text-[#1A1A1A]">
          {ctx.soundOn ? <Volume2 className="h-4 w-4 text-[#1E5FA8]" aria-hidden /> : <VolumeX className="h-4 w-4 text-[#5B6B7B]" aria-hidden />}
          เสียงแจ้งเตือน
        </span>
        <span
          className={`relative h-6 w-11 rounded-full transition-colors ${ctx.soundOn ? "bg-[#2E9E5B]" : "bg-[#C9D3DE]"}`}
          aria-hidden
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${ctx.soundOn ? "left-[1.375rem]" : "left-0.5"}`}
          />
        </span>
      </button>

      {pushState === "unconfigured" || pushState === "checking" ? null : (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[#1A1A1A]">
            {pushState === "on" ? (
              <BellRing className="h-4 w-4 text-[#2E9E5B]" aria-hidden />
            ) : (
              <BellOff className="h-4 w-4 text-[#5B6B7B]" aria-hidden />
            )}
            แจ้งเตือนตอนปิดเว็บ
            <span className={`ml-auto text-xs font-medium ${pushState === "on" ? "text-[#2E9E5B]" : "text-[#5B6B7B]"}`}>
              {pushState === "on" ? "เปิดอยู่บนเครื่องนี้" : pushState === "working" ? "กำลังตั้งค่า…" : "ปิดอยู่"}
            </span>
          </p>

          {pushState === "off" ? (
            <button
              type="button"
              onClick={ctx.enablePush}
              className="ht-btn-primary flex w-full items-center justify-center gap-2 py-2 text-sm"
            >
              <BellRing className="h-4 w-4" aria-hidden />
              เปิดแจ้งเตือนบนเครื่องนี้
            </button>
          ) : null}
          {pushState === "on" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={ctx.sendTest}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#1E5FA8]/20 bg-white py-2 font-medium text-[#1E5FA8] hover:bg-[#EAF3FC]"
              >
                <Send className="h-4 w-4" aria-hidden />
                ส่งทดสอบ
              </button>
              <button
                type="button"
                onClick={ctx.disablePush}
                className="rounded-xl px-3 py-2 font-medium text-[#5B6B7B] hover:bg-[#EAF3FC]"
              >
                ปิด
              </button>
            </div>
          ) : null}
          {pushState === "denied" ? (
            <p className="text-xs leading-relaxed text-[#5B6B7B]">
              เครื่องนี้บล็อกการแจ้งเตือนของเว็บไว้ เปิดได้ที่การตั้งค่าเบราว์เซอร์ (แตะไอคอนหน้าช่องที่อยู่เว็บ → การแจ้งเตือน → อนุญาต)
            </p>
          ) : null}
          {pushState === "ios-install" ? (
            <p className="text-xs leading-relaxed text-[#5B6B7B]">
              บน iPhone/iPad: เปิดเว็บนี้ใน Safari → แตะปุ่มแชร์ → “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดจากไอคอนนั้น จึงจะเปิดแจ้งเตือนได้
            </p>
          ) : null}
          {pushState === "unsupported" ? (
            <p className="text-xs leading-relaxed text-[#5B6B7B]">เบราว์เซอร์นี้ยังไม่รองรับ ลองใช้ Chrome, Edge หรือ Safari รุ่นใหม่</p>
          ) : null}
        </div>
      )}

      {pushState !== "on" ? (
        <button type="button" onClick={ctx.sendTest} className="text-xs font-medium text-[#1E5FA8] hover:underline">
          ลองส่งแจ้งเตือนทดสอบ
        </button>
      ) : null}
      {ctx.message ? <p className="text-xs text-[#1E5FA8]">{ctx.message}</p> : null}
    </div>
  );
}
