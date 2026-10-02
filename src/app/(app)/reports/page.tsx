import { requirePermission } from "@/lib/auth/require-permission";
import { FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { createClient } from "@/lib/supabase/server";
import { addDays, bangkokToday, startOfMonth } from "@/lib/date";
import { periodLabel } from "@/lib/payroll/logic";
import { MAX_REPORT_DAYS } from "@/lib/reports/logic";

const inputClass =
  "rounded-lg border border-[#5B6B7B]/30 px-3 py-2 text-[#1A1A1A] outline-none focus:border-[#1E5FA8] focus:ring-2 focus:ring-[#1E5FA8]/20";
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
      <PageHeader icon={FileSpreadsheet} title="รายงาน" description="ดาวน์โหลดเป็นไฟล์ Excel (.xlsx) เปิดได้ด้วย Excel หรือ Google Sheets" />

      <section className="rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-[#1A1A1A]">เงินเดือนรายงวด</h2>
        <p className="mb-3 text-sm text-[#5B6B7B]">สรุปเงินเดือนทุกคนในงวด (รายได้ รายการหัก รับสุทธิ)</p>
        {!runs || runs.length === 0 ? (
          <p className="text-sm text-[#5B6B7B]">ยังไม่มีงวดที่คำนวณแล้ว</p>
        ) : (
          <form method="get" action="/reports/payroll" className="flex flex-wrap gap-2">
            <select name="period" aria-label="งวด" className={inputClass}>
              {runs.map((r) => (
                <option key={r.period} value={r.period}>
                  {periodLabel(r.period)}
                  {r.status === "finalized" ? "" : " (ร่าง)"}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClass}>
              ดาวน์โหลด
            </button>
          </form>
        )}
      </section>

      {[
        { action: "/reports/attendance", title: "การเข้างานรายวัน", help: "เวลาเข้า-ออก และนาทีที่มาสาย ของทุกคนทุกวัน" },
        { action: "/reports/requests", title: "คำขอลาและ OT", help: "คำขอทุกสถานะในช่วงวันที่ (2 ชีต: ลา / OT)" },
      ].map((report) => (
        <section key={report.action} className="rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-[#1A1A1A]">{report.title}</h2>
          <p className="mb-3 text-sm text-[#5B6B7B]">
            {report.help} · เลือกได้ไม่เกิน {MAX_REPORT_DAYS} วัน
          </p>
          <form method="get" action={report.action} className="flex flex-wrap items-center gap-2">
            <input type="date" name="from" required defaultValue={monthStart} aria-label="ตั้งแต่วันที่" className={inputClass} />
            <span className="text-[#5B6B7B]">ถึง</span>
            <input type="date" name="to" required defaultValue={today} max={addDays(today, 366)} aria-label="ถึงวันที่" className={inputClass} />
            <button type="submit" className={buttonClass}>
              ดาวน์โหลด
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
