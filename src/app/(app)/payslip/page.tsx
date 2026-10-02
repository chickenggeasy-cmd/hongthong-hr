import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { Sticker } from "@/components/brand/sticker";
import { PageHeader } from "@/components/features/page-header";
import { EmptyState } from "@/components/features/empty-state";
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
    .select(
      "id, net_pay, payroll_runs!inner(period, cycle_start, cycle_end, status)",
    )
    .eq("employee_id", employee.id)
    .eq("payroll_runs.status", "finalized")
    .order("created_at", { ascending: false })
    .limit(24);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ReceiptText}
        sticker="receipt"
        title="สลิปเงินเดือนของฉัน"
        description="สลิปจะแสดงหลังฝ่ายการเงิน/HR ปิดงวดแล้ว ดาวน์โหลดเป็น PDF ได้"
      />

      {!payslips || payslips.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#5B6B7B]/30 bg-white/60">
          <EmptyState sticker="receipt">ยังไม่มีสลิปเงินเดือน</EmptyState>
        </div>
      ) : (
        <ul className="space-y-3">
          {payslips.map((p, i) => (
            <li
              key={p.id}
              className="ht-rise"
              style={{ animationDelay: `${100 + i * 60}ms` }}
            >
              <Link
                href={`/payslip/${p.id}`}
                className="group flex items-center justify-between ht-card p-5 ht-lift hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#1E5FA8]/10"
              >
                <div className="flex items-center gap-4">
                  <Sticker
                    name="money-bag"
                    size={44}
                    className="transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-6 group-hover:scale-110"
                  />
                  <div>
                    <p className="font-medium text-[#1A1A1A]">
                      งวด {periodLabel(p.payroll_runs.period)}
                    </p>
                    <p className="text-sm text-[#5B6B7B]">
                      {formatThaiDate(p.payroll_runs.cycle_start)} –{" "}
                      {formatThaiDate(p.payroll_runs.cycle_end)}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-semibold text-[#1E5FA8]">
                  {formatBaht(Number(p.net_pay))} ฿
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
