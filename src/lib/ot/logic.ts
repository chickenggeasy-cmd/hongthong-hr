import { isValidDateOnly, type DateOnly } from "../date";
import { dbErrorMessage } from "../approvals/logic";
import { isWorkingDay, type HolidaySet } from "../leave/logic";

// กติกาฝั่งฐานข้อมูลอยู่ที่ request_ot() ใน supabase/migrations/..._holidays_ot.sql
// ฐานข้อมูลเป็นตัวตัดสินจริงเสมอ ไฟล์นี้มีไว้ตรวจล่วงหน้า/แสดงผล และคำนวณชั่วโมง OT ที่จ่ายจริงตอนทำเงินเดือน

export type OtSettings = {
  maxHoursPerDay: number;
  workEndTime: string; // HH:MM เวลาเลิกงาน OT เริ่มนับหลังเวลานี้
};

export const MAX_OT_REASON_LENGTH = 500;
const HOUR_MS = 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * HOUR_MS;

/** เวลา (ไทย) ของวันนั้น เป็น Date จริง เช่น ("2027-03-09", "17:00") → 2027-03-09T10:00:00Z */
export function bangkokDateTime(day: DateOnly, time: string): Date {
  return new Date(new Date(`${day}T${time}:00Z`).getTime() - BANGKOK_OFFSET_MS);
}

export type OtInput = { workDate: string; hours: string; reason: string };

/** ตรวจคำขอ OT ก่อนส่งเข้าฐานข้อมูล คืนข้อความ error ภาษาไทย หรือ null ถ้าผ่าน */
export function validateOtInput(input: OtInput, now: Date, settings: OtSettings, holidays: HolidaySet): string | null {
  if (!isValidDateOnly(input.workDate)) return "กรุณาระบุวันที่ให้ถูกต้อง";
  const hours = Number(input.hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > settings.maxHoursPerDay) {
    return `จำนวนชั่วโมงต้องเป็นจำนวนเต็ม 1–${settings.maxHoursPerDay} ชั่วโมง`;
  }
  if (input.reason.trim().length > MAX_OT_REASON_LENGTH) return `เหตุผลยาวเกิน ${MAX_OT_REASON_LENGTH} ตัวอักษร`;
  if (now.getTime() >= bangkokDateTime(input.workDate, settings.workEndTime).getTime()) {
    return `ต้องขอ OT ล่วงหน้าก่อนเวลาเลิกงาน (${settings.workEndTime} น.) ของวันนั้น`;
  }
  if (!isWorkingDay(input.workDate, holidays)) return "ขอ OT ได้เฉพาะวันทำงาน (ไม่ใช่วันอาทิตย์หรือวันหยุดนักขัตฤกษ์)";
  return null;
}

/**
 * ชั่วโมง OT ที่จ่ายจริง = ชั่วโมงเต็มที่ทำจริงหลังเวลาเลิกงาน แต่ไม่เกินชั่วโมงที่ได้รับอนุมัติ
 * เศษชั่วโมงตัดทิ้ง ออกก่อนครบชั่วโมงแรก = 0 (README ประเด็นข้อ 2) ไม่มีเวลาเช็คเอาท์ = 0
 */
export function paidOtHours(params: {
  approvedHours: number;
  workDate: DateOnly;
  workEndTime: string;
  checkOutAt: Date | null;
}): number {
  if (!params.checkOutAt) return 0;
  const workedMs = params.checkOutAt.getTime() - bangkokDateTime(params.workDate, params.workEndTime).getTime();
  const fullHours = Math.floor(workedMs / HOUR_MS);
  return Math.max(0, Math.min(params.approvedHours, fullHours));
}

const OT_ERROR_MESSAGES: Record<string, string> = {
  "ot.not_authenticated": "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  "ot.settings_missing": "ระบบยังไม่ได้ตั้งค่ากติกา OT กรุณาติดต่อ HR",
  "ot.invalid_date": "กรุณาระบุวันที่ให้ถูกต้อง",
  "ot.invalid_hours": "จำนวนชั่วโมงไม่ถูกต้อง",
  "ot.reason_too_long": `เหตุผลยาวเกิน ${MAX_OT_REASON_LENGTH} ตัวอักษร`,
  "ot.too_late": "ต้องขอ OT ล่วงหน้าก่อนเวลาเลิกงานของวันนั้น",
  "ot.not_working_day": "ขอ OT ได้เฉพาะวันทำงาน (ไม่ใช่วันอาทิตย์หรือวันหยุดนักขัตฤกษ์)",
  "ot.on_leave": "วันนั้นคุณมีคำขอลาอยู่ ขอ OT ไม่ได้",
  "ot.duplicate": "วันนั้นคุณมีคำขอ OT ที่รออนุมัติหรืออนุมัติแล้วอยู่",
};

export function otErrorMessage(dbMessage: string | null | undefined): string {
  return dbErrorMessage(dbMessage, OT_ERROR_MESSAGES);
}
