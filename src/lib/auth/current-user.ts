import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentEmployee = {
  id: string;
  employeeCode: string;
  fullName: string;
  deptCode: string;
  deptName: string;
  role: string;
  /** รูปโปรไฟล์ใน bucket "avatars" (null = ยังไม่ได้ตั้ง) */
  photoPath: string | null;
};

/**
 * ข้อมูลพนักงานของผู้ใช้ที่ล็อกอินอยู่ (เรียกได้เฉพาะฝั่งเซิร์ฟเวอร์)
 * คืนค่า null ถ้ายังไม่ได้ล็อกอิน หรือบัญชีถูกปิดใช้งาน (ลาออกแล้ว)
 * ห่อด้วย cache() กันไม่ให้ยิงซ้ำถ้าหลาย component เรียกในการ render รอบเดียวกัน
 */
export const getCurrentEmployee = cache(async (): Promise<CurrentEmployee | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: employee } = await supabase
    .from("employees")
    .select("id, employee_code, full_name, dept_code, photo_path")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .single();
  if (!employee) return null;

  const { data: department } = await supabase
    .from("departments")
    .select("name, role")
    .eq("code", employee.dept_code)
    .single();
  if (!department) return null;

  return {
    id: employee.id,
    employeeCode: employee.employee_code,
    fullName: employee.full_name,
    deptCode: employee.dept_code,
    deptName: department.name,
    role: department.role,
    photoPath: employee.photo_path,
  };
});