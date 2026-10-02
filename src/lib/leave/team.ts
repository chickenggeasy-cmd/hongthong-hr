import { addDays, type DateOnly } from "../date";

// ส่วน "ทีมของฉัน" ในหน้าลาของหัวหน้าแผนก (อ่านอย่างเดียว ไม่มีปุ่มอนุมัติ — หัวหน้าไม่มีสิทธิ์อนุมัติ)
// แบ่งการลาของลูกทีมเป็น "ลาวันนี้" กับ "กำลังจะลา" ให้หัวหน้าวางแผนงานได้

export type TeamLeave = {
  id: string;
  employeeName: string;
  startDate: DateOnly;
  endDate: DateOnly;
  status: string; // pending | approved (คำขอที่ถูกปฏิเสธไม่แสดง)
};

export function teamLeaveSections<T extends TeamLeave>(
  leaves: readonly T[],
  today: DateOnly,
  upcomingDays = 30,
): { today: T[]; upcoming: T[] } {
  const active = leaves.filter((l) => l.status === "pending" || l.status === "approved");
  const until = addDays(today, upcomingDays);
  const byStart = (a: T, b: T) => a.startDate.localeCompare(b.startDate) || a.employeeName.localeCompare(b.employeeName, "th");
  return {
    today: active.filter((l) => l.startDate <= today && l.endDate >= today).sort(byStart),
    upcoming: active.filter((l) => l.startDate > today && l.startDate <= until).sort(byStart),
  };
}
