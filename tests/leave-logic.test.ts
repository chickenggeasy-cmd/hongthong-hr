import { describe, expect, it } from "vitest";
import { addMonths, bangkokToday, endOfMonth, isValidDateOnly } from "../src/lib/date";
import {
  countLeaveDays,
  earliestStartDate,
  leaveDaysInMonth,
  leaveErrorMessage,
  usedLeaveDaysInMonth,
  validateLeaveInput,
  LEAVE_GENERIC_ERROR,
  type LeaveSettings,
} from "../src/lib/leave/logic";

// มี.ค. 2027: วันที่ 1 เป็นวันจันทร์ วันอาทิตย์คือ 7, 14, 21, 28
const settings: LeaveSettings = { monthlyQuotaDays: 4, advanceNoticeMonths: 1, sickBackdateDays: 7 };

describe("ตัวช่วยวันที่", () => {
  it("วันที่ปัจจุบันใช้เวลาไทย (UTC+7)", () => {
    expect(bangkokToday(new Date("2026-10-01T16:59:00Z"))).toBe("2026-10-01");
    expect(bangkokToday(new Date("2026-10-01T17:00:00Z"))).toBe("2026-10-02");
  });

  it("บวกเดือนแล้วเกินสิ้นเดือน ปัดเป็นวันสุดท้ายของเดือน (เหมือน Postgres)", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("วันสิ้นเดือน", () => {
    expect(endOfMonth("2027-02-10")).toBe("2027-02-28");
    expect(endOfMonth("2027-12-01")).toBe("2027-12-31");
  });

  it("ตรวจวันที่ที่ไม่มีอยู่จริง", () => {
    expect(isValidDateOnly("2027-02-28")).toBe(true);
    expect(isValidDateOnly("2027-02-30")).toBe(false);
    expect(isValidDateOnly("27-2-1")).toBe(false);
    expect(isValidDateOnly("")).toBe(false);
  });
});

describe("countLeaveDays", () => {
  it("นับรวมวันแรกและวันสุดท้าย", () => {
    expect(countLeaveDays("2027-03-01", "2027-03-03")).toBe(3);
    expect(countLeaveDays("2027-03-01", "2027-03-01")).toBe(1);
  });

  it("ไม่นับวันอาทิตย์", () => {
    expect(countLeaveDays("2027-03-06", "2027-03-08")).toBe(2); // ส อา จ
    expect(countLeaveDays("2027-03-07", "2027-03-07")).toBe(0);
    expect(countLeaveDays("2027-03-01", "2027-03-31")).toBe(27);
  });

  it("ไม่นับวันหยุดนักขัตฤกษ์", () => {
    const holidays = new Set(["2027-03-02"]);
    expect(countLeaveDays("2027-03-01", "2027-03-03", holidays)).toBe(2);
    expect(validateLeaveInput(
      { type: "sick", startDate: "2027-03-02", endDate: "2027-03-02", reason: "" },
      "2027-03-02",
      settings,
      holidays,
    )).toContain("ไม่มีวันทำงาน");
  });
});

describe("leaveDaysInMonth", () => {
  it("คำขอคร่อมเดือน แบ่งวันตามเดือนจริง", () => {
    expect(leaveDaysInMonth("2027-03-31", "2027-04-02", "2027-03-15")).toBe(1);
    expect(leaveDaysInMonth("2027-03-31", "2027-04-02", "2027-04-01")).toBe(2);
    expect(leaveDaysInMonth("2027-03-31", "2027-04-02", "2027-05-01")).toBe(0);
  });
});

describe("usedLeaveDaysInMonth", () => {
  it("นับคำขอที่รออนุมัติและอนุมัติแล้ว ไม่นับที่ถูกปฏิเสธ", () => {
    const requests = [
      { start_date: "2027-03-01", end_date: "2027-03-02", status: "approved" },
      { start_date: "2027-03-04", end_date: "2027-03-04", status: "pending" },
      { start_date: "2027-03-05", end_date: "2027-03-06", status: "rejected" },
      { start_date: "2027-03-31", end_date: "2027-04-02", status: "pending" },
    ];
    expect(usedLeaveDaysInMonth(requests, "2027-03-01")).toBe(4);
    expect(usedLeaveDaysInMonth(requests, "2027-04-01")).toBe(2);
  });
});

describe("earliestStartDate", () => {
  it("ลากิจ/พักร้อนต้องล่วงหน้า 1 เดือน ลาป่วยย้อนหลังได้ 7 วัน", () => {
    expect(earliestStartDate("personal", "2026-10-01", settings)).toBe("2026-11-01");
    expect(earliestStartDate("vacation", "2026-10-01", settings)).toBe("2026-11-01");
    expect(earliestStartDate("sick", "2026-10-01", settings)).toBe("2026-09-24");
  });
});

describe("validateLeaveInput", () => {
  const today = "2026-10-01";
  const valid = { type: "personal", startDate: "2026-11-02", endDate: "2026-11-03", reason: "ธุระ" };

  it("ข้อมูลถูกต้อง → ผ่าน", () => {
    expect(validateLeaveInput(valid, today, settings)).toBeNull();
    expect(validateLeaveInput({ ...valid, startDate: "2026-11-01", endDate: "2026-11-02" }, today, settings)).toBeNull();
  });

  it("ประเภทไม่ถูกต้อง / วันที่ผิดรูปแบบ / วันสุดท้ายก่อนวันแรก", () => {
    expect(validateLeaveInput({ ...valid, type: "maternity" }, today, settings)).toBe("กรุณาเลือกประเภทการลา");
    expect(validateLeaveInput({ ...valid, startDate: "" }, today, settings)).toBe("กรุณาระบุวันที่ให้ถูกต้อง");
    expect(validateLeaveInput({ ...valid, endDate: "2026-11-01" }, today, settings)).toBe("วันสุดท้ายต้องไม่ก่อนวันแรก");
  });

  it("ลากิจไม่ล่วงหน้าพอ → ไม่ผ่าน แต่ลาป่วยวันนี้ได้", () => {
    expect(validateLeaveInput({ ...valid, startDate: "2026-10-31", endDate: "2026-10-31" }, today, settings)).toContain(
      "ล่วงหน้า",
    );
    expect(validateLeaveInput({ ...valid, type: "sick", startDate: today, endDate: today }, today, settings)).toBeNull();
  });

  it("ลาป่วยย้อนหลังเกิน 7 วัน → ไม่ผ่าน", () => {
    expect(
      validateLeaveInput({ ...valid, type: "sick", startDate: "2026-09-23", endDate: "2026-09-23" }, today, settings),
    ).toContain("ย้อนหลัง");
  });

  it("เลือกเฉพาะวันอาทิตย์ → ไม่ผ่าน", () => {
    expect(validateLeaveInput({ ...valid, startDate: "2026-11-08", endDate: "2026-11-08" }, today, settings)).toContain(
      "ไม่มีวันทำงาน",
    );
  });

  it("เหตุผลยาวเกิน 500 ตัวอักษร → ไม่ผ่าน", () => {
    expect(validateLeaveInput({ ...valid, reason: "ก".repeat(501) }, today, settings)).toContain("ยาวเกิน");
  });
});

describe("leaveErrorMessage", () => {
  it("แปลงรหัสจากฐานข้อมูลเป็นภาษาไทย", () => {
    expect(leaveErrorMessage("leave.overlap")).toContain("ซ้อน");
  });

  it("error ของการอนุมัติ ใช้ข้อความกลางจาก approvals", () => {
    expect(leaveErrorMessage("approval.self_approval")).toBe("อนุมัติคำขอของตัวเองไม่ได้");
  });

  it("error ที่ไม่รู้จัก ไม่โชว์รายละเอียดภายใน", () => {
    expect(leaveErrorMessage('relation "x" does not exist')).toBe(LEAVE_GENERIC_ERROR);
    expect(leaveErrorMessage(undefined)).toBe(LEAVE_GENERIC_ERROR);
  });
});
