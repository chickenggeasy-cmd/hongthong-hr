// ตัวช่วยจัดการ "วันที่ล้วน" รูปแบบ YYYY-MM-DD (แบบเดียวกับคอลัมน์ date ใน Postgres และ <input type="date">)
// คำนวณบนเวลา UTC ทั้งหมด เพื่อไม่ให้ timezone ของเครื่องที่รันมาทำให้วันเลื่อน

export type DateOnly = string; // "YYYY-MM-DD"

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // ไทยไม่มีเวลาออมแสง บวก 7 ชั่วโมงคงที่

/** ตรวจว่าเป็นวันที่ YYYY-MM-DD ที่มีอยู่จริง (เช่น 2027-02-30 = ไม่ผ่าน) */
export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toUtcDate(value: DateOnly): Date {
  return new Date(`${value}T00:00:00Z`);
}

function fromUtcDate(date: Date): DateOnly {
  return date.toISOString().slice(0, 10);
}

/** วันที่ปัจจุบันตามเวลาไทย (ส่ง now เข้ามาเพื่อให้เทสต์ได้) */
export function bangkokToday(now: Date = new Date()): DateOnly {
  return fromUtcDate(new Date(now.getTime() + BANGKOK_OFFSET_MS));
}

export function addDays(value: DateOnly, days: number): DateOnly {
  return fromUtcDate(new Date(toUtcDate(value).getTime() + days * DAY_MS));
}

/**
 * บวกเดือน ถ้าวันที่เกินสิ้นเดือนปลายทางให้ปัดเป็นวันสุดท้ายของเดือน (31 ม.ค. + 1 เดือน = 28/29 ก.พ.)
 * ตรงกับพฤติกรรม date + interval '1 month' ของ Postgres
 */
export function addMonths(value: DateOnly, months: number): DateOnly {
  const date = toUtcDate(value);
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return fromUtcDate(target);
}

export function isSunday(value: DateOnly): boolean {
  return toUtcDate(value).getUTCDay() === 0;
}

/** วันแรกของเดือน เช่น 2027-03-15 → 2027-03-01 */
export function startOfMonth(value: DateOnly): DateOnly {
  return `${value.slice(0, 7)}-01`;
}

/** วันสุดท้ายของเดือน เช่น 2027-02-10 → 2027-02-28 */
export function endOfMonth(value: DateOnly): DateOnly {
  return addDays(addMonths(startOfMonth(value), 1), -1);
}

/** แสดงวันที่แบบไทย เช่น 1 มี.ค. 2570 */
export function formatThaiDate(value: DateOnly): string {
  return toUtcDate(value).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "UTC" });
}
