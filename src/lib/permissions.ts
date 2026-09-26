// role มาจาก departments.role ในฐานข้อมูล (ดู supabase/migrations/..._init_core.sql)
export type Role = "executive" | "finance" | "hr" | "head" | "employee";

export const ROLE_LABEL_TH: Record<Role, string> = {
  executive: "ผู้บริหาร",
  finance: "การเงิน",
  hr: "HR",
  head: "หัวหน้าแผนก",
  employee: "พนักงาน",
};

/** แปลง role จากฐานข้อมูล (เผื่อค่าที่ไม่รู้จัก) เป็นป้ายภาษาไทยที่แสดงผลได้เสมอ */
export function roleLabel(role: string): string {
  return ROLE_LABEL_TH[role as Role] ?? role;
}

// ตาม docs/ ข้อ 3 (สิทธิ์ผู้ใช้): คำขอของ 01/20/21 เองต้องให้ 00 อนุมัติ, ที่เหลือ 01/20/21 อนุมัติกันเองได้
// ใช้ตอนทำหน้าอนุมัติลา/OT ในเฟสถัดไป — ยังไม่ได้ใช้จริงตอนนี้
export function isApproverRole(role: string): boolean {
  return role === "executive" || role === "finance" || role === "hr";
}