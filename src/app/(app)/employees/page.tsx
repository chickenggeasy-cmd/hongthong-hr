import { Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-permission";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/permissions";
import { bangkokToday, formatThaiDate } from "@/lib/date";
import { PageHeader } from "@/components/features/page-header";
import { RegisterForm } from "./register-form";
import { EmployeeDirectory } from "./employee-directory";

export default async function EmployeesPage() {
  const me = await requirePermission("employees.manage");

  // อ่านผ่าน client ปกติ RLS ให้ 01/HR เห็นพนักงานทุกคนอยู่แล้ว
  const supabase = await createClient();
  const [{ data: departments }, { data: employees }] = await Promise.all([
    supabase.from("departments").select("code, name, role").eq("is_active", true).order("code"),
    supabase
      .from("employees")
      .select("id, employee_code, full_name, dept_code, status, resigned_on")
      .order("dept_code")
      .order("employee_code"),
  ]);

  const deptByCode = new Map((departments ?? []).map((d) => [d.code, d]));
  const list = (employees ?? []).map((e) => {
    const dept = deptByCode.get(e.dept_code);
    return {
      ...e,
      dept_name: dept?.name ?? e.dept_code,
      role_label: dept ? roleLabel(dept.role) : "-",
      resigned_label: e.resigned_on ? formatThaiDate(e.resigned_on) : null,
    };
  });
  const activeCount = list.filter((e) => e.status === "active").length;
  const deptOptions = (departments ?? []).map((d) => ({ code: d.code, name: d.name }));

  return (
    <div className="space-y-6">
      <PageHeader icon={Users} sticker="people" title="จัดการพนักงาน" description="ลงทะเบียน แก้ไขข้อมูล ย้ายแผนก และบันทึกลาออก">
        <div className="flex gap-2">
          <span className="rounded-2xl bg-[#EAF3FC] px-4 py-2 text-center">
            <span className="block text-2xl font-bold text-[#1E5FA8]">{activeCount}</span>
            <span className="text-xs text-[#5B6B7B]">ทำงานอยู่</span>
          </span>
          <span className="rounded-2xl bg-[#5B6B7B]/10 px-4 py-2 text-center">
            <span className="block text-2xl font-bold text-[#5B6B7B]">{list.length - activeCount}</span>
            <span className="text-xs text-[#5B6B7B]">ลาออกแล้ว</span>
          </span>
        </div>
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="lg:sticky lg:top-36">
          <RegisterForm departments={deptOptions} />
        </div>
        <EmployeeDirectory employees={list} departments={deptOptions} currentEmployeeId={me.id} today={bangkokToday()} />
      </div>
    </div>
  );
}
