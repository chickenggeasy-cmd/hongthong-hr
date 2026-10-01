import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { bangkokDateTime } from "../src/lib/ot/logic";
import { dailyAttendance, validateReportRange } from "../src/lib/reports/logic";
import { buildWorkbook, MONEY_FORMAT, sheet } from "../src/lib/export/excel";

describe("validateReportRange", () => {
  it("ช่วงวันที่ถูกต้อง", () => {
    expect(validateReportRange("2026-10-01", "2026-10-31")).toBeNull();
    expect(validateReportRange("2026-10-01", "2026-10-01")).toBeNull();
  });

  it("วันที่ผิด / กลับด้าน / ยาวเกิน", () => {
    expect(validateReportRange("", "2026-10-31")).not.toBeNull();
    expect(validateReportRange("2026-10-31", "2026-10-01")).not.toBeNull();
    expect(validateReportRange("2026-01-01", "2026-12-31")).toContain("ไม่เกิน");
  });
});

describe("dailyAttendance", () => {
  const log = (employee_id: string, type: string, day: string, time: string) => ({
    employee_id,
    type,
    recorded_at: bangkokDateTime(day, time).toISOString(),
  });

  it("รวมเป็นแถวรายวันต่อคน เข้าแรกสุด ออกล่าสุด", () => {
    const rows = dailyAttendance(
      [
        log("a", "check_in", "2026-10-01", "09:05"),
        log("a", "check_out", "2026-10-01", "12:00"),
        log("a", "check_in", "2026-10-01", "13:00"),
        log("a", "check_out", "2026-10-01", "17:30"),
        log("b", "check_in", "2026-10-01", "08:50"),
      ],
      "09:00",
    );
    expect(rows).toEqual([
      { employeeId: "a", date: "2026-10-01", checkIn: "09:05", checkOut: "17:30", lateMinutes: 5 },
      { employeeId: "b", date: "2026-10-01", checkIn: "08:50", checkOut: null, lateMinutes: 0 },
    ]);
  });

  it("เช็คอินหลังเที่ยงคืนตามเวลาไทย นับเป็นวันใหม่", () => {
    const rows = dailyAttendance([log("a", "check_in", "2026-10-02", "00:30")], "09:00");
    expect(rows[0].date).toBe("2026-10-02");
  });
});

describe("buildWorkbook", () => {
  it("สร้างไฟล์ Excel ที่มีหัวตารางและข้อมูลครบ", async () => {
    const buffer = await buildWorkbook([
      sheet<{ name: string; pay: number }>({
        name: "ทดสอบ",
        rows: [{ name: "สมชาย", pay: 1234.5 }],
        columns: [
          { header: "ชื่อ", value: (r) => r.name },
          { header: "เงิน", value: (r) => r.pay, numFmt: MONEY_FORMAT },
        ],
      }),
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = workbook.getWorksheet("ทดสอบ");
    expect(ws?.getRow(1).values).toEqual([, "ชื่อ", "เงิน"]);
    expect(ws?.getRow(2).values).toEqual([, "สมชาย", 1234.5]);
  });
});
