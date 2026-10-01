import { bangkokToday, type DateOnly } from "../date";
import { bangkokDateTime } from "../ot/logic";

// สถานะ "วันนี้" ของพนักงานแต่ละคน ใช้ในหน้าทีมของฉันและแดชบอร์ดหน้าแรก

export type TodayStatus = "checked_out" | "working" | "late" | "on_leave" | "not_yet" | "absent" | "day_off";

export const TODAY_STATUS_LABEL_TH: Record<TodayStatus, string> = {
  working: "ทำงานอยู่",
  late: "มาสาย",
  checked_out: "เลิกงานแล้ว",
  on_leave: "ลา",
  not_yet: "ยังไม่เข้างาน",
  absent: "ยังไม่มา",
  day_off: "วันหยุด",
};

export const TODAY_STATUS_CLASS: Record<TodayStatus, string> = {
  working: "bg-[#2E9E5B]/10 text-[#2E9E5B]",
  late: "bg-[#E8890C]/10 text-[#E8890C]",
  checked_out: "bg-[#1E5FA8]/10 text-[#1E5FA8]",
  on_leave: "bg-[#5BA4E6]/15 text-[#1E5FA8]",
  not_yet: "bg-[#5B6B7B]/10 text-[#5B6B7B]",
  absent: "bg-[#D64545]/10 text-[#D64545]",
  day_off: "bg-[#5B6B7B]/10 text-[#5B6B7B]",
};

export type TodayInput = {
  now: Date;
  isWorkingDay: boolean;
  onApprovedLeave: boolean;
  workStartTime: string;
  logs: readonly { type: string; recordedAt: string }[]; // เฉพาะของวันนี้
};

export type TodayResult = { status: TodayStatus; checkInAt: string | null; checkOutAt: string | null };

/**
 * สถานะวันนี้: ลา > วันหยุด > เช็คเอาท์แล้ว > ทำงานอยู่ (สาย/ไม่สาย) > ยังไม่เข้างาน (ก่อนเวลา) / ยังไม่มา (เลยเวลาแล้ว)
 * ดูจากรายการล่าสุด: ล่าสุดเป็นเช็คเอาท์ = เลิกงานแล้ว
 */
export function todayStatus(input: TodayInput): TodayResult {
  const sorted = [...input.logs].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const firstIn = sorted.find((l) => l.type === "check_in")?.recordedAt ?? null;
  const last = sorted.at(-1) ?? null;
  const lastOut = [...sorted].reverse().find((l) => l.type === "check_out")?.recordedAt ?? null;
  const result = (status: TodayStatus): TodayResult => ({ status, checkInAt: firstIn, checkOutAt: lastOut });

  if (input.onApprovedLeave) return result("on_leave");
  if (!input.isWorkingDay && !firstIn) return result("day_off");
  if (last?.type === "check_out") return result("checked_out");
  if (firstIn) {
    const start = bangkokDateTime(bangkokToday(input.now), input.workStartTime);
    // นับสายเมื่อเลยเวลาเข้างานไปอย่างน้อย 1 นาทีเต็ม (เหมือนสูตรเงินเดือน)
    return result(new Date(firstIn).getTime() - start.getTime() >= 60_000 ? "late" : "working");
  }
  const start = bangkokDateTime(bangkokToday(input.now), input.workStartTime);
  return result(input.now.getTime() >= start.getTime() + 60_000 ? "absent" : "not_yet");
}

/** เวลา HH:MM (ไทย) จาก ISO string */
export function bangkokClock(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(11, 16);
}

/** ขอบเขตเวลา (ISO) ของวันนั้นตามเวลาไทย ใช้กรอง recorded_at */
export function bangkokDayRange(day: DateOnly): { from: string; to: string } {
  const from = bangkokDateTime(day, "00:00");
  return { from: from.toISOString(), to: new Date(from.getTime() + 24 * 60 * 60 * 1000).toISOString() };
}
