import { describe, expect, it } from "vitest";
import { autoWarnings, validateManualWarning } from "../src/lib/warnings/logic";

const thresholds = { lateCount: 3, absentDays: 1 };
const slip = (late_days: number, absent_days: number, employee_id = "e1") => ({
  employee_id,
  late_days,
  late_minutes: late_days * 5,
  absent_days,
});

describe("autoWarnings", () => {
  it("ไม่ถึงเกณฑ์ → ไม่มีใบเตือน", () => {
    expect(autoWarnings([slip(2, 0)], thresholds, "ตุลาคม 2569")).toEqual([]);
  });

  it("ถึงเกณฑ์พอดี → ออกใบเตือน", () => {
    const result = autoWarnings([slip(3, 0)], thresholds, "ตุลาคม 2569");
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("late");
    expect(result[0].reason).toContain("3 ครั้ง");
  });

  it("ทั้งสายและขาด → 2 ใบ แยกประเภท", () => {
    const result = autoWarnings([slip(4, 2), slip(0, 0, "e2")], thresholds, "ตุลาคม 2569");
    expect(result.map((w) => w.kind)).toEqual(["late", "absent"]);
    expect(result.every((w) => w.employee_id === "e1")).toBe(true);
  });
});

describe("validateManualWarning", () => {
  const id = "10000000-0000-0000-0000-0000000000a1";
  it("ต้องเลือกพนักงานและมีเหตุผล", () => {
    expect(validateManualWarning(id, "ไม่แต่งเครื่องแบบ")).toBeNull();
    expect(validateManualWarning("", "x")).not.toBeNull();
    expect(validateManualWarning(id, "  ")).not.toBeNull();
    expect(validateManualWarning(id, "ก".repeat(501))).not.toBeNull();
  });
});
