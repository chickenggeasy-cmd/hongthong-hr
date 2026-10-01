import Link from "next/link";
import { logout } from "@/lib/auth/actions";
import { navForRole, roleLabel } from "@/lib/permissions";
import type { CurrentEmployee } from "@/lib/auth/current-user";

export function AppHeader({ employee }: { employee: CurrentEmployee }) {
  const navItems = navForRole(employee.role);

  return (
    <header className="sticky top-0 z-10 border-b border-[#5B6B7B]/15 bg-white/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#D4A017]" aria-hidden />
          <span className="font-semibold text-[#1A1A1A]">หงส์ทอง</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-[#1A1A1A]">{employee.fullName}</p>
            <p className="text-xs text-[#5B6B7B]">
              {employee.employeeCode} · {employee.deptName} · {roleLabel(employee.role)}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-[#5B6B7B]/30 px-3 py-1.5 text-sm text-[#5B6B7B] transition-colors hover:border-[#D64545]/40 hover:text-[#D64545]"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>

      <nav aria-label="เมนูหลัก" className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-[#5B6B7B] transition-colors hover:bg-[#EAF3FC] hover:text-[#1E5FA8]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}