import { describe, expect, it } from "vitest";
import { fitWithin, groupLogsByDay, nextAttendanceType } from "../src/lib/attendance/logic";

describe("nextAttendanceType", () => {
  it("ไม่มีประวัติมาก่อน → เช็คอิน", () => {
    expect(nextAttendanceType(null)).toBe("check_in");
    expect(nextAttendanceType(undefined)).toBe("check_in");
  });

  it("ครั้งล่าสุดเป็นเช็คอิน → ครั้งนี้เช็คเอาท์", () => {
    expect(nextAttendanceType("check_in")).toBe("check_out");
  });

  it("ครั้งล่าสุดเป็นเช็คเอาท์ → ครั้งนี้เช็คอินใหม่", () => {
    expect(nextAttendanceType("check_out")).toBe("check_in");
  });
});
describe("groupLogsByDay", () => {
  const log = (id: string, recorded_at: string, type = "check_in") => ({ id, type, recorded_at, distance_meters: 10, within_radius: true });

  it("จัดกลุ่มตามวันที่เวลาไทย วันล่าสุดก่อน ในวันเรียงเช้าไปเย็น", () => {
    const days = groupLogsByDay([
      log("out", "2026-10-02T10:05:00Z", "check_out"), // 17:05 ไทย 2 ต.ค.
      log("in", "2026-10-02T01:50:00Z"), // 08:50 ไทย 2 ต.ค.
      log("late-night", "2026-10-01T17:30:00Z"), // 00:30 ไทย 2 ต.ค.
      log("prev", "2026-10-01T02:00:00Z"), // 09:00 ไทย 1 ต.ค.
    ]);
    expect(days.map((d) => d.date)).toEqual(["2026-10-02", "2026-10-01"]);
    expect(days[0].entries.map((e) => `${e.id}@${e.time}`)).toEqual(["late-night@00:30", "in@08:50", "out@17:05"]);
  });
});

describe("fitWithin (ย่อรูปเช็คอินก่อนอัปโหลด)", () => {
  it("ย่อด้านยาวให้ไม่เกินที่กำหนด คงสัดส่วน", () => {
    expect(fitWithin(4032, 3024, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3024, 4032, 1280)).toEqual({ width: 960, height: 1280 });
  });

  it("รูปเล็กกว่าเดิมไม่ขยาย และขนาดผิดปกติได้ 0", () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(0, 600, 1280)).toEqual({ width: 0, height: 0 });
  });
});
