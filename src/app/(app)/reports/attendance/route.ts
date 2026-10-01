import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { addDays } from "@/lib/date";
import { buildWorkbook, excelResponse, sheet } from "@/lib/export/excel";
import { timeSetting, toSettingsRecord } from "@/lib/settings";
import { bangkokDateTime } from "@/lib/ot/logic";
import { dailyAttendance, validateReportRange, type DailyAttendance } from "@/lib/reports/logic";
import { badRequest, reportGuard } from "@/lib/reports/guard";

// รายงานการเข้างานรายวัน (Excel) — 1 แถวต่อคนต่อวันที่มีเช็คอิน/เอาท์
export async function GET(request: NextRequest) {
  const denied = await reportGuard();
  if (denied) return denied;

  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  const rangeError = validateReportRange(from, to);
  if (rangeError) return badRequest(rangeError);

  const supabase = await createClient();
  const [{ data: employees }, logs, { data: settingRows }] = await Promise.all([
    supabase.from("employees").select("id, employee_code, full_name, departments(name)"),
    fetchAllRows((start, end) =>
      supabase
        .from("attendance_logs")
        .select("employee_id, type, recorded_at")
        .gte("recorded_at", bangkokDateTime(from, "00:00").toISOString())
        .lt("recorded_at", bangkokDateTime(addDays(to, 1), "00:00").toISOString())
        .order("recorded_at")
        .order("id")
        .range(start, end),
    ),
    supabase.rpc("public_settings"),
  ]);
  if (!logs) return badRequest("ดึงข้อมูลไม่สำเร็จ กรุณาลองใหม่");

  const workStart = timeSetting(toSettingsRecord(settingRows), "work.start_time") ?? "09:00";
  const people = new Map((employees ?? []).map((e) => [e.id, e]));
  const rows = dailyAttendance(logs, workStart);

  const buffer = await buildWorkbook([
    sheet<DailyAttendance>({
      name: "การเข้างาน",
      rows,
      columns: [
        { header: "วันที่", value: (r) => r.date, width: 12 },
        { header: "รหัสพนักงาน", value: (r) => people.get(r.employeeId)?.employee_code ?? "", width: 12 },
        { header: "ชื่อ-นามสกุล", value: (r) => people.get(r.employeeId)?.full_name ?? "", width: 26 },
        { header: "แผนก", value: (r) => people.get(r.employeeId)?.departments?.name ?? "", width: 26 },
        { header: "เวลาเข้า", value: (r) => r.checkIn, width: 10 },
        { header: "เวลาออก", value: (r) => r.checkOut, width: 10 },
        { header: "สาย (นาที)", value: (r) => r.lateMinutes, width: 10 },
      ],
    }),
  ]);
  return excelResponse(buffer, `attendance-${from}-to-${to}.xlsx`);
}
