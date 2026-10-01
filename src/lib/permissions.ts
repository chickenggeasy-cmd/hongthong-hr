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

/**
 * สิทธิ์ระดับหน้าเว็บ (ใครเข้าหน้าไหน/เห็นเมนูไหนได้) — ตารางกลางที่เดียว แก้ที่นี่ที่เดียว
 * สิ่งที่ไม่ได้อยู่ในตารางนี้ = ทุกคนที่ล็อกอินทำได้ (เช็คอิน, ดูข้อมูลตัวเอง)
 *
 * หมายเหตุ: นี่คือชั้น "หน้าเว็บ" เท่านั้น การปกป้องข้อมูลจริงอยู่ที่ RLS ในฐานข้อมูลอีกชั้นหนึ่ง
 * ห้ามพึ่งการซ่อนเมนูอย่างเดียว
 */
export type Permission =
  | "team.view" // ดูข้อมูลลูกทีม
  | "employees.manage" // ลงทะเบียน/แก้ไขข้อมูลพนักงาน, ออกใบเตือน (เอกสาร SA ข้อ 3)
  | "approvals.view" // อนุมัติลา/OT
  | "payroll.view" // เงินเดือน + รายงาน
  | "admin.view"; // ตั้งค่าระบบ (แผนก/วันหยุด/อัตรา/พิกัด) — สมมติให้ HR ไปก่อน เพราะเอกสาร SA ไม่ได้ระบุ

const PERMISSION_ROLES: Record<Permission, readonly Role[]> = {
  "team.view": ["head", "executive", "finance", "hr"],
  "employees.manage": ["finance", "hr"],
  "approvals.view": ["executive", "finance", "hr"],
  "payroll.view": ["executive", "finance", "hr"],
  "admin.view": ["hr"],
};

/** role ที่ไม่รู้จัก = ไม่มีสิทธิ์ (ปฏิเสธไว้ก่อนเสมอ) */
export function can(role: string, permission: Permission): boolean {
  return (PERMISSION_ROLES[permission] as readonly string[]).includes(role);
}

export type NavItem = { href: string; label: string; permission?: Permission };

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "หน้าแรก" },
  { href: "/attendance", label: "เช็คอิน" },
  { href: "/leave", label: "ลา" },
  { href: "/team", label: "ทีมของฉัน", permission: "team.view" },
  { href: "/approvals", label: "อนุมัติ", permission: "approvals.view" },
  { href: "/employees", label: "พนักงาน", permission: "employees.manage" },
  { href: "/warnings", label: "ใบเตือน", permission: "employees.manage" },
  { href: "/payroll", label: "เงินเดือน", permission: "payroll.view" },
  { href: "/reports", label: "รายงาน", permission: "payroll.view" },
  { href: "/admin", label: "ตั้งค่า", permission: "admin.view" },
];

/** เมนูที่ role นี้เห็นได้ */
export function navForRole(role: string): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));
}

// ตามเอกสาร SA ข้อ 3: 00/01/20/21 เป็นผู้มีสิทธิ์อนุมัติ (คำขอของ 01/20/21 เองต้องให้ 00 อนุมัติ
// ซึ่งเป็นกฎเฉพาะรายคำขอ จะทำตอนสร้างหน้าอนุมัติลา/OT)
export function isApproverRole(role: string): boolean {
  return can(role, "approvals.view");
}