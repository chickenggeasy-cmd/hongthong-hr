import { describe, expect, it } from "vitest";
import {
  employeeErrorMessage,
  filterEmployees,
  validateEmployeeEdit,
  validateResignDate,
} from "../src/lib/employees/logic";

describe("validateEmployeeEdit", () => {
  it("ชื่ออย่างน้อย 2 ตัวอักษร และต้องเลือกแผนก", () => {
    expect(validateEmployeeEdit("สมชาย ใจดี", "31")).toBeNull();
    expect(validateEmployeeEdit(" ก ", "31")).not.toBeNull();
    expect(validateEmployeeEdit("สมชาย", "")).not.toBeNull();
    expect(validateEmployeeEdit("สมชาย", "3")).not.toBeNull();
  });
});

describe("validateResignDate", () => {
  it("ต้องเป็นวันที่ที่มีอยู่จริง", () => {
    expect(validateResignDate("2026-10-15")).toBeNull();
    expect(validateResignDate("2026-02-30")).not.toBeNull();
    expect(validateResignDate("")).not.toBeNull();
  });
});

describe("employeeErrorMessage", () => {
  it("แปลงรหัสจากฐานข้อมูล และไม่โชว์ error ภายใน", () => {
    expect(employeeErrorMessage("employee.self")).toContain("ตัวเอง");
    expect(employeeErrorMessage("syntax error at or near")).toContain("ลองใหม่");
  });
});

describe("filterEmployees", () => {
  const list = [
    { employee_code: "69310001", full_name: "สมชาย ใจดี", dept_code: "31", status: "active" },
    { employee_code: "69410001", full_name: "สมหญิง รักงาน", dept_code: "41", status: "resigned" },
    { employee_code: "69200001", full_name: "Test HR", dept_code: "20", status: "active" },
  ];
  const all = { query: "", deptCode: "", status: "all" as const };

  it("ค้นหาจากชื่อหรือรหัส ไม่สนตัวพิมพ์เล็กใหญ่", () => {
    expect(filterEmployees(list, { ...all, query: "สม" })).toHaveLength(2);
    expect(filterEmployees(list, { ...all, query: "6941" })).toHaveLength(1);
    expect(filterEmployees(list, { ...all, query: "test hr" })).toHaveLength(1);
  });

  it("กรองแผนกและสถานะ", () => {
    expect(filterEmployees(list, { ...all, deptCode: "31" })).toHaveLength(1);
    expect(filterEmployees(list, { ...all, status: "active" })).toHaveLength(2);
    expect(filterEmployees(list, { ...all, status: "resigned" })[0].employee_code).toBe("69410001");
  });
});
