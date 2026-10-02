import { describe, expect, it } from "vitest";
import {
  approvalView,
  arrangeForExecutive,
  arrangeForFinance,
  arrangeForHr,
  decisionFor,
  type PendingRequest,
} from "../src/lib/approvals/view";

const req = (p: Partial<PendingRequest>): PendingRequest => ({
  kind: "leave",
  id: p.id ?? "r",
  requesterId: "u",
  requesterName: "ก",
  requesterRole: "employee",
  deptCode: "31",
  exceedsQuota: false,
  sortDate: "2026-11-01",
  ...p,
});

describe("approvalView", () => {
  it("เฉพาะ 00/01/HR มีหน้าอนุมัติ", () => {
    expect(approvalView("finance")).toBe("finance");
    expect(approvalView("hr")).toBe("hr");
    expect(approvalView("executive")).toBe("executive");
    expect(approvalView("head")).toBeNull();
    expect(approvalView("employee")).toBeNull();
  });
});

describe("decisionFor", () => {
  it("คำขอของ 01/20/21 → การเงิน/HR กดไม่ได้ ต้องรอผู้บริหาร", () => {
    const fromHr = req({ requesterRole: "hr", requesterId: "h2" });
    expect(decisionFor({ id: "f1", role: "finance" }, fromHr)).toEqual({ allowed: false, reason: "ต้องรอผู้บริหารอนุมัติ" });
    expect(decisionFor({ id: "e1", role: "executive" }, fromHr).allowed).toBe(true);
  });

  it("คำขอของตัวเอง กดไม่ได้", () => {
    expect(decisionFor({ id: "e1", role: "executive" }, req({ requesterRole: "executive", requesterId: "e1" })).allowed).toBe(false);
  });
});

describe("arrangeForFinance", () => {
  it("คำขอเกินโควตาขึ้นก่อน แล้วเรียงตามวันที่", () => {
    const result = arrangeForFinance([
      req({ id: "a", sortDate: "2026-11-01" }),
      req({ id: "b", sortDate: "2026-11-05", exceedsQuota: true }),
      req({ id: "c", sortDate: "2026-10-20" }),
    ]);
    expect(result.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});

describe("arrangeForHr", () => {
  const items = [
    req({ id: "a", deptCode: "41", requesterName: "สมชาย" }),
    req({ id: "b", deptCode: "31", requesterName: "วิชัย" }),
    req({ id: "c", deptCode: "31", requesterName: "กมล" }),
  ];

  it("เรียงตามแผนก แล้วตามชื่อ", () => {
    expect(arrangeForHr(items, null).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("กรองตามแผนก", () => {
    expect(arrangeForHr(items, "41").map((r) => r.id)).toEqual(["a"]);
  });
});

describe("arrangeForExecutive", () => {
  it("แยกคำขอทั่วไป กับคำขอจาก HR/การเงินที่ต้องให้ผู้บริหารอนุมัติ (คำขอตัวเองอยู่กลุ่มทั่วไป)", () => {
    const { general, executiveOnly } = arrangeForExecutive(
      [
        req({ id: "emp" }),
        req({ id: "hr", requesterRole: "hr", requesterId: "h1" }),
        req({ id: "fin", requesterRole: "finance", requesterId: "f1" }),
        req({ id: "exec2", requesterRole: "executive", requesterId: "e2" }),
        req({ id: "mine", requesterRole: "executive", requesterId: "e1" }),
      ],
      "e1",
    );
    expect(general.map((r) => r.id).sort()).toEqual(["emp", "mine"]);
    expect(executiveOnly.map((r) => r.id).sort()).toEqual(["exec2", "fin", "hr"]);
  });
});
