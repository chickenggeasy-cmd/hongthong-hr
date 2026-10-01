import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { renderPayslipPdf } from "@/lib/export/payslip-pdf";

// ดาวน์โหลดสลิปเป็น PDF — ใช้ Route Handler (ไม่ใช่ Server Action) เพราะต้องส่งไฟล์กลับให้เบราว์เซอร์ดาวน์โหลด
// อ่านสลิปด้วย client ปกติ RLS จึงคุมสิทธิ์เอง: พนักงานได้เฉพาะสลิปตัวเองของงวดที่ปิดแล้ว, 00/01/HR ได้ทุกใบ
export async function GET(_request: Request, ctx: RouteContext<"/payslip/[id]/pdf">) {
  const employee = await getCurrentEmployee();
  if (!employee) return new Response("ไม่พบสลิป", { status: 404 });

  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: payslip } = await supabase
    .from("payslips")
    .select("*, payroll_runs(period, cycle_start, cycle_end)")
    .eq("id", id)
    .maybeSingle();
  // ไม่มีสิทธิ์ กับ ไม่มีอยู่จริง ตอบเหมือนกัน
  if (!payslip || !payslip.payroll_runs) return new Response("ไม่พบสลิป", { status: 404 });

  const pdf = await renderPayslipPdf({
    payslip,
    period: payslip.payroll_runs.period,
    cycleStart: payslip.payroll_runs.cycle_start,
    cycleEnd: payslip.payroll_runs.cycle_end,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payslip-${payslip.employee_code}-${payslip.payroll_runs.period}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
