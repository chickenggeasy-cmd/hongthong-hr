"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { bangkokToday } from "@/lib/date";
import { leaveErrorMessage, validateLeaveInput, LEAVE_GENERIC_ERROR } from "@/lib/leave/logic";

export type LeaveRequestState = {
  error: string | null;
  success: boolean;
  daysCount?: number;
  exceedsQuota?: boolean;
};

export async function requestLeave(_prevState: LeaveRequestState, formData: FormData): Promise<LeaveRequestState> {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", success: false };
  }

  const input = {
    type: String(formData.get("leaveType") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  };

  // ใช้ client ปกติ (ไม่ใช่ service role) เพราะ request_leave() เป็น SECURITY DEFINER
  // ที่หาตัวพนักงานจาก auth.uid() เอง จึงยื่นแทนคนอื่นไม่ได้ ไม่ต้องส่ง employee id ไปเลย
  const supabase = await createClient();

  const { data: settingsRows, error: settingsError } = await supabase.rpc("leave_settings");
  const settings = settingsRows?.[0];
  if (settingsError || !settings) {
    return { error: "ระบบยังไม่ได้ตั้งค่ากติกาการลา กรุณาติดต่อ HR", success: false };
  }

  const { data: holidayRows } = await supabase
    .from("holidays")
    .select("holiday_date")
    .gte("holiday_date", input.startDate || "1900-01-01")
    .lte("holiday_date", input.endDate || "1900-01-01");

  // ตรวจล่วงหน้าเพื่อให้ได้ข้อความที่ละเอียดกว่า ฐานข้อมูลจะตรวจซ้ำอีกครั้งเสมอ
  const validationError = validateLeaveInput(
    input,
    bangkokToday(),
    {
      monthlyQuotaDays: settings.monthly_quota_days,
      advanceNoticeMonths: settings.advance_notice_months,
      sickBackdateDays: settings.sick_backdate_days,
    },
    new Set((holidayRows ?? []).map((row) => row.holiday_date)),
  );
  if (validationError) {
    return { error: validationError, success: false };
  }

  const { data, error } = await supabase.rpc("request_leave", {
    p_leave_type: input.type,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_reason: input.reason,
  });
  if (error) {
    return { error: leaveErrorMessage(error.message), success: false };
  }
  const created = data?.[0];
  if (!created) {
    return { error: LEAVE_GENERIC_ERROR, success: false };
  }

  revalidatePath("/leave");
  revalidatePath("/approvals");
  return { error: null, success: true, daysCount: created.total_days, exceedsQuota: created.over_quota };
}
