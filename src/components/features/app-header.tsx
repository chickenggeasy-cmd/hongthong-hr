import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { navForRole, roleLabel } from "@/lib/permissions";
import type { CurrentEmployee } from "@/lib/auth/current-user";
import { NavLinks } from "./nav-links";

export function AppHeader({ employee }: { employee: CurrentEmployee }) {
  const navItems = navForRole(employee.role);
  const initials = employee.fullName.trim().slice(0, 1);

  return (
    <header className="sticky top-0 z-20 border-b border-[#5B6B7B]/10 bg-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/brand/logo.webp" alt="หงส์ทอง" width={44} height={44} priority className="h-11 w-11 rounded-full ring-2 ring-[#D4A017]/40" />
          <div className="leading-tight">
            <p className="font-bold text-[#1E5FA8]">หงส์ทอง HR</p>
            <p className="text-[11px] tracking-wide text-[#5B6B7B]">CASH &amp; CARRY</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-semibold text-[#1A1A1A]">{employee.fullName}</p>
            <p className="text-xs text-[#5B6B7B]">
              {employee.employeeCode} · {employee.deptName} · {roleLabel(employee.role)}
            </p>
          </div>
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1E5FA8] to-[#164A85] font-semibold text-white ring-2 ring-[#D4A017]/50"
            aria-hidden
          >
            {initials}
          </span>
          <form action={logout}>
            <button
              type="submit"
              title="ออกจากระบบ"
              className="flex items-center gap-1.5 rounded-full border border-[#5B6B7B]/20 px-3 py-1.5 text-sm text-[#5B6B7B] transition-colors hover:border-[#D64545]/40 hover:text-[#D64545]"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </form>
        </div>
      </div>

      <nav aria-label="เมนูหลัก" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] lg:flex-wrap">
        <NavLinks items={navItems} />
      </nav>
    </header>
  );
}
