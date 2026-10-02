import { describe, expect, it } from "vitest";
import { auditActionLabel, auditDetailsText } from "../src/lib/audit/labels";

describe("audit log labels", () => {
  it("แปลชื่อรายการเป็นไทย ไม่รู้จัก = แสดงรหัสเดิม", () => {
    expect(auditActionLabel("payroll.finalize")).toBe("ปิดงวดเงินเดือน");
    expect(auditActionLabel("settings.update")).toBe("แก้การตั้งค่าระบบ");
    expect(auditActionLabel("something.new")).toBe("something.new");
  });

  it("สรุปรายละเอียดเป็นข้อความเดียว ข้ามค่าว่าง", () => {
    expect(auditDetailsText({ "wage.daily_rate": "550 → 600", note: "", x: null })).toBe("wage.daily_rate = 550 → 600");
    expect(auditDetailsText({ employees: 10 })).toBe("employees = 10");
  });

  it("รายละเอียดที่ไม่ใช่ object คืนข้อความว่าง และตัดความยาวไม่เกิน 300 ตัวอักษร", () => {
    expect(auditDetailsText(null)).toBe("");
    expect(auditDetailsText([1, 2])).toBe("");
    expect(auditDetailsText({ reason: "ก".repeat(500) }).length).toBe(300);
  });
});
