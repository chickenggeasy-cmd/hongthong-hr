import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { buildWorkbook, excelResponse, sheet } from "@/lib/export/excel";
import { leaveStatusLabel, leaveTypeLabel } from "@/lib/leave/logic";
import { validateReportRange } from "@/lib/reports/logic";
import { badRequest, reportGuard } from "@/lib/reports/guard";

// รายงานคำขอลา + OT ในช่วงวันที่ (Excel 2 ชีต)
export async function GET(request: NextRequest) {
  const denied = await reportGuard();
  if (denied) return denied;

  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  const rangeError = validateReportRange(from, to);
  if (rangeError) return badRequest(rangeError);

  const supabase = await createClient();
  const employee = "employee:employees!leave_requests_employee_id_fkey(employee_code, full_name, departments(name))";
  const [leaves, ots] = await Promise.all([
    fetchAllRows((start, end) =>
      supabase
        .from("leave_requests")
        .select(`id, leave_type, start_date, end_date, days_count, status, exceeds_quota, reason, ${employee}`)
        .lte("start_date", to)
        .gte("end_date", from)
        .order("start_date")
        .order("id")
        .range(start, end),
    ),
    fetchAllRows((start, end) =>
      supabase
        .from("ot_requests")
        .select("id, work_date, hours, status, reason, employee:employees!ot_requests_employee_id_fkey(employee_code, full_name, departments(name))")
        .gte("work_date", from)
        .lte("work_date", to)
        .order("work_date")
        .order("id")
        .range(start, end),
    ),
  ]);
  if (!leaves || !ots) return badRequest("ดึงข้อมูลไม่สำเร็จ กรุณาลองใหม่");

  const buffer = await buildWorkbook([
    sheet<(typeof leaves)[number]>({
      name: "คำขอลา",
      rows: leaves,
      columns: [
        { header: "รหัสพนักงาน", value: (r) => r.employee?.employee_code ?? "", width: 12 },
        { header: "ชื่อ-นามสกุล", value: (r) => r.employee?.full_name ?? "", width: 26 },
        { header: "แผนก", value: (r) => r.employee?.departments?.name ?? "", width: 26 },
        { header: "ประเภท", value: (r) => leaveTypeLabel(r.leave_type), width: 12 },
        { header: "ตั้งแต่", value: (r) => r.start_date, width: 12 },
        { header: "ถึง", value: (r) => r.end_date, width: 12 },
        { header: "จำนวนวัน", value: (r) => r.days_count, width: 10 },
        { header: "สถานะ", value: (r) => leaveStatusLabel(r.status), width: 12 },
        { header: "เกินโควตา", value: (r) => (r.exceeds_quota ? "ใช่" : ""), width: 10 },
        { header: "เหตุผล", value: (r) => r.reason, width: 30 },
      ],
    }),
    sheet<(typeof ots)[number]>({
      name: "คำขอ OT",
      rows: ots,
      columns: [
        { header: "รหัสพนักงาน", value: (r) => r.employee?.employee_code ?? "", width: 12 },
        { header: "ชื่อ-นามสกุล", value: (r) => r.employee?.full_name ?? "", width: 26 },
        { header: "แผนก", value: (r) => r.employee?.departments?.name ?? "", width: 26 },
        { header: "วันที่", value: (r) => r.work_date, width: 12 },
        { header: "ชั่วโมง", value: (r) => r.hours, width: 10 },
        { header: "สถานะ", value: (r) => leaveStatusLabel(r.status), width: 12 },
        { header: "งาน", value: (r) => r.reason, width: 30 },
      ],
    }),
  ]);
  return excelResponse(buffer, `requests-${from}-to-${to}.xlsx`);
}
