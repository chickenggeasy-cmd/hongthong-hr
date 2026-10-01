import { requirePermission } from "@/lib/auth/require-permission";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/permissions";
import { RegisterForm } from "./register-form";

export default async function EmployeesPage() {
  await requirePermission("employees.manage");

  const supabase = await createClient();

  const { data: departments } = await supabase
    .from("departments")
    .select("code, name, role")
    .eq("is_active", true)
    .order("code");

  const { data: employees } = await supabase
    .from("employees")
    .select("id, employee_code, full_name, dept_code, status")
    .order("employee_code");

  const deptByCode = new Map((departments ?? []).map((d) => [d.code, d]));

  return (
    <div className="space-y-6">
      <RegisterForm departments={(departments ?? []).map((d) => ({ code: d.code, name: d.name }))} />

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-[#1A1A1A]">รายชื่อพนักงาน ({employees?.length ?? 0})</h2>
        {!employees || employees.length === 0 ? (
          <p className="text-sm text-[#5B6B7B]">ยังไม่มีพนักงานในระบบ</p>
        ) : (
          <ul className="divide-y divide-[#5B6B7B]/10 text-sm">
            {employees.map((emp) => {
              const dept = deptByCode.get(emp.dept_code);
              return (
                <li key={emp.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-[#1A1A1A]">{emp.full_name}</p>
                    <p className="text-xs text-[#5B6B7B]">
                      {emp.employee_code} · {dept?.name ?? emp.dept_code}
                      {dept ? ` · ${roleLabel(dept.role)}` : ""}
                    </p>
                  </div>
                  {emp.status !== "active" ? (
                    <span className="rounded-full bg-[#D64545]/10 px-2 py-1 text-xs text-[#D64545]">
                      ลาออกแล้ว
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}