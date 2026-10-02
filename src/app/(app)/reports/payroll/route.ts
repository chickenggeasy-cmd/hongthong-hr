import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWorkbook, excelResponse, MONEY_FORMAT, sheet } from "@/lib/export/excel";
import { isValidPeriod } from "@/lib/payroll/logic";
import { badRequest, reportGuard } from "@/lib/reports/guard";

// รายงานเงินเดือนรายงวด (Excel) — อ่านด้วย client ปกติ RLS ให้ 00/01/HR เห็นทุกสลิป
export async function GET(request: NextRequest) {
  const denied = await reportGuard();
  if (denied) return denied;

  const period = request.nextUrl.searchParams.get("period") ?? "";
  if (!isValidPeriod(period)) return badRequest("งวดไม่ถูกต้อง");

  const supabase = await createClient();
  const { data: run } = await supabase.from("payroll_runs").select("id, status").eq("period", period).maybeSingle();
  if (!run) return badRequest("งวดนี้ยังไม่ได้คำนวณเงินเดือน");

  const { data: payslips } = await supabase
    .from("payslips")
    .select("*")
    .eq("run_id", run.id)
    .order("employee_code");
  type Row = NonNullable<typeof payslips>[number];

  const buffer = await buildWorkbook([
    sheet<Row>({
      name: `เงินเดือน ${period}${run.status === "finalized" ? "" : " (ร่าง)"}`,
      rows: payslips ?? [],
      columns: [
        { header: "รหัสพนักงาน", value: (r) => r.employee_code, width: 12 },
        { header: "ชื่อ-นามสกุล", value: (r) => r.full_name, width: 26 },
        { header: "แผนก", value: (r) => r.dept_name, width: 26 },
        { header: "วันทำงาน", value: (r) => r.working_days, width: 10 },
        { header: "มาทำงาน", value: (r) => r.worked_days, width: 10 },
        { header: "วันหยุดนักขัตฤกษ์", value: (r) => r.paid_holiday_days, width: 10 },
        { header: "ลา", value: (r) => r.leave_days, width: 8 },
        { header: "ลาเกินโควตา", value: (r) => r.over_quota_days, width: 10 },
        { header: "ขาดงาน", value: (r) => r.absent_days, width: 8 },
        { header: "สาย (ครั้ง)", value: (r) => r.late_days, width: 10 },
        { header: "สาย (นาที)", value: (r) => r.late_minutes, width: 10 },
        { header: "OT (ชม.)", value: (r) => r.ot_hours, width: 10 },
        { header: "ค่าจ้าง", value: (r) => Number(r.base_pay), numFmt: MONEY_FORMAT },
        { header: "ค่า OT", value: (r) => Number(r.ot_pay), numFmt: MONEY_FORMAT },
        { header: "หักมาสาย", value: (r) => Number(r.late_deduction), numFmt: MONEY_FORMAT },
        { header: "หักลาเกินโควตา", value: (r) => Number(r.leave_penalty), numFmt: MONEY_FORMAT },
        { header: "ประกันสังคม", value: (r) => Number(r.social_security), numFmt: MONEY_FORMAT },
        { header: "ภาษีหัก ณ ที่จ่าย", value: (r) => Number(r.withholding_tax), numFmt: MONEY_FORMAT },
        { header: "รับสุทธิ", value: (r) => Number(r.net_pay), numFmt: MONEY_FORMAT },
      ],
    }),
  ]);
  return excelResponse(buffer, `payroll-${period}.xlsx`);
}
