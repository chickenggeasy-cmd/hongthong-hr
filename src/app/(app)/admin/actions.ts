"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import {
  SETTING_DEFINITIONS,
  validateHoliday,
  validateSettingCombination,
  validateSettingValue,
} from "@/lib/admin/settings";

export type AdminFormState = { error: string | null; success: boolean; message?: string };

const FORBIDDEN: AdminFormState = { error: "คุณไม่มีสิทธิ์แก้ไขการตั้งค่า", success: false };
const GENERIC_ERROR = "บันทึกไม่สำเร็จ กรุณาลองใหม่";

/** ทุก action ในไฟล์นี้ใช้ service role จึงต้องตรวจตัวตน + สิทธิ์ด้วย client ปกติก่อนเสมอ */
async function canAdmin() {
  const employee = await getCurrentEmployee();
  return employee !== null && can(employee.role, "admin.view");
}

function revalidateAll() {
  // ค่าตั้งค่ากระทบหลายหน้า (ลา, OT, เช็คอิน, เงินเดือน) ล้างแคชทั้งเว็บ
  revalidatePath("/", "layout");
}

export async function updateSettings(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await canAdmin())) return FORBIDDEN;

  // รับเฉพาะ key ที่อยู่ในรายการที่อนุญาต ไม่เชื่อชื่อช่องอื่นที่ส่งมาจากฟอร์ม
  const values: Record<string, string> = {};
  for (const definition of SETTING_DEFINITIONS) {
    const raw = formData.get(definition.key);
    if (raw === null) continue;
    const check = validateSettingValue(definition.key, String(raw));
    if (!check.ok) return { error: check.error, success: false };
    values[definition.key] = check.value;
  }
  if (Object.keys(values).length === 0) return { error: "ไม่มีค่าที่จะบันทึก", success: false };

  const supabase = createServiceClient();
  const { data: current } = await supabase.from("app_settings").select("key, value").in("key", Object.keys(values));
  const merged = { ...Object.fromEntries((current ?? []).map((row) => [row.key, row.value])), ...values };
  const combinationError = validateSettingCombination(merged);
  if (combinationError) return { error: combinationError, success: false };

  // แก้เฉพาะ key ที่มีอยู่แล้วในฐานข้อมูล (ไม่สร้าง key ใหม่จากหน้าเว็บ)
  const existingKeys = new Set((current ?? []).map((row) => row.key));
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(values)) {
    if (!existingKeys.has(key)) continue;
    const { error } = await supabase.from("app_settings").update({ value, updated_at: now }).eq("key", key);
    if (error) return { error: GENERIC_ERROR, success: false };
  }

  revalidateAll();
  return { error: null, success: true, message: "บันทึกการตั้งค่าแล้ว" };
}

export async function addHoliday(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await canAdmin())) return FORBIDDEN;

  const date = String(formData.get("holidayDate") ?? "");
  const name = String(formData.get("holidayName") ?? "");
  const validationError = validateHoliday(date, name);
  if (validationError) return { error: validationError, success: false };

  const supabase = createServiceClient();
  const { error } = await supabase.from("holidays").insert({ holiday_date: date, name: name.trim() });
  if (error) {
    // 23505 = วันที่ซ้ำ (holiday_date เป็น primary key)
    return { error: error.code === "23505" ? "มีวันหยุดวันนี้อยู่แล้ว" : GENERIC_ERROR, success: false };
  }

  revalidateAll();
  return { error: null, success: true, message: "เพิ่มวันหยุดแล้ว" };
}

export async function deleteHoliday(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await canAdmin())) return FORBIDDEN;

  const date = String(formData.get("holidayDate") ?? "");
  const supabase = createServiceClient();
  const { error } = await supabase.from("holidays").delete().eq("holiday_date", date);
  if (error) return { error: GENERIC_ERROR, success: false };

  revalidateAll();
  return { error: null, success: true, message: "ลบวันหยุดแล้ว" };
}
