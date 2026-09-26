import { logout } from "@/lib/auth/actions";
import { roleLabel } from "@/lib/permissions";
import type { CurrentEmployee } from "@/lib/auth/current-user";

export function AppHeader({ employee }: { employee: CurrentEmployee }) {
  return (
    <header className="sticky top-0 z-10 border-b border-[#5B6B7B]/15 bg-white/95 backdrop-blur pt-[env(safe-area-inset-top,0px)]">
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
    </header>
  );
}