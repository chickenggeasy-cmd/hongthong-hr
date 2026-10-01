import { describe, expect, it } from "vitest";
import {
  SETTING_DEFINITIONS,
  validateHoliday,
  validateSettingCombination,
  validateSettingValue,
} from "../src/lib/admin/settings";

describe("validateSettingValue", () => {
  it("รับเฉพาะ key ที่อยู่ในรายการที่อนุญาต", () => {
    expect(validateSettingValue("employee_code.reset_years", "3").ok).toBe(false);
    expect(validateSettingValue("anything", "1").ok).toBe(false);
  });

  it("ตัวเลขทศนิยม จัดรูปแบบก่อนเก็บ", () => {
    expect(validateSettingValue("wage.late_deduction_per_minute", " 2.50 ")).toEqual({ ok: true, value: "2.5" });
    expect(validateSettingValue("wage.daily_rate", "550")).toEqual({ ok: true, value: "550" });
  });

  it("ไม่ใช่ตัวเลข / ค่าว่าง / รูปแบบแปลก → ไม่ผ่าน", () => {
    for (const raw of ["", "abc", "1e3", "5,000", "0x10"]) {
      expect(validateSettingValue("wage.daily_rate", raw).ok).toBe(false);
    }
  });

  it("จำนวนเต็มเท่านั้นสำหรับค่าที่เป็นจำนวนวัน", () => {
    expect(validateSettingValue("leave.monthly_quota_days", "4.5").ok).toBe(false);
    expect(validateSettingValue("leave.monthly_quota_days", "4").ok).toBe(true);
  });

  it("อยู่ในช่วงที่กำหนด", () => {
    expect(validateSettingValue("payroll.cutoff_day", "29").ok).toBe(false);
    expect(validateSettingValue("payroll.cutoff_day", "0").ok).toBe(false);
    expect(validateSettingValue("company.latitude", "-91").ok).toBe(false);
    expect(validateSettingValue("company.latitude", "13.72322").ok).toBe(true);
  });

  it("เวลาใช้รูปแบบ HH:MM", () => {
    expect(validateSettingValue("work.start_time", "09:00")).toEqual({ ok: true, value: "09:00" });
    expect(validateSettingValue("work.start_time", "9:00").ok).toBe(false);
    expect(validateSettingValue("work.start_time", "24:00").ok).toBe(false);
  });

  it("ทุกรายการมี key ไม่ซ้ำกัน", () => {
    const keys = SETTING_DEFINITIONS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("validateSettingCombination", () => {
  it("เวลาเลิกงานต้องหลังเวลาเข้างาน", () => {
    expect(validateSettingCombination({ "work.start_time": "09:00", "work.end_time": "17:00" })).toBeNull();
    expect(validateSettingCombination({ "work.start_time": "17:00", "work.end_time": "09:00" })).not.toBeNull();
  });
});

describe("validateHoliday", () => {
  it("ต้องมีวันที่ถูกต้องและชื่อ", () => {
    expect(validateHoliday("2027-04-13", "วันสงกรานต์")).toBeNull();
    expect(validateHoliday("2027-02-30", "x")).not.toBeNull();
    expect(validateHoliday("2027-04-13", "   ")).not.toBeNull();
    expect(validateHoliday("2027-04-13", "ก".repeat(101))).not.toBeNull();
  });
});
