"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckCheck,
  Clock,
  FileSpreadsheet,
  House,
  ReceiptText,
  Settings,
  Timer,
  TriangleAlert,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/permissions";

// ไอคอนของแต่ละเมนู (รายการเมนู/สิทธิ์ยังมาจาก NAV_ITEMS ใน permissions.ts ที่เดียว)
const ICONS: Record<string, LucideIcon> = {
  "/": House,
  "/attendance": Clock,
  "/leave": CalendarDays,
  "/ot": Timer,
  "/payslip": ReceiptText,
  "/team": Users,
  "/approvals": CheckCheck,
  "/employees": UserPlus,
  "/warnings": TriangleAlert,
  "/payroll": Wallet,
  "/reports": FileSpreadsheet,
  "/admin": Settings,
};

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * เมนูหลักแบบแถบด้านข้างสีน้ำเงินเข้ม (ใช้ทั้งแถบด้านซ้ายบนคอม และเมนูเลื่อนออกบนมือถือ)
 * แบ่ง 2 กลุ่ม: "งานของฉัน" (ทุกคนเห็น) และ "การจัดการ" (เมนูที่ต้องมีสิทธิ์)
 */
export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = [
    { title: "งานของฉัน", items: items.filter((i) => !i.permission) },
    { title: "การจัดการ", items: items.filter((i) => i.permission) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">{group.title}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = ICONS[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors duration-200 ${
                      active ? "bg-white/[0.12] font-semibold text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {/* ขีดทองบอกหน้าที่เปิดอยู่ */}
                    <span
                      className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#F0C75E] transition-opacity duration-200 ${
                        active ? "opacity-100" : "opacity-0"
                      }`}
                      aria-hidden
                    />
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${
                        active ? "bg-[#F0C75E] text-[#0F2D52]" : "bg-white/[0.06] text-white/80 group-hover:bg-white/10"
                      }`}
                    >
                      {Icon ? <Icon className="h-[18px] w-[18px]" aria-hidden /> : null}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
