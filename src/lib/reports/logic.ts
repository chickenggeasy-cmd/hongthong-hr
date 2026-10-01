import { addDays, isValidDateOnly, type DateOnly } from "../date";
import { bangkokClock } from "../team/logic";

// ตรวจช่วงวันที่ของรายงาน และสรุปการเข้างานรายวันจากประวัติเช็คอิน

export const MAX_REPORT_DAYS = 93; // ประมาณ 3 เดือน กันไฟล์ใหญ่เกินไป

export function validateReportRange(from: string, to: string): string | null {
  if (!isValidDateOnly(from) || !isValidDateOnly(to)) return "กรุณาระบุวันที่ให้ถูกต้อง";
  if (to < from) return "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น";
  if (to > addDays(from, MAX_REPORT_DAYS - 1)) return `เลือกช่วงได้ไม่เกิน ${MAX_REPORT_DAYS} วัน`;
  return null;
}

export type DailyAttendance = {
  employeeId: string;
  date: DateOnly;
  checkIn: string | null; // HH:MM
  checkOut: string | null;
  lateMinutes: number;
};

/** รวมประวัติเช็คอิน/เอาท์เป็นแถวรายวันต่อคน (เข้าแรกสุด ออกล่าสุด) */
export function dailyAttendance(
  logs: readonly { employee_id: string; type: string; recorded_at: string }[],
  workStartTime: string,
): DailyAttendance[] {
  const rows = new Map<string, { employeeId: string; date: DateOnly; firstIn: string | null; lastOut: string | null }>();
  for (const log of logs) {
    const date = new Date(new Date(log.recorded_at).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const key = `${log.employee_id}|${date}`;
    const row = rows.get(key) ?? { employeeId: log.employee_id, date, firstIn: null, lastOut: null };
    if (log.type === "check_in" && (!row.firstIn || log.recorded_at < row.firstIn)) row.firstIn = log.recorded_at;
    if (log.type === "check_out" && (!row.lastOut || log.recorded_at > row.lastOut)) row.lastOut = log.recorded_at;
    rows.set(key, row);
  }

  return [...rows.values()]
    .map((row) => {
      const checkIn = bangkokClock(row.firstIn);
      const lateMinutes = checkIn ? Math.max(0, minutesOf(checkIn) - minutesOf(workStartTime)) : 0;
      return { employeeId: row.employeeId, date: row.date, checkIn, checkOut: bangkokClock(row.lastOut), lateMinutes };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId));
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
