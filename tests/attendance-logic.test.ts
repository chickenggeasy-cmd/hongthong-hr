import { describe, expect, it } from "vitest";
import { nextAttendanceType } from "../src/lib/attendance/logic";

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