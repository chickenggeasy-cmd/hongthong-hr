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

/** เมนูหลัก ไฮไลต์หน้าที่เปิดอยู่ (ต้องเป็น Client Component เพราะอ่าน URL ปัจจุบัน) */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = ICONS[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-all ${
              active
                ? "bg-[#1E5FA8] text-white shadow-sm shadow-[#1E5FA8]/30"
                : "text-[#5B6B7B] hover:bg-[#EAF3FC] hover:text-[#1E5FA8]"
            }`}
          >
            {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
