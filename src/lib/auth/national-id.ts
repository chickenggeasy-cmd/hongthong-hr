import { createHmac } from "node:crypto";

// อีเมลสมมติที่ใช้เป็นตัวระบุผู้ใช้ใน Supabase Auth (ไม่มีการส่งอีเมลจริง)
// ห้ามเปลี่ยนหลังสร้างผู้ใช้แล้ว เพราะทุกคนจะล็อกอินไม่ได้
export const EMPLOYEE_EMAIL_DOMAIN = "hongthong.local";

export function employeeEmail(employeeCode: string): string {
  return `${employeeCode}@${EMPLOYEE_EMAIL_DOMAIN}`;
}

/** ลบขีด/เว้นวรรค และแปลงเลขไทย (๐-๙) เป็นเลขอารบิก */
export function normalizeNationalId(input: string): string {
  return input
    .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50))
    .replace(/[\s-]/g, "");
}

/** ตรวจเลขบัตรประชาชนไทย 13 หลัก รวมหลักตรวจสอบ (checksum) ช่วยจับการพิมพ์ผิด */
export function isValidThaiNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

function getPepper(): string {
  const pepper = process.env.NATIONAL_ID_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error(
      "NATIONAL_ID_PEPPER ไม่ได้ตั้งค่าใน .env.local หรือสั้นเกินไป (ต้องยาวอย่างน้อย 32 ตัวอักษร)",
    );
  }
  return pepper;
}

// แยก "ป้าย" (label) ของแต่ละการใช้งาน เพื่อให้ค่าที่ได้จากสองงานนี้ไม่ซ้ำกันเด็ดขาด
function hmacHex(label: string, ...parts: string[]): string {
  return createHmac("sha256", getPepper())
    .update([label, ...parts].join("\u0000"))
    .digest("hex");
}

/** ค่าที่เก็บใน employee_credentials.national_id_hash (hex 64 ตัว) ใช้กันเลขบัตรซ้ำ */
export function hashNationalId(nationalId: string): string {
  return hmacHex("national-id", nationalId);
}

/**
 * รหัสผ่านที่ใช้กับ Supabase Auth ผู้ใช้ไม่เห็นและไม่ต้องจำ
 * ระบบคำนวณจาก "รหัสพนักงาน + เลขบัตร" ทุกครั้งที่ล็อกอิน
 * ต้องเรียกฝั่งเซิร์ฟเวอร์เท่านั้น (pepper ห้ามไปถึงเบราว์เซอร์)
 */
export function deriveLoginPassword(employeeCode: string, nationalId: string): string {
  return hmacHex("login-password", employeeCode, nationalId);
}