import { isValidDateOnly } from "../date";
import { isValidTime } from "../settings";

// รายการค่าใน app_settings ที่ HR แก้ได้จากหน้าตั้งค่า (เฉพาะที่อยู่ในรายการนี้เท่านั้น)
// ไม่รวม employee_code.* เพราะแก้แล้วกระทบรหัสพนักงานที่ออกไปแล้ว (แก้ผ่าน SQL Editor ถ้าจำเป็นจริง)

type SettingKind = "integer" | "decimal" | "time";

export type SettingDefinition = {
  key: string;
  label: string;
  group: string;
  kind: SettingKind;
  unit?: string;
  min?: number;
  max?: number;
  help?: string;
};

export const SETTING_GROUPS = ["เวลาทำงานและค่าจ้าง", "การลา", "เงินเดือน", "ใบเตือน", "ตำแหน่งบริษัท", "ความปลอดภัย"] as const;

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  { key: "work.start_time", label: "เวลาเข้างาน", group: "เวลาทำงานและค่าจ้าง", kind: "time", help: "หลังเวลานี้ 1 นาทีขึ้นไปนับว่ามาสาย" },
  { key: "work.end_time", label: "เวลาเลิกงาน", group: "เวลาทำงานและค่าจ้าง", kind: "time", help: "OT นับหลังเวลานี้" },
  { key: "wage.daily_rate", label: "ค่าจ้างรายวัน", group: "เวลาทำงานและค่าจ้าง", kind: "decimal", unit: "บาท", min: 0, max: 100000 },
  { key: "wage.late_deduction_per_minute", label: "หักมาสาย", group: "เวลาทำงานและค่าจ้าง", kind: "decimal", unit: "บาท/นาที", min: 0, max: 1000 },
  { key: "ot.hourly_rate", label: "ค่า OT", group: "เวลาทำงานและค่าจ้าง", kind: "decimal", unit: "บาท/ชั่วโมง", min: 0, max: 10000 },
  { key: "ot.max_hours_per_day", label: "ขอ OT ได้สูงสุด", group: "เวลาทำงานและค่าจ้าง", kind: "integer", unit: "ชั่วโมง/วัน", min: 1, max: 12 },
  { key: "leave.monthly_quota_days", label: "โควตาลารวมต่อเดือน", group: "การลา", kind: "integer", unit: "วัน", min: 0, max: 31 },
  { key: "leave.over_quota_deduction", label: "หักเงินลาเกินโควตา", group: "การลา", kind: "decimal", unit: "บาท/วันที่เกิน", min: 0, max: 100000 },
  { key: "leave.advance_notice_months", label: "ลากิจ/พักร้อนต้องขอล่วงหน้า", group: "การลา", kind: "integer", unit: "เดือน", min: 0, max: 12 },
  { key: "leave.sick_backdate_days", label: "ลาป่วยยื่นย้อนหลังได้", group: "การลา", kind: "integer", unit: "วัน", min: 0, max: 60 },
  { key: "payroll.cutoff_day", label: "วันตัดรอบเงินเดือน", group: "เงินเดือน", kind: "integer", unit: "ของเดือน", min: 1, max: 28, help: "เช่น 25 = นับวันที่ 26 เดือนก่อน ถึง 25 เดือนนี้" },
  { key: "social_security.rate_percent", label: "เงินสมทบประกันสังคม", group: "เงินเดือน", kind: "decimal", unit: "%", min: 0, max: 100 },
  { key: "social_security.max_amount", label: "ประกันสังคมสูงสุด", group: "เงินเดือน", kind: "decimal", unit: "บาท/เดือน", min: 0, max: 100000 },
  { key: "warning.late_count_threshold", label: "ออกใบเตือนเมื่อมาสาย", group: "ใบเตือน", kind: "integer", unit: "ครั้ง/รอบเงินเดือน", min: 1, max: 31 },
  { key: "warning.absent_days_threshold", label: "ออกใบเตือนเมื่อขาดงาน", group: "ใบเตือน", kind: "integer", unit: "วัน/รอบเงินเดือน", min: 1, max: 31 },
  { key: "company.latitude", label: "ละติจูดบริษัท", group: "ตำแหน่งบริษัท", kind: "decimal", min: -90, max: 90 },
  { key: "company.longitude", label: "ลองจิจูดบริษัท", group: "ตำแหน่งบริษัท", kind: "decimal", min: -180, max: 180 },
  { key: "attendance.radius_meters", label: "รัศมีเช็คอิน", group: "ตำแหน่งบริษัท", kind: "integer", unit: "เมตร", min: 10, max: 10000 },
  { key: "login.max_failures_per_code", label: "ล็อกอินผิดได้ต่อรหัสพนักงาน", group: "ความปลอดภัย", kind: "integer", unit: "ครั้ง", min: 1, max: 100, help: "ผิดครบแล้วรหัสนี้ล็อกอินไม่ได้ชั่วคราว" },
  { key: "login.max_failures_per_ip", label: "ล็อกอินผิดได้ต่อเครื่อง (IP)", group: "ความปลอดภัย", kind: "integer", unit: "ครั้ง", min: 1, max: 1000, help: "นับทุกรหัสที่ลองจากเครื่องเดียวกันรวมกัน" },
  { key: "login.lock_minutes", label: "ช่วงเวลานับและล็อก", group: "ความปลอดภัย", kind: "integer", unit: "นาที", min: 1, max: 1440, help: "นับครั้งที่ผิดย้อนหลังกี่นาที" },
];

const DEFINITIONS_BY_KEY = new Map(SETTING_DEFINITIONS.map((d) => [d.key, d]));

export function settingDefinition(key: string): SettingDefinition | undefined {
  return DEFINITIONS_BY_KEY.get(key);
}

export type SettingCheck = { ok: true; value: string } | { ok: false; error: string };

/** ตรวจค่าที่กรอก แล้วคืนค่าที่จัดรูปแบบแล้วสำหรับเก็บลงฐานข้อมูล */
export function validateSettingValue(key: string, raw: string): SettingCheck {
  const definition = DEFINITIONS_BY_KEY.get(key);
  if (!definition) return { ok: false, error: "ไม่พบรายการตั้งค่านี้" };
  const value = raw.trim();
  const label = definition.label;

  if (definition.kind === "time") {
    return isValidTime(value) ? { ok: true, value } : { ok: false, error: `${label}: ใช้รูปแบบ ชั่วโมง:นาที เช่น 09:00` };
  }

  if (value === "" || !/^-?\d+(\.\d+)?$/.test(value)) return { ok: false, error: `${label}: ต้องเป็นตัวเลข` };
  const number = Number(value);
  if (definition.kind === "integer" && !Number.isInteger(number)) return { ok: false, error: `${label}: ต้องเป็นจำนวนเต็ม` };
  if (definition.min !== undefined && number < definition.min) return { ok: false, error: `${label}: ต้องไม่น้อยกว่า ${definition.min}` };
  if (definition.max !== undefined && number > definition.max) return { ok: false, error: `${label}: ต้องไม่เกิน ${definition.max}` };
  return { ok: true, value: String(number) };
}

/** ตรวจว่าเวลาเลิกงานอยู่หลังเวลาเข้างาน (ค่าที่ต้องสัมพันธ์กัน) */
export function validateSettingCombination(values: Readonly<Record<string, string>>): string | null {
  const start = values["work.start_time"];
  const end = values["work.end_time"];
  if (start && end && end <= start) return "เวลาเลิกงานต้องอยู่หลังเวลาเข้างาน";
  return null;
}

const HOLIDAY_NAME_MAX = 100;

export function validateHoliday(date: string, name: string): string | null {
  if (!isValidDateOnly(date)) return "กรุณาระบุวันที่ให้ถูกต้อง";
  const trimmed = name.trim();
  if (trimmed.length === 0) return "กรุณาระบุชื่อวันหยุด";
  if (trimmed.length > HOLIDAY_NAME_MAX) return `ชื่อวันหยุดยาวเกิน ${HOLIDAY_NAME_MAX} ตัวอักษร`;
  return null;
}
