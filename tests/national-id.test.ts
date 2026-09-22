import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveLoginPassword,
  employeeEmail,
  hashNationalId,
  isValidEmployeeCode,
  isValidThaiNationalId,
  normalizeNationalId,
} from "../src/lib/auth/national-id";

const PEPPER = "a".repeat(64);
const VALID_ID = "1234567890121"; // เลขทดสอบที่ผ่าน checksum (ไม่ใช่ของจริง)

beforeEach(() => {
  vi.stubEnv("NATIONAL_ID_PEPPER", PEPPER);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isValidThaiNationalId", () => {
  it("รับเลขที่หลักตรวจสอบถูกต้อง", () => {
    expect(isValidThaiNationalId(VALID_ID)).toBe(true);
  });

  it("ปฏิเสธเลขที่หลักตรวจสอบผิด (พิมพ์ผิด 1 หลัก)", () => {
    expect(isValidThaiNationalId("1234567890123")).toBe(false);
    expect(isValidThaiNationalId("1234567890221")).toBe(false);
  });

  it("ปฏิเสธเลขที่ไม่ครบ 13 หลัก หรือมีตัวอักษร", () => {
    expect(isValidThaiNationalId("123456789012")).toBe(false);
    expect(isValidThaiNationalId("12345678901211")).toBe(false);
    expect(isValidThaiNationalId("12345678901ab")).toBe(false);
    expect(isValidThaiNationalId("")).toBe(false);
  });
});

describe("normalizeNationalId", () => {
  it("ลบขีดและเว้นวรรค", () => {
    expect(normalizeNationalId("1-2345-67890-12-1")).toBe(VALID_ID);
    expect(normalizeNationalId(" 1234567890121 ")).toBe(VALID_ID);
  });

  it("แปลงเลขไทยเป็นเลขอารบิก", () => {
    expect(normalizeNationalId("๑๒๓๔๕๖๗๘๙๐๑๒๑")).toBe(VALID_ID);
  });
});

describe("hashNationalId / deriveLoginPassword", () => {
  it("ได้ hex 64 ตัว และคำนวณซ้ำแล้วได้ค่าเดิม", () => {
    const h = hashNationalId(VALID_ID);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashNationalId(VALID_ID)).toBe(h);
  });

  it("เลขบัตรต่างกัน ได้ค่าต่างกัน", () => {
    expect(hashNationalId(VALID_ID)).not.toBe(hashNationalId("1234567890130"));
  });

  it("pepper ต่างกัน ได้ค่าต่างกัน", () => {
    const before = hashNationalId(VALID_ID);
    vi.stubEnv("NATIONAL_ID_PEPPER", "b".repeat(64));
    expect(hashNationalId(VALID_ID)).not.toBe(before);
  });

  it("ค่า hash กับรหัสผ่านล็อกอินไม่ซ้ำกัน (แยกป้าย)", () => {
    expect(deriveLoginPassword("69200001", VALID_ID)).not.toBe(hashNationalId(VALID_ID));
  });

  it("รหัสผ่านล็อกอินขึ้นกับทั้งรหัสพนักงานและเลขบัตร", () => {
    const base = deriveLoginPassword("69200001", VALID_ID);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(deriveLoginPassword("69200001", VALID_ID)).toBe(base);
    expect(deriveLoginPassword("69200002", VALID_ID)).not.toBe(base);
    expect(deriveLoginPassword("69200001", "1234567890130")).not.toBe(base);
  });

  it("ไม่มี pepper หรือสั้นเกินไป ต้อง error", () => {
    vi.stubEnv("NATIONAL_ID_PEPPER", "");
    expect(() => hashNationalId(VALID_ID)).toThrow(/NATIONAL_ID_PEPPER/);
    vi.stubEnv("NATIONAL_ID_PEPPER", "short");
    expect(() => deriveLoginPassword("69200001", VALID_ID)).toThrow(/NATIONAL_ID_PEPPER/);
  });
});

describe("isValidEmployeeCode", () => {
  it("รับรหัส 8 หลัก", () => {
    expect(isValidEmployeeCode("69200001")).toBe(true);
  });

  it("ปฏิเสธรหัสที่จำนวนหลักไม่ครบ หรือมีตัวอักษร", () => {
    expect(isValidEmployeeCode("6920001")).toBe(false);
    expect(isValidEmployeeCode("692000011")).toBe(false);
    expect(isValidEmployeeCode("6920000a")).toBe(false);
    expect(isValidEmployeeCode("")).toBe(false);
  });
});

describe("employeeEmail", () => {
  it("สร้างอีเมลสมมติจากรหัสพนักงาน", () => {
    expect(employeeEmail("69200001")).toBe("69200001@hongthong.local");
  });
});