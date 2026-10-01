import { describe, expect, it } from "vitest";
import { canDecideRequest, dbErrorMessage, GENERIC_ERROR } from "../src/lib/approvals/logic";

describe("canDecideRequest", () => {
  const decide = (approverRole: string, requesterRole: string, samePerson = false) =>
    canDecideRequest({ approverId: "a", approverRole, requesterId: samePerson ? "a" : "b", requesterRole }).allowed;

  it("HR/การเงิน/ผู้บริหาร อนุมัติคำขอของพนักงานและหัวหน้าได้", () => {
    for (const approver of ["hr", "finance", "executive"]) {
      expect(decide(approver, "employee")).toBe(true);
      expect(decide(approver, "head")).toBe(true);
    }
  });

  it("หัวหน้าและพนักงานอนุมัติไม่ได้", () => {
    expect(decide("head", "employee")).toBe(false);
    expect(decide("employee", "employee")).toBe(false);
  });

  it("คำขอของ HR/การเงิน/ผู้บริหาร ต้องให้ผู้บริหารอนุมัติ", () => {
    expect(decide("hr", "hr")).toBe(false);
    expect(decide("finance", "hr")).toBe(false);
    expect(decide("hr", "finance")).toBe(false);
    expect(decide("hr", "executive")).toBe(false);
    expect(decide("executive", "hr")).toBe(true);
    expect(decide("executive", "finance")).toBe(true);
    expect(decide("executive", "executive")).toBe(true);
  });

  it("อนุมัติคำขอของตัวเองไม่ได้", () => {
    expect(decide("executive", "executive", true)).toBe(false);
  });
});

describe("dbErrorMessage", () => {
  it("ไม่มีสิทธิ์ กับ ไม่พบคำขอ ใช้ข้อความเดียวกัน", () => {
    expect(dbErrorMessage("approval.forbidden", {})).toBe(dbErrorMessage("approval.not_found", {}));
  });

  it("ใช้ข้อความเฉพาะฟีเจอร์ก่อน แล้วค่อยข้อความกลาง", () => {
    expect(dbErrorMessage("x.custom", { "x.custom": "ข้อความ" })).toBe("ข้อความ");
    expect(dbErrorMessage("approval.already_decided", {})).toBe("คำขอนี้ถูกพิจารณาไปแล้ว");
  });

  it("error ที่ไม่รู้จัก ไม่โชว์รายละเอียดภายใน", () => {
    expect(dbErrorMessage('relation "x" does not exist', {})).toBe(GENERIC_ERROR);
    expect(dbErrorMessage(null, {})).toBe(GENERIC_ERROR);
  });
});
