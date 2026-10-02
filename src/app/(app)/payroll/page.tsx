import Link from "next/link";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { requirePermission } from "@/lib/auth/require-permission";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { addMonths, bangkokToday, formatThaiDate } from "@/lib/date";
import { numberSetting, toSettingsRecord } from "@/lib/settings";
import { canFinalize, formatBaht, isValidPeriod, payrollCycle, periodForDate, periodLabel } from "@/lib/payroll/logic";
import { PayrollButtons } from "./payroll-buttons";

export default async function PayrollPage({ searchParams }: PageProps<"/payroll">) {
  const employee = await requirePermission("payroll.view");
  const canManage = can(employee.role, "payroll.manage");

  // อ่านผ่าน client ปกติ RLS ให้ 00/01/HR เห็นทุกงวดและทุกสลิปอยู่แล้ว
  const supabase = await createClient();
  const { data: settingRows } = await supabase.rpc("public_settings");
  const cutoffDay = numberSetting(toSettingsRecord(settingRows), "payroll.cutoff_day") ?? 25;
  const today = bangkokToday();
  const currentPeriod = periodForDate(today, cutoffDay);

  const requested = (await searchParams).period;
  const period = typeof requested === "string" && isValidPeriod(requested) ? requested : currentPeriod;

  const [{ data: runs }, { data: run }] = await Promise.all([
    supabase.from("payroll_runs").select("period, status").order("period", { ascending: false }).limit(24),
    supabase
      .from("payroll_runs")
      .select("id, period, cycle_start, cycle_end, status, updated_at, finalized_at")
      .eq("period", period)
      .maybeSingle(),
  ]);
  const { data: payslips } = run
    ? await supabase
        .from("payslips")
        .select(
          "id, employee_code, full_name, dept_name, worked_days, leave_days, absent_days, late_minutes, ot_hours, over_quota_days, base_pay, ot_pay, late_deduction, leave_penalty, social_security, net_pay",
        )
        .eq("run_id", run.id)
        .order("employee_code")
    : { data: null };

  const cycle = run ? { start: run.cycle_start, end: run.cycle_end } : payrollCycle(period, cutoffDay);
  const total = (key: "base_pay" | "ot_pay" | "late_deduction" | "leave_penalty" | "social_security" | "net_pay") =>
    (payslips ?? []).reduce((sum, p) => sum + Number(p[key]), 0);

  // งวดที่เลือกได้: 3 งวดล่าสุด + งวดที่เคยคำนวณ
  const periods = [...new Set([currentPeriod, addMonths(`${currentPeriod}-01`, -1).slice(0, 7), ...(runs ?? []).map((r) => r.period)])]
    .sort()
    .reverse();

  return (
    <div className="space-y-6">
      <PageHeader photo="store" icon={Wallet} title="เงินเดือน" description={canManage ? "คำนวณ ปิดงวด และดูสลิปของพนักงานทุกคน" : "ดูสรุปเงินเดือนและสลิปของพนักงานทุกคน"} />
      <div className="ht-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#1A1A1A]">งวด {periodLabel(period)}</h2>
            <p className="mt-1 text-sm text-[#5B6B7B]">
              {formatThaiDate(cycle.start)} – {formatThaiDate(cycle.end)} ·{" "}
              {!run ? (
                <span className="text-[#5B6B7B]">ยังไม่ได้คำนวณ</span>
              ) : run.status === "finalized" ? (
                <span className="text-[#2E9E5B]">ปิดงวดแล้ว</span>
              ) : (
                <span className="text-[#E8890C]">ร่าง (คำนวณล่าสุด {new Date(run.updated_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })})</span>
              )}
            </p>
          </div>
          <nav aria-label="เลือกงวด" className="flex flex-wrap gap-1">
            {periods.map((p) => (
              <Link
                key={p}
                href={`/payroll?period=${p}`}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${p === period ? "bg-[#1E5FA8] text-white" : "bg-[#EAF3FC] text-[#1E5FA8] hover:bg-[#1E5FA8]/10"}`}
              >
                {periodLabel(p)}
              </Link>
            ))}
          </nav>
        </div>

        {canManage && run?.status !== "finalized" ? (
          <div className="mt-4">
            <PayrollButtons
              period={period}
              hasRun={Boolean(run)}
              canCompute={cycle.start <= today}
              finalizable={Boolean(run) && canFinalize(cycle, today)}
            />
            <p className="mt-2 text-xs text-[#5B6B7B]">
              คำนวณได้ตลอดงวด (วันที่ยังไม่ถึงจะยังไม่นับ) ปิดงวดได้หลังพ้นวันตัดรอบ หลังปิดงวดพนักงานจะเห็นสลิปของตัวเอง
            </p>
          </div>
        ) : null}
        {!canManage ? <p className="mt-3 text-sm text-[#5B6B7B]">ผู้บริหารดูได้อย่างเดียว การคำนวณทำโดยการเงิน/HR</p> : null}
      </div>

      {payslips && payslips.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "พนักงาน", value: `${payslips.length} คน` },
              { label: "ค่าจ้าง + OT", value: `${formatBaht(total("base_pay") + total("ot_pay"))} ฿` },
              { label: "รายการหัก", value: `${formatBaht(total("late_deduction") + total("leave_penalty") + total("social_security"))} ฿` },
              { label: "จ่ายสุทธิ", value: `${formatBaht(total("net_pay"))} ฿`, accent: true },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl p-4 shadow-sm ${card.accent ? "bg-[#1E5FA8] text-white" : "bg-white"}`}>
                <p className={`text-xs ${card.accent ? "text-white/80" : "text-[#5B6B7B]"}`}>{card.label}</p>
                <p className={`mt-1 font-semibold ${card.accent ? "" : "text-[#1A1A1A]"}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto ht-card">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-[#EAF3FC] text-left text-[#5B6B7B]">
                <tr>
                  <th className="px-4 py-2 font-medium">พนักงาน</th>
                  <th className="px-2 py-2 text-right font-medium">มา</th>
                  <th className="px-2 py-2 text-right font-medium">ลา</th>
                  <th className="px-2 py-2 text-right font-medium">ขาด</th>
                  <th className="px-2 py-2 text-right font-medium">สาย (นาที)</th>
                  <th className="px-2 py-2 text-right font-medium">OT (ชม.)</th>
                  <th className="px-2 py-2 text-right font-medium">รายการหัก</th>
                  <th className="px-4 py-2 text-right font-medium">สุทธิ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#5B6B7B]/10">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-[#EAF3FC]/50">
                    <td className="px-4 py-2">
                      <Link href={`/payslip/${p.id}`} className="font-medium text-[#1E5FA8] hover:underline">
                        {p.full_name}
                      </Link>
                      <p className="text-xs text-[#5B6B7B]">
                        {p.employee_code} · {p.dept_name}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-right">{p.worked_days}</td>
                    <td className="px-2 py-2 text-right">
                      {p.leave_days}
                      {p.over_quota_days > 0 ? <span className="ml-1 text-xs text-[#D64545]">(เกิน {p.over_quota_days})</span> : null}
                    </td>
                    <td className={`px-2 py-2 text-right ${p.absent_days > 0 ? "text-[#D64545]" : ""}`}>{p.absent_days}</td>
                    <td className={`px-2 py-2 text-right ${p.late_minutes > 0 ? "text-[#E8890C]" : ""}`}>{p.late_minutes}</td>
                    <td className="px-2 py-2 text-right">{p.ot_hours}</td>
                    <td className="px-2 py-2 text-right text-[#D64545]">
                      {formatBaht(Number(p.late_deduction) + Number(p.leave_penalty) + Number(p.social_security))}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-[#1A1A1A]">{formatBaht(Number(p.net_pay))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#5B6B7B]/30 bg-white/60 p-6 text-center text-sm text-[#5B6B7B]">
          ยังไม่มีข้อมูลเงินเดือนของงวดนี้
        </div>
      )}
    </div>
  );
}
