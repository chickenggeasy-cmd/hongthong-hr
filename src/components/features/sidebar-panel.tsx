"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth/actions";
import type { NavItem } from "@/lib/permissions";
import { NavLinks } from "./nav-links";
import { useNotifications } from "./notification-center";

export type ShellUser = {
  fullName: string;
  employeeCode: string;
  deptName: string;
  roleName: string;
  portal: string;
};

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-9 w-9 text-sm" : "h-10 w-10";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F0C75E] to-[#D4A017] font-bold text-[#0F2D52] ring-2 ring-white/20 ${box}`}
      aria-hidden
    >
      {name.trim().slice(0, 1)}
    </span>
  );
}

/** เนื้อหาแถบเมนูสีน้ำเงินเข้ม: โลโก้ → เมนู → การ์ดผู้ใช้ + ออกจากระบบ */
export function SidebarPanel({
  user,
  items,
  onNavigate,
  headerAction,
}: {
  user: ShellUser;
  items: NavItem[];
  onNavigate?: () => void;
  headerAction?: ReactNode;
}) {
  const notifications = useNotifications();

  // ออกจากระบบ: เลิกส่งแจ้งเตือนมาเครื่องนี้ก่อน (เครื่องที่ใช้ร่วมกันจะได้ไม่เห็นแจ้งเตือนของคนก่อนหน้า)
  const signOut = async () => {
    await notifications?.forgetDevice().catch(() => undefined);
    await logout();
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#123B6B] via-[#0F2D52] to-[#0B2340] text-white">
      {/* แสงฟุ้งนิ่งๆ ให้พื้นมีมิติ (ไม่ขยับ) */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#5BA4E6]/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-[#D4A017]/10 blur-3xl" aria-hidden />

      <div className="relative flex items-center gap-2 pb-6 pl-6 pr-4 pt-7">
        <Link href="/" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3">
          <Image src="/brand/logo.webp" alt="หงส์ทอง" width={48} height={48} priority className="h-12 w-12 rounded-full ring-2 ring-[#F0C75E]/70" />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight">หงส์ทอง</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F0C75E]" aria-hidden />
              {user.portal}
            </p>
          </div>
        </Link>
        {headerAction}
      </div>

      <nav aria-label="เมนูหลัก" className="ht-scroll-thin relative flex-1 overflow-y-auto px-3 pb-4">
        <NavLinks items={items} onNavigate={onNavigate} />
      </nav>

      <div className="relative border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
          <Avatar name={user.fullName} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="truncate text-xs text-white/55">
              {user.employeeCode} · {user.roleName}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
