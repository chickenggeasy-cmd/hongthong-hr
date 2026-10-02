import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatThaiDate } from "@/lib/date";
import { formatBaht, periodLabel } from "@/lib/payroll/logic";
import { dayStatusLabel, payslipDays, payslipLines, payslipStats } from "@/lib/payroll/payslip-view";
import { CardHeading } from "@/components/features/card-heading";
import { BrandPhoto } from "@/components/brand/photo";

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

      <div className="ht-rise relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#1E5FA8] via-[#174D8C] to-[#0F2D52] p-6 text-white shadow-[0_24px_48px_-24px_rgb(15_45_82/0.65)] sm:p-8">
        <BrandPhoto name="cashier" priority className="inset-y-0 right-0 w-full sm:w-[60%]" strength={0.5} />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F0C75E]/80 to-transparent" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">สลิปเงินเดือน งวด {periodLabel(run.period)}</p>
            <h1 className="text-xl font-semibold">{payslip.full_name}</h1>
            <p className="text-sm text-white/80">
              {payslip.employee_code} · {payslip.dept_name} · {formatThaiDate(run.cycle_start)} – {formatThaiDate(run.cycle_end)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/80">รับสุทธิ</p>
            <p className="text-4xl font-bold tracking-tight tabular-nums">{formatBaht(Number(payslip.net_pay))}</p>
            <p className="text-sm text-white/80">บาท</p>
          </div>
        </div>
        {run.status !== "finalized" ? (
          <p className="relative mt-3 inline-block rounded-full bg-[#E8890C] px-3 py-0.5 text-xs">ร่าง ยังไม่ปิดงวด อาจเปลี่ยนแปลงได้</p>
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
          { title: "รายได้", lines: earnings, color: "text-[#2E9E5B]", sticker: "money-wings" as const },
          { title: "รายการหัก", lines: deductions, color: "text-[#D64545]", sticker: "receipt" as const },
        ].map((section) => (
          <section key={section.title} className="ht-card p-6">
            <CardHeading sticker={section.sticker}>{section.title}</CardHeading>
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
        <details className="ht-card p-6">
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
