"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import type { NavItem } from "@/lib/permissions";
import { Avatar, SidebarPanel, type ShellUser } from "./sidebar-panel";

/** แถบบนสำหรับมือถือ/แท็บเล็ต + เมนูเลื่อนออกจากด้านซ้าย (จอใหญ่ใช้แถบด้านข้างแทน) */
export function MobileNav({ user, items }: { user: ShellUser; items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // ปิดเมนูเองเมื่อเปลี่ยนหน้า (ปรับ state ระหว่าง render ตามที่ React แนะนำ)
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // เปิดเมนูอยู่: ล็อกการเลื่อนหน้า และกด Esc เพื่อปิด
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#1E5FA8]/10 bg-white/95 pt-[env(safe-area-inset-top,0px)] shadow-[0_1px_0_rgb(15_45_82/0.02),0_8px_24px_-16px_rgb(15_45_82/0.25)] lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="เปิดเมนู"
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#0F2D52] transition-colors hover:bg-[#EAF3FC]"
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/brand/logo.webp" alt="หงส์ทอง" width={36} height={36} className="h-9 w-9 rounded-full ring-2 ring-[#D4A017]/50" />
            <div className="leading-tight">
              <p className="font-bold text-[#0F2D52]">หงส์ทอง</p>
              <p className="text-[11px] text-[#5B6B7B]">{user.portal}</p>
            </div>
          </Link>
          <Avatar name={user.fullName} size="sm" />
        </div>
      </header>

      {/* เมนูเลื่อนออก: แสดงตลอดแต่ซ่อนนอกจอ เพื่อให้เลื่อนเข้า/ออกได้นุ่ม */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-[#0B2340]/50 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="เมนูหลัก"
          className={`absolute inset-y-0 left-0 w-[19rem] max-w-[85vw] shadow-2xl transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarPanel user={user} items={items} onNavigate={() => setOpen(false)} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="ปิดเมนู"
            tabIndex={open ? 0 : -1}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}
