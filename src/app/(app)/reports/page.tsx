import { requirePermission } from "@/lib/auth/require-permission";
import { FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { createClient } from "@/lib/supabase/server";
import { addDays, bangkokToday, startOfMonth } from "@/lib/date";
import { periodLabel } from "@/lib/payroll/logic";
import { MAX_REPORT_DAYS } from "@/lib/reports/logic";
import { CardHeading } from "@/components/features/card-heading";
import { SelectField } from "@/components/ui/select-field";
import { DateField } from "@/components/ui/date-field";

const buttonClass =
  "rounded-lg bg-[#1E5FA8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1E5FA8]/90";

// ฟอร์มในหน้านี้เป็น GET ธรรมดาไปที่ Route Handler เพื่อดาวน์โหลดไฟล์ (ไม่ได้แก้ข้อมูล จึงไม่ใช้ Server Action)
export default async function ReportsPage() {
  await requirePermission("payroll.view");

  const supabase = await createClient();
  const { data: runs } = await supabase.from("payroll_runs").select("period, status").order("period", { ascending: false }).limit(24);
  const today = bangkokToday();
  const monthStart = startOfMonth(today);

  return (
    <div className="space-y-6">
      <PageHeader photo="aisle2" icon={FileSpreadsheet} title="รายงาน" description="ดาวน์โหลดเป็นไฟล์ Excel (.xlsx) เปิดได้ด้วย Excel หรือ Google Sheets" />

      <section className="ht-card p-6">
        <CardHeading sticker="money-bag" className="mb-1">เงินเดือนรายงวด</CardHeading>
        <p className="mb-3 text-sm text-[#5B6B7B]">สรุปเงินเดือนทุกคนในงวด (รายได้ รายการหัก รับสุทธิ)</p>
        {!runs || runs.length === 0 ? (
          <p className="text-sm text-[#5B6B7B]">ยังไม่มีงวดที่คำนวณแล้ว</p>
        ) : (
          <form method="get" action="/reports/payroll" className="flex flex-wrap gap-2">
            <div className="w-60">
              <SelectField
                name="period"
                ariaLabel="งวด"
                defaultValue={runs[0].period}
                options={runs.map((r) => ({
                  value: r.period,
                  label: periodLabel(r.period),
                  description: r.status === "finalized" ? "ปิดงวดแล้ว" : "ร่าง ยังไม่ปิดงวด",
                }))}
              />
            </div>
            <button type="submit" className={buttonClass}>
              ดาวน์โหลด
            </button>
          </form>
        )}
      </section>

      {[
        { action: "/reports/attendance", sticker: "alarm-clock" as const, title: "การเข้างานรายวัน", help: "เวลาเข้า-ออก และนาทีที่มาสาย ของทุกคนทุกวัน" },
        { action: "/reports/requests", sticker: "chart-up" as const, title: "คำขอลาและ OT", help: "คำขอทุกสถานะในช่วงวันที่ (2 ชีต: ลา / OT)" },
      ].map((report) => (
        <section key={report.action} className="ht-card p-6">
          <CardHeading sticker={report.sticker} className="mb-1">{report.title}</CardHeading>
          <p className="mb-3 text-sm text-[#5B6B7B]">
            {report.help} · เลือกได้ไม่เกิน {MAX_REPORT_DAYS} วัน
          </p>
          <form method="get" action={report.action} className="flex flex-wrap items-center gap-2">
            <div className="w-48">
              <DateField name="from" required defaultValue={monthStart} ariaLabel="ตั้งแต่วันที่" />
            </div>
            <span className="text-[#5B6B7B]">ถึง</span>
            <div className="w-48">
              <DateField name="to" required defaultValue={today} max={addDays(today, 366)} ariaLabel="ถึงวันที่" />
            </div>
            <button type="submit" className={buttonClass}>
              ดาวน์โหลด
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
