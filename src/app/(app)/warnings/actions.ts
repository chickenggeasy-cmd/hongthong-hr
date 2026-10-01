"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { numberSetting, toSettingsRecord } from "@/lib/settings";
import { isValidPeriod, periodLabel } from "@/lib/payroll/logic";
import { autoWarnings, validateManualWarning } from "@/lib/warnings/logic";

export type WarningActionState = { error: string | null; success: boolean; message?: string };

const FORBIDDEN: WarningActionState = { error: "คุณไม่มีสิทธิ์ออกใบเตือน", success: false };
const GENERIC_ERROR = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

/** ออกใบเตือน = สิทธิ์ employees.manage (01/HR ตามเอกสาร SA ข้อ 3) ตรวจก่อนใช้ service role เสมอ */
async function warningIssuer() {
  const employee = await getCurrentEmployee();
  return employee && can(employee.role, "employees.manage") ? employee : null;
}

export async function generateWarnings(_prev: WarningActionState, formData: FormData): Promise<WarningActionState> {
  if (!(await warningIssuer())) return FORBIDDEN;

  const period = String(formData.get("period") ?? "");
  if (!isValidPeriod(period)) return { error: "กรุณาเลือกงวด", success: false };

  const supabase = createServiceClient();
  const [{ data: settingRows }, { data: run }] = await Promise.all([
    supabase.from("app_settings").select("key, value").like("key", "warning.%"),
    supabase.from("payroll_runs").select("id").eq("period", period).maybeSingle(),
  ]);
  const settings = toSettingsRecord(settingRows);
  const lateCount = numberSetting(settings, "warning.late_count_threshold");
  const absentDays = numberSetting(settings, "warning.absent_days_threshold");
  if (lateCount === null || absentDays === null) return { error: "ยังไม่ได้ตั้งค่าเกณฑ์ใบเตือน", success: false };
  if (!run) return { error: "งวดนี้ยังไม่ได้คำนวณเงินเดือน กรุณาคำนวณก่อน", success: false };

  const { data: payslips, error: payslipError } = await supabase
    .from("payslips")
    .select("employee_id, late_days, late_minutes, absent_days")
    .eq("run_id", run.id);
  if (payslipError || !payslips) return { error: GENERIC_ERROR, success: false };

  const warnings = autoWarnings(payslips, { lateCount, absentDays }, periodLabel(period));
  if (warnings.length === 0) return { error: null, success: true, message: "ไม่มีใครถึงเกณฑ์ใบเตือนในงวดนี้" };

  // ignoreDuplicates: ใบเตือนอัตโนมัติประเภทเดียวกันในงวดเดียวกันออกครั้งเดียว กดซ้ำไม่ออกซ้ำ
  const { data: inserted, error } = await supabase
    .from("warnings")
    .upsert(
      warnings.map((w) => ({ ...w, period })),
      { onConflict: "employee_id,period,kind", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return { error: GENERIC_ERROR, success: false };

  revalidatePath("/warnings");
  revalidatePath("/");
  const count = inserted?.length ?? 0;
  return {
    error: null,
    success: true,
    message: count > 0 ? `ออกใบเตือนใหม่ ${count} ใบ` : "ทุกคนที่ถึงเกณฑ์ได้รับใบเตือนของงวดนี้ไปแล้ว",
  };
}

export async function issueWarning(_prev: WarningActionState, formData: FormData): Promise<WarningActionState> {
  const issuer = await warningIssuer();
  if (!issuer) return FORBIDDEN;

  const employeeId = String(formData.get("employeeId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const validationError = validateManualWarning(employeeId, reason);
  if (validationError) return { error: validationError, success: false };
  if (employeeId === issuer.id) return { error: "ออกใบเตือนให้ตัวเองไม่ได้", success: false };

  const supabase = createServiceClient();
  const { data: target } = await supabase.from("employees").select("id").eq("id", employeeId).eq("status", "active").maybeSingle();
  if (!target) return { error: "ไม่พบพนักงาน", success: false };

  const { error } = await supabase.from("warnings").insert({
    employee_id: employeeId,
    kind: "manual",
    reason: reason.trim(),
    issued_by: issuer.id, // id จาก getCurrentEmployee() ไม่ใช่จากฟอร์ม
  });
  if (error) return { error: GENERIC_ERROR, success: false };

  revalidatePath("/warnings");
  return { error: null, success: true, message: "ออกใบเตือนแล้ว" };
}

/** พนักงานกดรับทราบใบเตือนของตัวเอง (ฟังก์ชันในฐานข้อมูลตรวจเองว่าเป็นใบของผู้ใช้คนนี้) */
export async function acknowledgeWarning(_prev: WarningActionState, formData: FormData): Promise<WarningActionState> {
  const employee = await getCurrentEmployee();
  if (!employee) return { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", success: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_warning", { p_warning_id: String(formData.get("warningId") ?? "") });
  if (error) return { error: "ไม่พบใบเตือน หรือรับทราบไปแล้ว", success: false };

  revalidatePath("/");
  revalidatePath("/warnings");
  return { error: null, success: true };
}
