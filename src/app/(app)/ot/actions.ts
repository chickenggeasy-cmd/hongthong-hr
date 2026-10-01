"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { numberSetting, timeSetting, toSettingsRecord } from "@/lib/settings";
import { otErrorMessage, validateOtInput } from "@/lib/ot/logic";

export type OtRequestState = {
  error: string | null;
  success: boolean;
  hours?: number;
};

export async function requestOt(_prevState: OtRequestState, formData: FormData): Promise<OtRequestState> {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", success: false };
  }

  const input = {
    workDate: String(formData.get("workDate") ?? ""),
    hours: String(formData.get("hours") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  };

  // request_ot() เป็น SECURITY DEFINER หาตัวพนักงานจาก auth.uid() เอง จึงใช้ client ปกติได้
  const supabase = await createClient();
  const [{ data: settingRows }, { data: holidayRows }] = await Promise.all([
    supabase.rpc("public_settings"),
    supabase.from("holidays").select("holiday_date").eq("holiday_date", input.workDate || "1900-01-01"),
  ]);
  const settings = toSettingsRecord(settingRows);
  const maxHoursPerDay = numberSetting(settings, "ot.max_hours_per_day");
  const workEndTime = timeSetting(settings, "work.end_time");
  if (maxHoursPerDay === null || workEndTime === null) {
    return { error: otErrorMessage("ot.settings_missing"), success: false };
  }

  // ตรวจล่วงหน้าเพื่อให้ได้ข้อความที่ละเอียดกว่า ฐานข้อมูลจะตรวจซ้ำอีกครั้งเสมอ
  const validationError = validateOtInput(
    input,
    new Date(),
    { maxHoursPerDay, workEndTime },
    new Set((holidayRows ?? []).map((row) => row.holiday_date)),
  );
  if (validationError) {
    return { error: validationError, success: false };
  }

  const { error } = await supabase.rpc("request_ot", {
    p_work_date: input.workDate,
    p_hours: Number(input.hours),
    p_reason: input.reason,
  });
  if (error) {
    return { error: otErrorMessage(error.message), success: false };
  }

  revalidatePath("/ot");
  revalidatePath("/approvals");
  return { error: null, success: true, hours: Number(input.hours) };
}
