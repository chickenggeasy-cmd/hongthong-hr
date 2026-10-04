// ตัวช่วยของปฏิทินเลือกวันที่ (date-field.tsx) แยกเป็น pure function เพื่อเทสต์ได้
// ใช้วันที่แบบ YYYY-MM-DD เหมือนส่วนอื่นของระบบ (ไม่ขึ้นกับ timezone ของเครื่อง)

import { addDays, addMonths, isValidDateOnly, startOfMonth, type DateOnly } from "../date";

export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
] as const;

export const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
] as const;

/** หัวคอลัมน์ เริ่มวันอาทิตย์ (ปฏิทินไทยทั่วไป) */
export const THAI_WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;

/** "2026-10" → "ตุลาคม 2569" */
export function monthTitle(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${THAI_MONTHS[m - 1]} ${year + 543}`;
}

/** "2026-10-05" → "5 ต.ค. 2569" (สั้นพอสำหรับช่องกรอก) */
export function shortThaiDate(value: DateOnly): string {
  const [year, m, d] = value.split("-").map(Number);
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${year + 543}`;
}

/** วันในตาราง 6 แถว × 7 วัน ของเดือนนั้น (รวมวันท้าย/ต้นของเดือนข้างเคียงให้ตารางเต็ม) */
export function monthGrid(month: string): { date: DateOnly; inMonth: boolean }[] {
  const first = `${month}-01`;
  const weekday = new Date(`${first}T00:00:00Z`).getUTCDay(); // 0 = อาทิตย์
  const start = addDays(first, -weekday);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return { date, inMonth: date.startsWith(month) };
  });
}

export function shiftMonth(month: string, delta: number): string {
  return addMonths(`${month}-01`, delta).slice(0, 7);
}

/** เลือกวันนี้ได้ไหม (อยู่ในช่วง min–max ถ้ากำหนด) */
export function isSelectable(date: DateOnly, min?: DateOnly | null, max?: DateOnly | null): boolean {
  if (min && date < min) return false;
  if (max && date > max) return false;
  return true;
}

/** เดือนที่ควรเปิดเมื่อกดเปิดปฏิทิน: เดือนของค่าที่เลือก → เดือนของวันที่เริ่มเลือกได้ → เดือนของวันนี้ */
export function initialMonth(value: string, today: DateOnly, min?: DateOnly | null): string {
  if (isValidDateOnly(value)) return value.slice(0, 7);
  if (min && min > today) return startOfMonth(min).slice(0, 7);
  return today.slice(0, 7);
}

/** ย้ายโฟกัสด้วยลูกศร: ซ้าย/ขวา = วันละ 1, ขึ้น/ลง = สัปดาห์ละ 7 (ไม่หลุดช่วงที่เลือกได้) */
export function moveFocus(date: DateOnly, key: string, min?: DateOnly | null, max?: DateOnly | null): DateOnly {
  const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  const delta = step[key];
  if (delta === undefined) return date;
  const next = addDays(date, delta);
  return isSelectable(next, min, max) ? next : date;
}
