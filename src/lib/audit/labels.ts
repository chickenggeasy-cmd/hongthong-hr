// ชื่อภาษาไทยของแต่ละรายการใน audit log (logic ล้วน มีเทสต์)

export const AUDIT_ACTIONS = {
  "settings.update": "แก้การตั้งค่าระบบ",
  "holiday.add": "เพิ่มวันหยุด",
  "holiday.delete": "ลบวันหยุด",
  "employee.register": "ลงทะเบียนพนักงาน",
  "employee.update": "แก้ไขข้อมูลพนักงาน",
  "employee.resign": "บันทึกลาออก",
  "employee.reinstate": "กลับเข้าทำงาน",
  "payroll.compute": "คำนวณเงินเดือน",
  "payroll.finalize": "ปิดงวดเงินเดือน",
  "warning.generate": "ออกใบเตือนอัตโนมัติ",
  "warning.issue": "ออกใบเตือน",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS[action as AuditAction] ?? action;
}

/** สรุปรายละเอียดสั้นๆ เป็นข้อความเดียว เช่น "wage.daily_rate = 600, ot.hourly_rate = 160" */
export function auditDetailsText(details: unknown): string {
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  return Object.entries(details as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k} = ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ")
    .slice(0, 300);
}
