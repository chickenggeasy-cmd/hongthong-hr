"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { addDays, bangkokToday } from "@/lib/date";
import { bangkokDateTime } from "@/lib/ot/logic";
import { toSettingsRecord } from "@/lib/settings";
import {
  canFinalize,
  computePayslip,
  isValidPeriod,
  leaveLookupRange,
  payrollCycle,
  readPayrollSettings,
} from "@/lib/payroll/logic";

export type PayrollActionState = { error: string | null; success: boolean; message?: string };

const FORBIDDEN: PayrollActionState = { error: "คุณไม่มีสิทธิ์จัดการเงินเดือน", success: false };
const GENERIC_ERROR = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

/** ทุก action ในไฟล์นี้ใช้ service role จึงต้องตรวจตัวตน + สิทธิ์ payroll.manage ก่อนเสมอ */
async function payrollManager() {
  const employee = await getCurrentEmployee();
  return employee && can(employee.role, "payroll.manage") ? employee : null;
}

export async function computePayroll(_prev: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const manager = await payrollManager();
  if (!manager) return FORBIDDEN;

  const period = String(formData.get("period") ?? "");
  if (!isValidPeriod(period)) return { error: "งวดไม่ถูกต้อง", success: false };

  // ใช้ service role เพราะต้องอ่าน app_settings (ปิดสิทธิ์ authenticated) และบันทึกผ่าน save_payroll_run()
  const supabase = createServiceClient();
  const { data: settingRows } = await supabase.from("app_settings").select("key, value");
  const settings = readPayrollSettings(toSettingsRecord(settingRows));
  if (!settings) return { error: "ตั้งค่ากติกาเงินเดือนไม่ครบ กรุณาตรวจสอบหน้าตั้งค่า", success: false };

  const today = bangkokToday();
  const cycle = payrollCycle(period, settings.cutoffDay);
  if (cycle.start > today) return { error: "ยังไม่ถึงรอบของงวดนี้", success: false };
  const lookup = leaveLookupRange(cycle);

  const [employees, attendance, leaves, ots, holidays] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("employees")
        .select("id, employee_code, full_name, created_at, departments(name)")
        .eq("status", "active")
        .order("employee_code")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("attendance_logs")
        .select("employee_id, type, recorded_at")
        .gte("recorded_at", bangkokDateTime(cycle.start, "00:00").toISOString())
        .lt("recorded_at", bangkokDateTime(addDays(cycle.end, 1), "00:00").toISOString())
        .order("recorded_at")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("leave_requests")
        .select("employee_id, start_date, end_date")
        .eq("status", "approved")
        .lte("start_date", lookup.to)
        .gte("end_date", lookup.from)
        .order("start_date")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("ot_requests")
        .select("employee_id, work_date, hours")
        .eq("status", "approved")
        .gte("work_date", cycle.start)
        .lte("work_date", cycle.end)
        .order("work_date")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("holidays")
        .select("holiday_date")
        .gte("holiday_date", lookup.from)
        .lte("holiday_date", lookup.to)
        .order("holiday_date")
        .range(from, to),
    ),
  ]);
  if (!employees || !attendance || !leaves || !ots || !holidays) return { error: GENERIC_ERROR, success: false };

  const holidaySet = new Set(holidays.map((h) => h.holiday_date));
  const byEmployee = <T extends { employee_id: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) map.set(row.employee_id, [...(map.get(row.employee_id) ?? []), row]);
    return map;
  };
  const attendanceBy = byEmployee(attendance);
  const leavesBy = byEmployee(leaves);
  const otsBy = byEmployee(ots);

  const payslips = employees.map((employee) => {
    const result = computePayslip({
      cycle,
      today,
      employedFrom: bangkokToday(new Date(employee.created_at)),
      holidays: holidaySet,
      attendance: (attendanceBy.get(employee.id) ?? []).map((a) => ({ type: a.type, recordedAt: a.recorded_at })),
      approvedLeaves: (leavesBy.get(employee.id) ?? []).map((l) => ({ startDate: l.start_date, endDate: l.end_date })),
      approvedOts: (otsBy.get(employee.id) ?? []).map((o) => ({ workDate: o.work_date, hours: o.hours })),
      settings,
    });
    return {
      employee_id: employee.id,
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      dept_name: employee.departments?.name ?? "",
      working_days: result.workingDays,
      worked_days: result.workedDays,
      paid_holiday_days: result.paidHolidayDays,
      leave_days: result.leaveDays,
      absent_days: result.absentDays,
      late_days: result.lateDays,
      late_minutes: result.lateMinutes,
      ot_hours: result.otHours,
      over_quota_days: result.overQuotaDays,
      daily_rate: result.dailyRate,
      base_pay: result.basePay,
      ot_pay: result.otPay,
      late_deduction: result.lateDeduction,
      leave_penalty: result.leavePenalty,
      social_security: result.socialSecurity,
      net_pay: result.netPay,
      details: result.days,
    };
  });

  const { error } = await supabase.rpc("save_payroll_run", {
    p_period: period,
    p_cycle_start: cycle.start,
    p_cycle_end: cycle.end,
    p_created_by: manager.id, // id จาก getCurrentEmployee() ไม่ใช่จากฟอร์ม
    p_payslips: payslips,
  });
  if (error) {
    return {
      error: error.message === "payroll.finalized" ? "งวดนี้ปิดไปแล้ว คำนวณใหม่ไม่ได้" : GENERIC_ERROR,
      success: false,
    };
  }

  revalidatePath("/payroll");
  return { error: null, success: true, message: `คำนวณเงินเดือน ${payslips.length} คนแล้ว` };
}

export async function finalizePayroll(_prev: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const manager = await payrollManager();
  if (!manager) return FORBIDDEN;

  const period = String(formData.get("period") ?? "");
  if (!isValidPeriod(period)) return { error: "งวดไม่ถูกต้อง", success: false };

  const supabase = createServiceClient();
  const { data: run } = await supabase
    .from("payroll_runs")
    .select("id, cycle_start, cycle_end, status, updated_at")
    .eq("period", period)
    .maybeSingle();
  if (!run) return { error: "ยังไม่ได้คำนวณงวดนี้", success: false };
  if (run.status !== "draft") return { error: "งวดนี้ปิดไปแล้ว", success: false };
  if (!canFinalize({ start: run.cycle_start, end: run.cycle_end }, bangkokToday())) {
    return { error: "ปิดงวดได้หลังพ้นวันตัดรอบแล้วเท่านั้น", success: false };
  }
  // ผลคำนวณต้องเป็นของหลังสิ้นงวด (ข้อมูลครบทุกวัน) ไม่ใช่ร่างที่คำนวณไว้กลางงวด
  if (new Date(run.updated_at) < bangkokDateTime(addDays(run.cycle_end, 1), "00:00")) {
    return { error: "ผลคำนวณนี้ทำไว้ก่อนสิ้นงวด กรุณากด \"คำนวณใหม่\" ก่อนปิดงวด", success: false };
  }

  const { error } = await supabase.rpc("finalize_payroll_run", { p_run_id: run.id, p_finalized_by: manager.id });
  if (error) return { error: GENERIC_ERROR, success: false };

  revalidatePath("/payroll");
  revalidatePath("/payslip");
  return { error: null, success: true, message: "ปิดงวดแล้ว พนักงานเห็นสลิปของตัวเองได้แล้ว" };
}
