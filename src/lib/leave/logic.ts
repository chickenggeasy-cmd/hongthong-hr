import {
  addDays,
  addMonths,
  endOfMonth,
  isSunday,
  isValidDateOnly,
  startOfMonth,
  type DateOnly,
} from "../date";
import { dbErrorMessage, GENERIC_ERROR } from "../approvals/logic";

// กติกาฝั่งฐานข้อมูลอยู่ใน supabase/migrations/..._leave_requests.sql (request_leave / decide_leave_request)
// ฐานข้อมูลเป็นตัวตัดสินจริงเสมอ ไฟล์นี้มีไว้ตรวจล่วงหน้าเพื่อแสดงข้อความที่เข้าใจง่าย + แสดงผลในหน้าเว็บ
// แก้กติกาที่ไหน ต้องแก้อีกฝั่งให้ตรงกันด้วย

export type LeaveType = "sick" | "personal" | "vacation";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export const LEAVE_TYPES: readonly LeaveType[] = ["sick", "personal", "vacation"];

export const LEAVE_TYPE_LABEL_TH: Record<LeaveType, string> = {
  sick: "ลาป่วย",
  personal: "ลากิจ",
  vacation: "ลาพักร้อน",
};

export const LEAVE_STATUS_LABEL_TH: Record<LeaveStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิกแล้ว",
};

/** ผู้ยื่นยกเลิกคำขอ (ลา/OT) ของตัวเองได้เฉพาะตอนที่ยังรออนุมัติ — ฐานข้อมูลตรวจซ้ำใน cancel_*_request() */
export function canCancelRequest(status: string): boolean {
  return status === "pending";
}

export const MAX_REASON_LENGTH = 500;
// กันช่วงวันที่ยาวผิดปกติ (ไม่ใช่กติกาธุรกิจ) ต้องตรงกับ request_leave()
const MAX_RANGE_DAYS = 366;

/** ค่าจาก app_settings ผ่านฟังก์ชัน leave_settings() */
export type LeaveSettings = {
  monthlyQuotaDays: number;
  advanceNoticeMonths: number;
  sickBackdateDays: number;
};

export function isLeaveType(value: string): value is LeaveType {
  return (LEAVE_TYPES as readonly string[]).includes(value);
}

export function leaveTypeLabel(value: string): string {
  return isLeaveType(value) ? LEAVE_TYPE_LABEL_TH[value] : value;
}

export function leaveStatusLabel(value: string): string {
  return LEAVE_STATUS_LABEL_TH[value as LeaveStatus] ?? value;
}

/** ชุดวันหยุดนักขัตฤกษ์ (YYYY-MM-DD) จากตาราง holidays */
export type HolidaySet = ReadonlySet<string>;
const NO_HOLIDAYS: HolidaySet = new Set();

/** วันทำงาน = ไม่ใช่วันอาทิตย์ และไม่ใช่วันหยุดนักขัตฤกษ์ */
export function isWorkingDay(day: DateOnly, holidays: HolidaySet = NO_HOLIDAYS): boolean {
  return !isSunday(day) && !holidays.has(day);
}

/** จำนวนวันลา นับเฉพาะวันทำงาน รวมวันแรกและวันสุดท้าย — ตรงกับ leave_working_days() */
export function countLeaveDays(start: DateOnly, end: DateOnly, holidays: HolidaySet = NO_HOLIDAYS): number {
  let count = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (isWorkingDay(day, holidays)) count++;
  }
  return count;
}

/** วันลาของช่วง [start, end] ที่ตกอยู่ในเดือนเดียวกับ month (ส่งวันไหนของเดือนนั้นมาก็ได้) */
export function leaveDaysInMonth(
  start: DateOnly,
  end: DateOnly,
  month: DateOnly,
  holidays: HolidaySet = NO_HOLIDAYS,
): number {
  const from = start > startOfMonth(month) ? start : startOfMonth(month);
  const to = end < endOfMonth(month) ? end : endOfMonth(month);
  return from > to ? 0 : countLeaveDays(from, to, holidays);
}

/** วันแรกสุดที่เริ่มลาประเภทนี้ได้ ถ้ายื่นวันนี้ */
export function earliestStartDate(type: LeaveType, today: DateOnly, settings: LeaveSettings): DateOnly {
  return type === "sick" ? addDays(today, -settings.sickBackdateDays) : addMonths(today, settings.advanceNoticeMonths);
}

export type LeaveInput = { type: string; startDate: string; endDate: string; reason: string };

/** ตรวจข้อมูลคำขอลาก่อนส่งเข้าฐานข้อมูล คืนข้อความ error ภาษาไทย หรือ null ถ้าผ่าน */
export function validateLeaveInput(
  input: LeaveInput,
  today: DateOnly,
  settings: LeaveSettings,
  holidays: HolidaySet = NO_HOLIDAYS,
): string | null {
  if (!isLeaveType(input.type)) return "กรุณาเลือกประเภทการลา";
  if (!isValidDateOnly(input.startDate) || !isValidDateOnly(input.endDate)) return "กรุณาระบุวันที่ให้ถูกต้อง";
  if (input.endDate < input.startDate) return "วันสุดท้ายต้องไม่ก่อนวันแรก";
  if (input.endDate > addDays(input.startDate, MAX_RANGE_DAYS)) return "ช่วงวันลายาวเกินไป";
  if (input.reason.trim().length > MAX_REASON_LENGTH) return `เหตุผลยาวเกิน ${MAX_REASON_LENGTH} ตัวอักษร`;

  if (input.startDate < earliestStartDate(input.type, today, settings)) {
    return input.type === "sick"
      ? `ลาป่วยยื่นย้อนหลังได้ไม่เกิน ${settings.sickBackdateDays} วัน`
      : `${LEAVE_TYPE_LABEL_TH[input.type]}ต้องยื่นล่วงหน้าอย่างน้อย ${settings.advanceNoticeMonths} เดือน`;
  }
  if (countLeaveDays(input.startDate, input.endDate, holidays) === 0) {
    return "ช่วงที่เลือกไม่มีวันทำงาน (ตรงกับวันอาทิตย์หรือวันหยุดนักขัตฤกษ์)";
  }
  return null;
}

type CountedRequest = { start_date: string; end_date: string; status: string };

/** วันลาที่ใช้ไปแล้วในเดือนนั้น นับคำขอที่รออนุมัติ + อนุมัติแล้ว (ไม่นับที่ถูกปฏิเสธ) — ตรงกับ request_leave() */
export function usedLeaveDaysInMonth(
  requests: readonly CountedRequest[],
  month: DateOnly,
  holidays: HolidaySet = NO_HOLIDAYS,
): number {
  return requests
    .filter((r) => r.status === "pending" || r.status === "approved")
    .reduce((sum, r) => sum + leaveDaysInMonth(r.start_date, r.end_date, month, holidays), 0);
}

// รหัส error ที่ request_leave() โยนออกมา → ข้อความที่ผู้ใช้เห็น (error ของการอนุมัติอยู่ใน approvals/logic.ts)
const LEAVE_ERROR_MESSAGES: Record<string, string> = {
  "leave.not_authenticated": "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  "leave.invalid_type": "กรุณาเลือกประเภทการลา",
  "leave.invalid_range": "กรุณาระบุวันที่ให้ถูกต้อง",
  "leave.range_too_long": "ช่วงวันลายาวเกินไป",
  "leave.reason_too_long": `เหตุผลยาวเกิน ${MAX_REASON_LENGTH} ตัวอักษร`,
  "leave.settings_missing": "ระบบยังไม่ได้ตั้งค่ากติกาการลา กรุณาติดต่อ HR",
  "leave.sick_too_late": "ลาป่วยยื่นย้อนหลังเกินกำหนด",
  "leave.notice_too_short": "ลากิจ/ลาพักร้อนต้องยื่นล่วงหน้าตามกำหนด",
  "leave.no_working_days": "ช่วงที่เลือกไม่มีวันทำงาน (ตรงกับวันอาทิตย์หรือวันหยุดนักขัตฤกษ์)",
  "leave.overlap": "มีคำขอลาที่รออนุมัติหรืออนุมัติแล้วซ้อนกับช่วงวันนี้อยู่",
};

export const LEAVE_GENERIC_ERROR = GENERIC_ERROR;

/** แปลง error message จากฐานข้อมูลเป็นภาษาไทย error ที่ไม่รู้จักใช้ข้อความกลาง (ไม่โชว์รายละเอียดภายใน) */
export function leaveErrorMessage(dbMessage: string | null | undefined): string {
  return dbErrorMessage(dbMessage, LEAVE_ERROR_MESSAGES);
}
