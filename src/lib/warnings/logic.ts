// ใบเตือนอัตโนมัติ: ตรวจจากผลคำนวณเงินเดือนของงวด (สลิป) เทียบกับเกณฑ์ใน app_settings

export type WarningKind = "late" | "absent" | "manual";

export const WARNING_KIND_LABEL_TH: Record<WarningKind, string> = {
  late: "มาสาย",
  absent: "ขาดงาน",
  manual: "ออกโดย HR",
};

export function warningKindLabel(kind: string): string {
  return WARNING_KIND_LABEL_TH[kind as WarningKind] ?? kind;
}

export type WarningThresholds = { lateCount: number; absentDays: number };

type PayslipSummary = { employee_id: string; late_days: number; late_minutes: number; absent_days: number };

export type AutoWarning = { employee_id: string; kind: "late" | "absent"; reason: string };

/** ใครควรได้ใบเตือนอัตโนมัติในงวดนี้ (ถึงเกณฑ์ = มากกว่าหรือเท่ากับ) */
export function autoWarnings(
  payslips: readonly PayslipSummary[],
  thresholds: WarningThresholds,
  periodName: string,
): AutoWarning[] {
  const result: AutoWarning[] = [];
  for (const p of payslips) {
    if (p.late_days >= thresholds.lateCount) {
      result.push({
        employee_id: p.employee_id,
        kind: "late",
        reason: `มาสาย ${p.late_days} ครั้ง รวม ${p.late_minutes} นาที ในงวด ${periodName} (เกณฑ์ ${thresholds.lateCount} ครั้ง)`,
      });
    }
    if (p.absent_days >= thresholds.absentDays) {
      result.push({
        employee_id: p.employee_id,
        kind: "absent",
        reason: `ขาดงานโดยไม่ได้ลา ${p.absent_days} วัน ในงวด ${periodName} (เกณฑ์ ${thresholds.absentDays} วัน)`,
      });
    }
  }
  return result;
}

export const MAX_WARNING_REASON_LENGTH = 500;

export function validateManualWarning(employeeId: string, reason: string): string | null {
  if (!/^[0-9a-f-]{36}$/i.test(employeeId)) return "กรุณาเลือกพนักงาน";
  const trimmed = reason.trim();
  if (trimmed.length === 0) return "กรุณาระบุเหตุผล";
  if (trimmed.length > MAX_WARNING_REASON_LENGTH) return `เหตุผลยาวเกิน ${MAX_WARNING_REASON_LENGTH} ตัวอักษร`;
  return null;
}
