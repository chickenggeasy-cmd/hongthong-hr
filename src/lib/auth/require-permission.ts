import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can, type Permission } from "@/lib/permissions";

/**
 * ตัวกั้นหน้าฝั่งเซิร์ฟเวอร์: เรียกบรรทัดแรกของ page.tsx ที่ต้องมีสิทธิ์
 * ไม่มีสิทธิ์ (หรือไม่พบพนักงาน) → เด้งกลับหน้าแรก
 * ไม่เด้งไป /login เพราะ proxy.ts จะเห็นว่าล็อกอินอยู่แล้วส่งกลับมา วนซ้ำ
 */
export async function requirePermission(permission: Permission) {
  const employee = await getCurrentEmployee();
  if (!employee || !can(employee.role, permission)) redirect("/");
  return employee;
}