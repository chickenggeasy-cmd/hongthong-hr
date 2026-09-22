"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  deriveLoginPassword,
  employeeEmail,
  isValidEmployeeCode,
  isValidThaiNationalId,
  normalizeNationalId,
} from "@/lib/auth/national-id";

export type LoginState = { error: string | null };

// ข้อความ error เดียวกันทุกกรณี (รูปแบบผิด / ไม่พบรหัสพนักงาน / เลขบัตรไม่ตรง)
// เพื่อไม่ให้เดารหัสพนักงานที่มีอยู่จริงได้จากข้อความ error ที่ต่างกัน
const INVALID_MESSAGE = "รหัสพนักงานหรือเลขบัตรประชาชนไม่ถูกต้อง";

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  const nationalId = normalizeNationalId(String(formData.get("nationalId") ?? ""));

  if (!isValidEmployeeCode(employeeCode) || !isValidThaiNationalId(nationalId)) {
    return { error: INVALID_MESSAGE };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: employeeEmail(employeeCode),
    password: deriveLoginPassword(employeeCode, nationalId),
  });

  // TODO(ก่อนขึ้นระบบจริง): จำกัดจำนวนครั้งที่ลองผิดต่อ IP/รหัสพนักงาน กันการเดาเลขบัตรแบบไล่ทีละเลข
  if (error) {
    return { error: INVALID_MESSAGE };
  }

  redirect("/");
}