import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatThaiDate } from "@/lib/date";
import { formatBaht, periodLabel } from "@/lib/payroll/logic";
import { dayStatusLabel, payslipDays, payslipLines, payslipStats } from "@/lib/payroll/payslip-view";

const STATUS_COLOR: Record<string, string> = {
  worked: "text-[#2E9E5B]",
  absent: "text-[#D64545]",
  leave: "text-[#E8890C]",
  holiday: "text-[#1E5FA8]",
};

export default async function PayslipDetailPage({ params }: PageProps<"/payslip/[id]">) {
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  const { id } = await params;
  // RLS คุมสิทธิ์: พนักงานเห็นเฉพาะสลิปตัวเองในงวดที่ปิดแล้ว, 00/01/HR เห็นทุกใบ (รวมงวดร่าง)
  const supabase = await createClient();
  const { data: payslip } = await supabase
    .from("payslips")
    .select("*, payroll_runs(period, cycle_start, cycle_end, status)")
    .eq("id", id)
    .maybeSingle();
  if (!payslip || !payslip.payroll_runs) notFound();

  const run = payslip.payroll_runs;
  const { earnings, deductions } = payslipLines(payslip);
  const days = payslipDays(payslip.details).filter((d) => d.status !== "future" && d.status !== "not_employed");
  const backHref = can(employee.role, "payroll.view") && payslip.employee_id !== employee.id ? `/payroll?period=${run.period}` : "/payslip";

  return (
    <div className="space-y-4">
      <Link href={backHref} className="text-sm text-[#1E5FA8] hover:underline">
        ← กลับ
      </Link>

      <div className="relative overflow-hidden rounded-2xl bg-[#1E5FA8] p-6 text-white shadow-sm">
        <div className="absolute left-0 top-0 h-1 w-full bg-[#D4A017]" aria-hidden />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">สลิปเงินเดือน งวด {periodLabel(run.period)}</p>
            <h1 className="text-xl font-semibold">{payslip.full_name}</h1>
            <p className="text-sm text-white/80">
              {payslip.employee_code} · {payslip.dept_name} · {formatThaiDate(run.cycle_start)} – {formatThaiDate(run.cycle_end)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/80">รับสุทธิ</p>
            <p className="text-3xl font-bold">{formatBaht(Number(payslip.net_pay))}</p>
            <p className="text-sm text-white/80">บาท</p>
          </div>
        </div>
        {run.status !== "finalized" ? (
          <p className="mt-3 inline-block rounded-full bg-[#E8890C] px-3 py-0.5 text-xs">ร่าง ยังไม่ปิดงวด อาจเปลี่ยนแปลงได้</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {payslipStats(payslip).map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-[#5B6B7B]">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold text-[#1A1A1A]">{stat.value} วัน</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { title: "รายได้", lines: earnings, color: "text-[#2E9E5B]" },
          { title: "รายการหัก", lines: deductions, color: "text-[#D64545]" },
        ].map((section) => (
          <section key={section.title} className="rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold text-[#1A1A1A]">{section.title}</h2>
            <dl className="space-y-2 text-sm">
              {section.lines.map((line) => (
                <div key={line.label} className="flex justify-between gap-3">
                  <dt className="text-[#5B6B7B]">{line.label}</dt>
                  <dd className={line.amount > 0 ? section.color : "text-[#5B6B7B]"}>{formatBaht(line.amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-[#5B6B7B]/15 pt-2 font-semibold">
                <dt>รวม</dt>
                <dd>{formatBaht(section.lines.reduce((sum, line) => sum + line.amount, 0))}</dd>
              </div>
            </dl>
          </section>
        ))}
      </div>

      <a
        href={`/payslip/${payslip.id}/pdf`}
        className="block rounded-2xl bg-[#1E5FA8] p-4 text-center font-medium text-white shadow-sm transition-colors hover:bg-[#1E5FA8]/90"
      >
        ดาวน์โหลดสลิป (PDF)
      </a>

      {days.length > 0 ? (
        <details className="rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm">
          <summary className="cursor-pointer font-semibold text-[#1A1A1A]">รายละเอียดรายวัน</summary>
          <ul className="mt-3 divide-y divide-[#5B6B7B]/10 text-sm">
            {days.map((day) => (
              <li key={day.date} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-[#1A1A1A]">{formatThaiDate(day.date)}</span>
                <span className="flex flex-wrap items-center gap-2 text-[#5B6B7B]">
                  {day.checkIn ? <span>เข้า {day.checkIn}</span> : null}
                  {day.checkOut ? <span>ออก {day.checkOut}</span> : null}
                  {day.lateMinutes > 0 ? <span className="text-[#E8890C]">สาย {day.lateMinutes} นาที</span> : null}
                  {day.otHours > 0 ? <span className="text-[#1E5FA8]">OT {day.otHours} ชม.</span> : null}
                  {day.overQuota ? <span className="text-[#D64545]">เกินโควตา</span> : null}
                  <span className={STATUS_COLOR[day.status] ?? ""}>{dayStatusLabel(day.status)}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
