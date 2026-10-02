import { can } from "../permissions";
import { canDecideRequest, type DecideCheck } from "./logic";

// จัดหน้าอนุมัติให้ต่างกันตามบทบาท (สเปกเจ้าของโปรเจกต์ 1 ต.ค. 2569 ดู CLAUDE.md "งานที่วางแผนไว้")
//   การเงิน: เน้นผลกระทบเงิน — คำขอเกินโควตาขึ้นก่อน
//   HR: เน้นคน — กรองตามแผนก เรียงตามแผนก/ชื่อ
//   ผู้บริหาร: แบ่ง "คำขอทั่วไป" กับ "คำขอจาก HR/การเงิน ที่ต้องให้คุณอนุมัติเท่านั้น"

export type ApprovalView = "finance" | "hr" | "executive";

export function approvalView(role: string): ApprovalView | null {
  if (role === "finance" || role === "hr" || role === "executive") return role;
  return null;
}

export type PendingRequest = {
  kind: "leave" | "ot";
  id: string;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  deptCode: string;
  exceedsQuota: boolean;
  sortDate: string; // วันที่ลาวันแรก / วันที่ทำ OT
};

/** ผลการตรวจว่าผู้ใช้กดอนุมัติคำขอนี้ได้ไหม (ข้อความตามสเปก: "ต้องรอผู้บริหารอนุมัติ") */
export function decisionFor(viewer: { id: string; role: string }, item: PendingRequest): DecideCheck {
  return canDecideRequest({
    approverId: viewer.id,
    approverRole: viewer.role,
    requesterId: item.requesterId,
    requesterRole: item.requesterRole,
  });
}

/** คำขอที่ "ต้องให้ผู้บริหารอนุมัติเท่านั้น" = คำขอของ 00/01/HR ที่ไม่ใช่ของผู้ดูเอง */
export function isExecutiveOnly(item: PendingRequest, viewerId: string): boolean {
  return can(item.requesterRole, "approvals.view") && item.requesterId !== viewerId;
}

const byDate = (a: PendingRequest, b: PendingRequest) => a.sortDate.localeCompare(b.sortDate);

export function arrangeForFinance<T extends PendingRequest>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Number(b.exceedsQuota) - Number(a.exceedsQuota) || byDate(a, b));
}

export function arrangeForHr<T extends PendingRequest>(items: readonly T[], deptCode: string | null): T[] {
  return items
    .filter((i) => !deptCode || i.deptCode === deptCode)
    .sort((a, b) => a.deptCode.localeCompare(b.deptCode) || a.requesterName.localeCompare(b.requesterName, "th") || byDate(a, b));
}

export function arrangeForExecutive<T extends PendingRequest>(
  items: readonly T[],
  viewerId: string,
): { general: T[]; executiveOnly: T[] } {
  const sorted = [...items].sort(byDate);
  return {
    general: sorted.filter((i) => !isExecutiveOnly(i, viewerId)),
    executiveOnly: sorted.filter((i) => isExecutiveOnly(i, viewerId)),
  };
}
