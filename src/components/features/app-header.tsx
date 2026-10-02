import { navForRole, portalLabel, roleLabel } from "@/lib/permissions";
import type { CurrentEmployee } from "@/lib/auth/current-user";
import { MobileNav } from "./mobile-nav";
import { SidebarPanel, type ShellUser } from "./sidebar-panel";

/**
 * โครงเมนูของทุกหน้าหลังล็อกอิน
 * จอใหญ่ (lg ขึ้นไป): แถบด้านซ้ายติดอยู่กับที่ · จอเล็ก: แถบบน + ปุ่มเปิดเมนูเลื่อนออก
 * เมนูที่เห็นมาจาก navForRole() ใน permissions.ts ที่เดียว
 */
export function AppHeader({ employee }: { employee: CurrentEmployee }) {
  const items = navForRole(employee.role);
  const user: ShellUser = {
    fullName: employee.fullName,
    employeeCode: employee.employeeCode,
    deptName: employee.deptName,
    roleName: roleLabel(employee.role),
    portal: portalLabel(employee.role),
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
        <SidebarPanel user={user} items={items} />
      </aside>
      <MobileNav user={user} items={items} />
    </>
  );
}
