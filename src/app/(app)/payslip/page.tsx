import Link from "next/link";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { formatThaiDate } from "@/lib/date";
import { formatBaht, periodLabel } from "@/lib/payroll/logic";

export default async function PayslipListPage() {
  // ทุกคนดูสลิปของตัวเองได้ จึงไม่ต้อง requirePermission()
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  // RLS ให้พนักงานเห็นเฉพาะสลิปของตัวเองในงวดที่ปิดแล้ว (00/01/HR เห็นทุกคน จึงกรองเฉพาะของตัวเองซ้ำ)
  const supabase = await createClient();
  const { data: payslips } = await supabase
    .from("payslips")
    .select("id, net_pay, payroll_runs!inner(period, cycle_start, cycle_end, status)")
    .eq("employee_id", employee.id)
    .eq("payroll_runs.status", "finalized")
    .order("created_at", { ascending: false })
    .limit(24);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-[#1A1A1A]">สลิปเงินเดือนของฉัน</h1>
        <p className="mt-1 text-sm text-[#5B6B7B]">สลิปจะแสดงหลังฝ่ายการเงิน/HR ปิดงวดแล้ว</p>
      </div>

      {!payslips || payslips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#5B6B7B]/30 bg-white/60 p-6 text-center text-sm text-[#5B6B7B]">
          ยังไม่มีสลิปเงินเดือน
        </div>
      ) : (
        <ul className="space-y-3">
          {payslips.map((p) => (
            <li key={p.id}>
              <Link
                href={`/payslip/${p.id}`}
                className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm transition-colors hover:bg-[#EAF3FC]"
              >
                <div>
                  <p className="font-medium text-[#1A1A1A]">งวด {periodLabel(p.payroll_runs.period)}</p>
                  <p className="text-sm text-[#5B6B7B]">
                    {formatThaiDate(p.payroll_runs.cycle_start)} – {formatThaiDate(p.payroll_runs.cycle_end)}
                  </p>
                </div>
                <p className="text-lg font-semibold text-[#1E5FA8]">{formatBaht(Number(p.net_pay))} ฿</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
