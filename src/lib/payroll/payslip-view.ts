import type { DayStatus, PayslipDay } from "./logic";
import { DAY_STATUS_LABEL_TH } from "./logic";

// แปลงแถว payslips จากฐานข้อมูลเป็นรายการที่ใช้แสดงผล ใช้ร่วมกันทั้งหน้าเว็บและไฟล์ PDF

export type PayslipRecord = {
  employee_code: string;
  full_name: string;
  dept_name: string;
  working_days: number;
  worked_days: number;
  paid_holiday_days: number;
  leave_days: number;
  absent_days: number;
  late_days: number;
  late_minutes: number;
  ot_hours: number;
  over_quota_days: number;
  daily_rate: number;
  base_pay: number;
  ot_pay: number;
  late_deduction: number;
  leave_penalty: number;
  social_security: number;
  net_pay: number;
  details: unknown;
};

export type PayslipLine = { label: string; amount: number };

export function payslipLines(p: PayslipRecord): { earnings: PayslipLine[]; deductions: PayslipLine[] } {
  const paidDays = p.worked_days + p.paid_holiday_days;
  return {
    earnings: [
      { label: `ค่าจ้าง ${paidDays} วัน × ${Number(p.daily_rate).toLocaleString("th-TH")} บาท`, amount: Number(p.base_pay) },
      { label: `ค่าล่วงเวลา (OT) ${p.ot_hours} ชั่วโมง`, amount: Number(p.ot_pay) },
    ],
    deductions: [
      { label: `หักมาสาย ${p.late_minutes} นาที (${p.late_days} ครั้ง)`, amount: Number(p.late_deduction) },
      { label: `หักลาเกินโควตา ${p.over_quota_days} วัน`, amount: Number(p.leave_penalty) },
      { label: "ประกันสังคม", amount: Number(p.social_security) },
    ],
  };
}

export function payslipStats(p: PayslipRecord): { label: string; value: number }[] {
  return [
    { label: "วันทำงาน", value: p.working_days },
    { label: "มาทำงาน", value: p.worked_days },
    { label: "วันหยุดนักขัตฤกษ์", value: p.paid_holiday_days },
    { label: "ลา", value: p.leave_days },
    { label: "ขาดงาน", value: p.absent_days },
  ];
}

const DAY_STATUSES = new Set(Object.keys(DAY_STATUS_LABEL_TH));

/** อ่าน details (jsonb) อย่างระวัง ข้ามรายการที่รูปแบบไม่ถูกต้อง */
export function payslipDays(details: unknown): PayslipDay[] {
  if (!Array.isArray(details)) return [];
  return details.filter(
    (d): d is PayslipDay =>
      typeof d === "object" && d !== null && typeof d.date === "string" && DAY_STATUSES.has(d.status),
  );
}

export function dayStatusLabel(status: DayStatus): string {
  return DAY_STATUS_LABEL_TH[status];
}
