import { describe, expect, it } from "vitest";
import { initialMonth, isSelectable, monthGrid, monthTitle, moveFocus, shiftMonth, shortThaiDate } from "../src/lib/ui/calendar";

describe("ปฏิทินเลือกวันที่", () => {
  it("ชื่อเดือนและวันที่แบบไทย (พ.ศ.)", () => {
    expect(monthTitle("2026-10")).toBe("ตุลาคม 2569");
    expect(shortThaiDate("2026-10-05")).toBe("5 ต.ค. 2569");
    expect(shortThaiDate("2027-01-31")).toBe("31 ม.ค. 2570");
  });

  it("ตาราง 42 ช่อง เริ่มวันอาทิตย์", () => {
    const grid = monthGrid("2026-10"); // 1 ต.ค. 2569 = วันพฤหัสบดี
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ date: "2026-09-27", inMonth: false });
    expect(grid[4]).toEqual({ date: "2026-10-01", inMonth: true });
    expect(grid.filter((d) => d.inMonth)).toHaveLength(31);
    expect(new Date(`${grid[0].date}T00:00:00Z`).getUTCDay()).toBe(0);
    // เดือนที่วันที่ 1 ตรงวันอาทิตย์พอดี
    expect(monthGrid("2026-11")[0]).toEqual({ date: "2026-11-01", inMonth: true });
  });

  it("เลื่อนเดือนข้ามปี", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("ช่วงที่เลือกได้", () => {
    expect(isSelectable("2026-10-05", "2026-10-05", null)).toBe(true);
    expect(isSelectable("2026-10-04", "2026-10-05", null)).toBe(false);
    expect(isSelectable("2026-10-06", null, "2026-10-05")).toBe(false);
    expect(isSelectable("2026-10-06")).toBe(true);
  });

  it("เดือนที่เปิดครั้งแรก", () => {
    expect(initialMonth("2026-12-01", "2026-10-05")).toBe("2026-12");
    expect(initialMonth("", "2026-10-05", "2026-11-20")).toBe("2026-11");
    expect(initialMonth("", "2026-10-05", "2026-09-01")).toBe("2026-10");
    expect(initialMonth("bad", "2026-10-05")).toBe("2026-10");
  });

  it("เลื่อนโฟกัสด้วยลูกศร ไม่หลุดช่วง", () => {
    expect(moveFocus("2026-10-05", "ArrowRight")).toBe("2026-10-06");
    expect(moveFocus("2026-10-05", "ArrowUp")).toBe("2026-09-28");
    expect(moveFocus("2026-10-05", "ArrowLeft", "2026-10-05")).toBe("2026-10-05");
    expect(moveFocus("2026-10-05", "Enter")).toBe("2026-10-05");
  });
});
