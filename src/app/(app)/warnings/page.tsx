import { requirePermission } from "@/lib/auth/require-permission";
import { createClient } from "@/lib/supabase/server";
import { periodLabel } from "@/lib/payroll/logic";
import { warningKindLabel } from "@/lib/warnings/logic";
import { GenerateWarningsForm, IssueWarningForm } from "./warning-forms";

const KIND_CLASS: Record<string, string> = {
  late: "bg-[#E8890C]/10 text-[#E8890C]",
  absent: "bg-[#D64545]/10 text-[#D64545]",
  manual: "bg-[#1E5FA8]/10 text-[#1E5FA8]",
};

export default async function WarningsPage() {
  const employee = await requirePermission("employees.manage");

  // อ่านผ่าน client ปกติ RLS ให้ 01/HR เห็นใบเตือนและพนักงานทั้งหมดอยู่แล้ว
  const supabase = await createClient();
  const [{ data: runs }, { data: employees }, { data: warnings }] = await Promise.all([
    supabase.from("payroll_runs").select("period").order("period", { ascending: false }).limit(12),
    supabase
      .from("employees")
      .select("id, employee_code, full_name, departments(name)")
      .eq("status", "active")
      .order("employee_code"),
    supabase
      .from("warnings")
      .select(
        "id, kind, period, reason, issued_at, acknowledged_at, employee:employees!warnings_employee_id_fkey(employee_code, full_name, departments(name)), issuer:employees!warnings_issued_by_fkey(full_name)",
      )
      .order("issued_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="mb-1 font-semibold text-[#1A1A1A]">ใบเตือนอัตโนมัติ</h1>
          <p className="mb-4 text-sm text-[#5B6B7B]">
            ตรวจจากผลคำนวณเงินเดือนของงวด (มาสาย/ขาดงานถึงเกณฑ์ในหน้าตั้งค่า) กดซ้ำได้ ไม่ออกซ้ำ
          </p>
          <GenerateWarningsForm periods={(runs ?? []).map((r) => ({ value: r.period, label: periodLabel(r.period) }))} />
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-[#1A1A1A]">ออกใบเตือนเอง</h2>
          <IssueWarningForm
            employees={(employees ?? [])
              .filter((e) => e.id !== employee.id)
              .map((e) => ({ id: e.id, label: `${e.employee_code} · ${e.full_name} (${e.departments?.name ?? "-"})` }))}
          />
        </section>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-[#1A1A1A]">ใบเตือนล่าสุด</h2>
        {!warnings || warnings.length === 0 ? (
          <p className="text-sm text-[#5B6B7B]">ยังไม่มีใบเตือน</p>
        ) : (
          <ul className="divide-y divide-[#5B6B7B]/10 text-sm">
            {warnings.map((w) => (
              <li key={w.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[#1A1A1A]">
                    {w.employee?.full_name ?? "-"}{" "}
                    <span className="font-normal text-[#5B6B7B]">
                      {w.employee?.employee_code} · {w.employee?.departments?.name}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND_CLASS[w.kind] ?? ""}`}>
                      {warningKindLabel(w.kind)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${w.acknowledged_at ? "bg-[#2E9E5B]/10 text-[#2E9E5B]" : "bg-[#5B6B7B]/10 text-[#5B6B7B]"}`}
                    >
                      {w.acknowledged_at ? "รับทราบแล้ว" : "ยังไม่รับทราบ"}
                    </span>
                  </span>
                </div>
                <p className="text-[#1A1A1A]">{w.reason}</p>
                <p className="text-xs text-[#5B6B7B]">
                  {new Date(w.issued_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })} ·
                  โดย {w.issuer?.full_name ?? "ระบบอัตโนมัติ"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
