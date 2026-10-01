import { describe, expect, it } from "vitest";
import { bangkokDateTime, otErrorMessage, paidOtHours, validateOtInput, type OtSettings } from "../src/lib/ot/logic";
import { numberSetting, timeSetting, toSettingsRecord } from "../src/lib/settings";

const settings: OtSettings = { maxHoursPerDay: 4, workEndTime: "17:00" };
const noHolidays = new Set<string>();

describe("bangkokDateTime", () => {
  it("แปลงเวลาไทยเป็นเวลาจริง (UTC-7)", () => {
    expect(bangkokDateTime("2027-03-09", "17:00").toISOString()).toBe("2027-03-09T10:00:00.000Z");
  });
});

describe("validateOtInput", () => {
  const before = new Date("2027-03-09T09:59:00Z"); // 16:59 เวลาไทย
  const valid = { workDate: "2027-03-09", hours: "2", reason: "" };

  it("ขอก่อนเวลาเลิกงานของวันนั้น → ผ่าน", () => {
    expect(validateOtInput(valid, before, settings, noHolidays)).toBeNull();
  });

  it("ขอตอน/หลังเวลาเลิกงาน → ไม่ผ่าน", () => {
    expect(validateOtInput(valid, new Date("2027-03-09T10:00:00Z"), settings, noHolidays)).toContain("ล่วงหน้า");
  });

  it("ชั่วโมงต้องเป็นจำนวนเต็ม 1 ถึงค่าสูงสุด", () => {
    for (const hours of ["0", "5", "1.5", "", "abc"]) {
      expect(validateOtInput({ ...valid, hours }, before, settings, noHolidays)).toContain("ชั่วโมง");
    }
    expect(validateOtInput({ ...valid, hours: "4" }, before, settings, noHolidays)).toBeNull();
  });

  it("วันอาทิตย์/วันหยุดนักขัตฤกษ์ → ไม่ผ่าน", () => {
    const sunday = { ...valid, workDate: "2027-03-14" };
    expect(validateOtInput(sunday, before, settings, noHolidays)).toContain("วันทำงาน");
    expect(validateOtInput(valid, before, settings, new Set(["2027-03-09"]))).toContain("วันทำงาน");
  });

  it("วันที่ผิดรูปแบบ → ไม่ผ่าน", () => {
    expect(validateOtInput({ ...valid, workDate: "2027-02-30" }, before, settings, noHolidays)).toContain("วันที่");
  });
});

describe("paidOtHours", () => {
  const base = { approvedHours: 3, workDate: "2027-03-09", workEndTime: "17:00" };
  const out = (bangkokTime: string) => bangkokDateTime("2027-03-09", bangkokTime);

  it("จ่ายเฉพาะชั่วโมงเต็ม เศษตัดทิ้ง", () => {
    expect(paidOtHours({ ...base, checkOutAt: out("19:59") })).toBe(2);
    expect(paidOtHours({ ...base, checkOutAt: out("19:00") })).toBe(2);
  });

  it("ไม่เกินชั่วโมงที่อนุมัติ", () => {
    expect(paidOtHours({ ...base, checkOutAt: out("23:00") })).toBe(3);
  });

  it("ออกก่อนครบชั่วโมงแรก หรือไม่มีเช็คเอาท์ = 0", () => {
    expect(paidOtHours({ ...base, checkOutAt: out("17:45") })).toBe(0);
    expect(paidOtHours({ ...base, checkOutAt: out("16:00") })).toBe(0);
    expect(paidOtHours({ ...base, checkOutAt: null })).toBe(0);
  });
});

describe("otErrorMessage", () => {
  it("แปลงรหัสจากฐานข้อมูลเป็นภาษาไทย", () => {
    expect(otErrorMessage("ot.on_leave")).toContain("ลา");
    expect(otErrorMessage("approval.executive_required")).toContain("ผู้บริหาร");
  });
});

describe("settings", () => {
  const s = toSettingsRecord([
    { key: "a", value: "550" },
    { key: "b", value: "x" },
    { key: "t", value: "17:00:00" },
    { key: "bad", value: "25:00" },
  ]);

  it("แปลงตัวเลข ค่าผิด/หาย = null", () => {
    expect(numberSetting(s, "a")).toBe(550);
    expect(numberSetting(s, "b")).toBeNull();
    expect(numberSetting(s, "missing")).toBeNull();
  });

  it("แปลงเวลา HH:MM", () => {
    expect(timeSetting(s, "t")).toBe("17:00");
    expect(timeSetting(s, "bad")).toBeNull();
  });
});
