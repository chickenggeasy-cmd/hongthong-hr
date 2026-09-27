export type AttendanceType = "check_in" | "check_out";

/**
 * ครั้งต่อไปควรเป็นเช็คอินหรือเช็คเอาท์ ดูจากรายการล่าสุดของพนักงานคนนั้น
 * ไม่มีประวัติมาก่อน หรือครั้งล่าสุดเป็นเช็คเอาท์แล้ว → ครั้งนี้คือเช็คอิน
 * ครั้งล่าสุดเป็นเช็คอินค้างอยู่ → ครั้งนี้คือเช็คเอาท์
 */
export function nextAttendanceType(lastType: AttendanceType | null | undefined): AttendanceType {
  return lastType === "check_in" ? "check_out" : "check_in";
}