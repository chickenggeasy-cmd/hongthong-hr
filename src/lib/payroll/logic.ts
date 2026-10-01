import { addDays, addMonths, bangkokToday, endOfMonth, isValidDateOnly, startOfMonth, type DateOnly } from "../date";
import { isWorkingDay, type HolidaySet } from "../leave/logic";
import { bangkokDateTime, paidOtHours } from "../ot/logic";
import { numberSetting, timeSetting, type SettingsRecord } from "../settings";

// สูตรเงินเดือน (เอกสาร SA + ค่าตั้งต้นที่ตัดสินใจเอง ดู README "ประเด็นที่ต้องตัดสินใจเอง")
//   ค่าจ้าง     = (วันที่มาทำงาน + วันหยุดนักขัตฤกษ์) × ค่าจ้างรายวัน   (วันอาทิตย์ไม่ได้ค่าจ้าง)
//   หักมาสาย    = นาทีที่สาย × อัตราต่อนาที (ต่อวันไม่เกินค่าจ้าง 1 วัน)
//   OT          = ชั่วโมงเต็มที่ทำจริง (ไม่เกินที่อนุมัติ) × อัตรา OT
//   หักลาเกินโควตา = จำนวนวันลาที่เกินโควตาของเดือนนั้น × อัตราหักต่อวัน
//   ประกันสังคม  = (ค่าจ้าง + OT − หักมาสาย) × อัตรา% ปัดเป็นบาท ไม่เกินเพดาน
//   สุทธิ       = ค่าจ้าง + OT − หักมาสาย − หักลาเกินโควตา − ประกันสังคม (ไม่ต่ำกว่า 0)
//   วันลา/ขาดงาน ไม่ได้ค่าจ้าง ไม่มีการหักเพิ่ม (นอกจากลาเกินโควตา) ออกก่อนเวลาไม่หัก
// คำนวณเป็นสตางค์ (จำนวนเต็ม) ทั้งหมดเพื่อกันปัญหาทศนิยมของ JavaScript แล้วค่อยแปลงเป็นบาทตอนคืนค่า

export type PayrollSettings = {
  dailyRate: number;
  lateDeductionPerMinute: number;
  otHourlyRate: number;
  workStartTime: string;
  workEndTime: string;
  monthlyQuotaDays: number;
  overQuotaDeduction: number;
  socialSecurityRatePercent: number;
  socialSecurityMaxAmount: number;
  cutoffDay: number;
};

/** อ่านค่าที่ต้องใช้คำนวณเงินเดือน คืน null ถ้าขาดค่าใดค่าหนึ่ง (ไม่คำนวณด้วยค่าที่ไม่ครบ) */
export function readPayrollSettings(settings: SettingsRecord): PayrollSettings | null {
  const values = {
    dailyRate: numberSetting(settings, "wage.daily_rate"),
    lateDeductionPerMinute: numberSetting(settings, "wage.late_deduction_per_minute"),
    otHourlyRate: numberSetting(settings, "ot.hourly_rate"),
    workStartTime: timeSetting(settings, "work.start_time"),
    workEndTime: timeSetting(settings, "work.end_time"),
    monthlyQuotaDays: numberSetting(settings, "leave.monthly_quota_days"),
    overQuotaDeduction: numberSetting(settings, "leave.over_quota_deduction"),
    socialSecurityRatePercent: numberSetting(settings, "social_security.rate_percent"),
    socialSecurityMaxAmount: numberSetting(settings, "social_security.max_amount"),
    cutoffDay: numberSetting(settings, "payroll.cutoff_day"),
  };
  if (Object.values(values).some((v) => v === null)) return null;
  return values as PayrollSettings;
}

// ---------- รอบเงินเดือน ----------

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidPeriod(period: string): boolean {
  return PERIOD_PATTERN.test(period);
}

export type PayrollCycle = { start: DateOnly; end: DateOnly };

/** งวด "2026-10" ตัดรอบวันที่ 25 → 26 ก.ย. 2026 ถึง 25 ต.ค. 2026 */
export function payrollCycle(period: string, cutoffDay: number): PayrollCycle {
  const end = `${period}-${String(cutoffDay).padStart(2, "0")}`;
  const start = addDays(addMonths(end, -1), 1);
  return { start, end };
}

/** วันที่นั้นอยู่ในงวดไหน (หลังวันตัดรอบ = งวดของเดือนถัดไป) */
export function periodForDate(date: DateOnly, cutoffDay: number): string {
  const day = Number(date.slice(8, 10));
  return (day > cutoffDay ? addMonths(startOfMonth(date), 1) : date).slice(0, 7);
}

/** ชื่องวดภาษาไทย เช่น "ตุลาคม 2569" */
export function periodLabel(period: string): string {
  return new Date(`${period}-01T00:00:00Z`).toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ---------- คำนวณสลิป ----------

export type DayStatus = "worked" | "absent" | "leave" | "holiday" | "weekly_off" | "future" | "not_employed";

export const DAY_STATUS_LABEL_TH: Record<DayStatus, string> = {
  worked: "มาทำงาน",
  absent: "ขาดงาน",
  leave: "ลา",
  holiday: "วันหยุดนักขัตฤกษ์",
  weekly_off: "วันหยุดประจำสัปดาห์",
  future: "ยังไม่ถึง",
  not_employed: "ก่อนเริ่มงาน",
};

export type PayslipDay = {
  date: DateOnly;
  status: DayStatus;
  checkIn: string | null; // HH:MM เวลาไทย
  checkOut: string | null;
  lateMinutes: number;
  otHours: number;
  overQuota: boolean;
};

export type PayslipComputation = {
  workingDays: number;
  workedDays: number;
  paidHolidayDays: number;
  leaveDays: number;
  absentDays: number;
  lateDays: number;
  lateMinutes: number;
  otHours: number;
  overQuotaDays: number;
  dailyRate: number;
  basePay: number;
  otPay: number;
  lateDeduction: number;
  leavePenalty: number;
  socialSecurity: number;
  netPay: number;
  days: PayslipDay[];
};

export type PayslipInput = {
  cycle: PayrollCycle;
  today: DateOnly; // วันหลังจากนี้ยังไม่นับ (กรณีคำนวณก่อนสิ้นงวด)
  employedFrom: DateOnly; // วันเริ่มงาน วันก่อนหน้านี้ไม่นับเป็นขาดงาน
  holidays: HolidaySet;
  attendance: readonly { type: string; recordedAt: string }[];
  approvedLeaves: readonly { startDate: DateOnly; endDate: DateOnly }[]; // ต้องครอบคลุมทั้งเดือนปฏิทินที่งวดคาบเกี่ยว
  approvedOts: readonly { workDate: DateOnly; hours: number }[];
  settings: PayrollSettings;
};

const toSatang = (baht: number) => Math.round(baht * 100);
const toBaht = (satang: number) => satang / 100;

function bangkokTimeOfDay(date: Date): string {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(11, 16);
}

/** วันลาที่เกินโควตา: ในแต่ละเดือนปฏิทิน วันลา (เฉพาะวันทำงาน) เรียงตามวันที่ วันที่ลำดับเกินโควตาคือวันที่เกิน */
export function overQuotaLeaveDates(
  leaves: readonly { startDate: DateOnly; endDate: DateOnly }[],
  months: readonly string[],
  quota: number,
  holidays: HolidaySet,
): Set<DateOnly> {
  const result = new Set<DateOnly>();
  for (const month of months) {
    const monthStart = `${month}-01`;
    const monthEnd = endOfMonth(monthStart);
    const days = new Set<DateOnly>();
    for (const leave of leaves) {
      const from = leave.startDate > monthStart ? leave.startDate : monthStart;
      const to = leave.endDate < monthEnd ? leave.endDate : monthEnd;
      for (let day = from; day <= to; day = addDays(day, 1)) {
        if (isWorkingDay(day, holidays)) days.add(day);
      }
    }
    [...days].sort().slice(quota).forEach((day) => result.add(day));
  }
  return result;
}

/** เดือนปฏิทิน (YYYY-MM) ที่ช่วงวันที่คาบเกี่ยว */
export function monthsBetween(start: DateOnly, end: DateOnly): string[] {
  const months: string[] = [];
  for (let month = startOfMonth(start); month <= end; month = addMonths(month, 1)) months.push(month.slice(0, 7));
  return months;
}

export function computePayslip(input: PayslipInput): PayslipComputation {
  const { cycle, settings, holidays } = input;

  // เช็คอินแรก / เช็คเอาท์สุดท้ายของแต่ละวัน (ตามวันที่เวลาไทย)
  const firstCheckIn = new Map<DateOnly, Date>();
  const lastCheckOut = new Map<DateOnly, Date>();
  for (const log of input.attendance) {
    const at = new Date(log.recordedAt);
    const day = bangkokToday(at);
    if (log.type === "check_in") {
      const current = firstCheckIn.get(day);
      if (!current || at < current) firstCheckIn.set(day, at);
    } else if (log.type === "check_out") {
      const current = lastCheckOut.get(day);
      if (!current || at > current) lastCheckOut.set(day, at);
    }
  }

  const leaveDates = new Set<DateOnly>();
  for (const leave of input.approvedLeaves) {
    for (let day = leave.startDate; day <= leave.endDate; day = addDays(day, 1)) leaveDates.add(day);
  }
  const overQuota = overQuotaLeaveDates(
    input.approvedLeaves,
    monthsBetween(cycle.start, cycle.end),
    settings.monthlyQuotaDays,
    holidays,
  );
  const otByDate = new Map(input.approvedOts.map((ot) => [ot.workDate, ot.hours]));

  const dailySatang = toSatang(settings.dailyRate);
  const latePerMinuteSatang = toSatang(settings.lateDeductionPerMinute);
  const totals = {
    workingDays: 0, workedDays: 0, paidHolidayDays: 0, leaveDays: 0, absentDays: 0,
    lateDays: 0, lateMinutes: 0, otHours: 0, overQuotaDays: 0, lateDeductionSatang: 0,
  };
  const days: PayslipDay[] = [];

  for (let date = cycle.start; date <= cycle.end; date = addDays(date, 1)) {
    const day: PayslipDay = { date, status: "absent", checkIn: null, checkOut: null, lateMinutes: 0, otHours: 0, overQuota: false };
    const checkIn = firstCheckIn.get(date) ?? null;
    const checkOut = lastCheckOut.get(date) ?? null;
    day.checkIn = checkIn ? bangkokTimeOfDay(checkIn) : null;
    day.checkOut = checkOut ? bangkokTimeOfDay(checkOut) : null;

    if (date > input.today) day.status = "future";
    else if (date < input.employedFrom) day.status = "not_employed";
    else if (holidays.has(date)) {
      day.status = "holiday";
      totals.paidHolidayDays++;
    } else if (!isWorkingDay(date, holidays)) day.status = "weekly_off";
    else {
      totals.workingDays++;
      if (leaveDates.has(date)) {
        day.status = "leave";
        totals.leaveDays++;
        if (overQuota.has(date)) {
          day.overQuota = true;
          totals.overQuotaDays++;
        }
      } else if (checkIn) {
        day.status = "worked";
        totals.workedDays++;
        const lateMs = checkIn.getTime() - bangkokDateTime(date, settings.workStartTime).getTime();
        day.lateMinutes = Math.max(0, Math.floor(lateMs / 60000));
        if (day.lateMinutes > 0) {
          totals.lateDays++;
          totals.lateMinutes += day.lateMinutes;
          totals.lateDeductionSatang += Math.min(day.lateMinutes * latePerMinuteSatang, dailySatang);
        }
        const approvedOt = otByDate.get(date);
        if (approvedOt) {
          day.otHours = paidOtHours({ approvedHours: approvedOt, workDate: date, workEndTime: settings.workEndTime, checkOutAt: checkOut });
          totals.otHours += day.otHours;
        }
      } else {
        day.status = "absent";
        totals.absentDays++;
      }
    }
    days.push(day);
  }

  const basePay = (totals.workedDays + totals.paidHolidayDays) * dailySatang;
  const otPay = totals.otHours * toSatang(settings.otHourlyRate);
  const leavePenalty = totals.overQuotaDays * toSatang(settings.overQuotaDeduction);
  const insurable = Math.max(0, basePay + otPay - totals.lateDeductionSatang);
  const socialSecurity = Math.min(
    Math.round((insurable * settings.socialSecurityRatePercent) / 100 / 100) * 100, // ปัดเป็นบาทเต็ม
    toSatang(settings.socialSecurityMaxAmount),
  );
  const netPay = Math.max(0, basePay + otPay - totals.lateDeductionSatang - leavePenalty - socialSecurity);

  return {
    workingDays: totals.workingDays,
    workedDays: totals.workedDays,
    paidHolidayDays: totals.paidHolidayDays,
    leaveDays: totals.leaveDays,
    absentDays: totals.absentDays,
    lateDays: totals.lateDays,
    lateMinutes: totals.lateMinutes,
    otHours: totals.otHours,
    overQuotaDays: totals.overQuotaDays,
    dailyRate: settings.dailyRate,
    basePay: toBaht(basePay),
    otPay: toBaht(otPay),
    lateDeduction: toBaht(totals.lateDeductionSatang),
    leavePenalty: toBaht(leavePenalty),
    socialSecurity: toBaht(socialSecurity),
    netPay: toBaht(netPay),
    days,
  };
}

/** ช่วงวันที่ที่ต้องดึงข้อมูลลาและวันหยุด (ทั้งเดือนปฏิทินที่งวดคาบเกี่ยว เพราะโควตานับทั้งเดือน) */
export function leaveLookupRange(cycle: PayrollCycle): { from: DateOnly; to: DateOnly } {
  return { from: startOfMonth(cycle.start), to: endOfMonth(cycle.end) };
}

/** ปิดงวดได้เมื่อพ้นวันตัดรอบแล้วเท่านั้น (ข้อมูลครบทุกวัน) */
export function canFinalize(cycle: PayrollCycle, today: DateOnly): boolean {
  return isValidDateOnly(cycle.end) && today > cycle.end;
}

export function formatBaht(value: number): string {
  return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
