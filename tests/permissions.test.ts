import { describe, expect, it } from "vitest";
import { NAV_ITEMS, can, isApproverRole, navForRole, type Permission } from "../src/lib/permissions";

const ALL: Permission[] = ["team.view", "employees.manage", "approvals.view", "payroll.view", "admin.view"];
const allowed = (role: string) => ALL.filter((p) => can(role, p));

describe("can", () => {
  it("พนักงานทั่วไป ไม่มีสิทธิ์พิเศษเลย", () => {
    expect(allowed("employee")).toEqual([]);
  });

  it("หัวหน้าแผนก ดูลูกทีมได้อย่างเดียว", () => {
    expect(allowed("head")).toEqual(["team.view"]);
  });

  it("ผู้บริหาร ดูทีม/อนุมัติ/เงินเดือนได้ แต่ไม่ลงทะเบียนพนักงานและไม่ใช่แอดมิน", () => {
    expect(allowed("executive")).toEqual(["team.view", "approvals.view", "payroll.view"]);
  });

  it("การเงิน จัดการพนักงานได้ แต่ไม่ใช่แอดมิน", () => {
    expect(allowed("finance")).toEqual(["team.view", "employees.manage", "approvals.view", "payroll.view"]);
  });

  it("HR ทำได้ทุกอย่าง", () => {
    expect(allowed("hr")).toEqual(ALL);
  });

  it("role ที่ไม่รู้จัก หรือค่าว่าง = ไม่มีสิทธิ์ (ปฏิเสธไว้ก่อน)", () => {
    expect(allowed("intern")).toEqual([]);
    expect(allowed("")).toEqual([]);
  });
});

describe("navForRole", () => {
  const hrefs = (role: string) => navForRole(role).map((i) => i.href);

  it("พนักงานทั่วไปเห็นแค่หน้าแรกกับเช็คอิน", () => {
    expect(hrefs("employee")).toEqual(["/", "/attendance"]);
  });

  it("HR เห็นทุกเมนู", () => {
    expect(hrefs("hr")).toEqual(NAV_ITEMS.map((i) => i.href));
  });

  it("หัวหน้าเห็นเมนูทีมเพิ่ม แต่ไม่เห็นเมนูเงินเดือน", () => {
    expect(hrefs("head")).toContain("/team");
    expect(hrefs("head")).not.toContain("/payroll");
  });

  it("เมนูที่ role เห็น ต้องตรงกับสิทธิ์ที่ can() ให้เสมอ", () => {
    for (const role of ["employee", "head", "executive", "finance", "hr"]) {
      for (const item of navForRole(role)) {
        expect(!item.permission || can(role, item.permission)).toBe(true);
      }
    }
  });
});

describe("isApproverRole", () => {
  it("00/01/HR อนุมัติได้ หัวหน้ากับพนักงานอนุมัติไม่ได้", () => {
    expect(["executive", "finance", "hr"].every(isApproverRole)).toBe(true);
    expect(isApproverRole("head")).toBe(false);
    expect(isApproverRole("employee")).toBe(false);
  });
});