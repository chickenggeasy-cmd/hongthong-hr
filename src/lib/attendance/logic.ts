export type AttendanceType = "check_in" | "check_out";

/**
 * ครั้งต่อไปควรเป็นเช็คอินหรือเช็คเอาท์ ดูจากรายการล่าสุดของพนักงานคนนั้น
 * ไม่มีประวัติมาก่อน หรือครั้งล่าสุดเป็นเช็คเอาท์แล้ว → ครั้งนี้คือเช็คอิน
 * ครั้งล่าสุดเป็นเช็คอินค้างอยู่ → ครั้งนี้คือเช็คเอาท์
 */
export function nextAttendanceType(lastType: AttendanceType | null | undefined): AttendanceType {
  return lastType === "check_in" ? "check_out" : "check_in";
}
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export type AttendanceLogEntry = { id: string; type: string; recorded_at: string; distance_meters: number; within_radius: boolean };

export type AttendanceDay = {
  date: string; // YYYY-MM-DD ตามเวลาไทย
  entries: (AttendanceLogEntry & { time: string })[]; // เรียงจากเช้าไปเย็น, time = HH:MM เวลาไทย
};

/** จัดกลุ่มประวัติเช็คอินเป็นรายวันตามเวลาไทย (วันล่าสุดก่อน) — ไม่พึ่งโซนเวลาของเครื่องเซิร์ฟเวอร์ */
export function groupLogsByDay(logs: readonly AttendanceLogEntry[]): AttendanceDay[] {
  const days = new Map<string, AttendanceDay["entries"]>();
  for (const log of logs) {
    const local = new Date(new Date(log.recorded_at).getTime() + BANGKOK_OFFSET_MS).toISOString();
    const date = local.slice(0, 10);
    days.set(date, [...(days.get(date) ?? []), { ...log, time: local.slice(11, 16) }]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({ date, entries: entries.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)) }));
}

/** ขนาดใหม่ของรูปเช็คอินก่อนอัปโหลด: ด้านยาวไม่เกิน maxSide (ไม่ขยายรูปเล็ก) คงสัดส่วนเดิม */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
