"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import {
  deriveLoginPassword,
  employeeEmail,
  hashNationalId,
  isValidThaiNationalId,
  normalizeNationalId,
} from "@/lib/auth/national-id";

export type RegisterEmployeeState = {
  error: string | null;
  success: boolean;
  employeeCode?: string;
};

export async function registerEmployee(
  _prevState: RegisterEmployeeState,
  formData: FormData,
): Promise<RegisterEmployeeState> {
  // ตัวกั้นสิทธิ์: เฉพาะ employees.manage (การเงิน/HR) ตาม permissions.ts
  // หน้าเว็บกันไว้ชั้นหนึ่งแล้ว (requirePermission ใน page.tsx) แต่ Server Action ต้องกันซ้ำ
  // เพราะเรียกตรงได้โดยไม่ผ่านหน้าเว็บ (เช่น แก้ HTML ฟอร์มเอง)
  const actor = await getCurrentEmployee();
  if (!actor || !can(actor.role, "employees.manage")) {
    return { error: "คุณไม่มีสิทธิ์ทำรายการนี้", success: false };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const deptCode = String(formData.get("deptCode") ?? "").trim();
  const nationalId = normalizeNationalId(String(formData.get("nationalId") ?? ""));

  if (fullName.length < 2) {
    return { error: "กรุณากรอกชื่อ-นามสกุล", success: false };
  }
  if (!/^\d{2}$/.test(deptCode)) {
    return { error: "กรุณาเลือกแผนก", success: false };
  }
  if (!isValidThaiNationalId(nationalId)) {
    return { error: "เลขบัตรประชาชนไม่ถูกต้อง (ต้อง 13 หลักและผ่านการตรวจหลักตรวจสอบ)", success: false };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("register_employee", {
    p_dept_code: deptCode,
    p_full_name: fullName,
    p_national_id_hash: hashNationalId(nationalId),
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "เลขบัตรประชาชนนี้ถูกลงทะเบียนไว้แล้ว", success: false };
    }
    return { error: "ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่", success: false };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.new_id || !row?.new_employee_code) {
    return { error: "ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่", success: false };
  }
  const employeeId = row.new_id;
  const employeeCode = row.new_employee_code;

  // สร้างบัญชีล็อกอินใน Supabase Auth แล้วผูกกับพนักงาน (ขั้นตอนเดียวกับ scripts/create-first-user.ts)
  // ไม่มีขั้นนี้ พนักงานจะได้รหัสพนักงานแต่ล็อกอินไม่ได้
  // ถ้าพลาด ล้างแถวพนักงานที่เพิ่งสร้าง เลขบัตรจะได้ไม่ค้างเป็น "ลงทะเบียนแล้ว"
  const created = await supabase.auth.admin.createUser({
    email: employeeEmail(employeeCode),
    password: deriveLoginPassword(employeeCode, nationalId),
    email_confirm: true,
    user_metadata: { employee_code: employeeCode },
  });
  if (created.error || !created.data.user) {
    await supabase.from("employees").delete().eq("id", employeeId);
    return { error: "สร้างบัญชีล็อกอินไม่สำเร็จ กรุณาลองใหม่", success: false };
  }

  const link = await supabase.from("employees").update({ auth_user_id: created.data.user.id }).eq("id", employeeId);
  if (link.error) {
    await supabase.auth.admin.deleteUser(created.data.user.id);
    await supabase.from("employees").delete().eq("id", employeeId);
    return { error: "ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่", success: false };
  }

  revalidatePath("/employees");
  return { error: null, success: true, employeeCode };
}