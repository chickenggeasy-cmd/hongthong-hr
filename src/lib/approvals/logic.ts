import { can } from "../permissions";

// กฎผู้อนุมัติที่ใช้ร่วมกันทั้งคำขอลาและคำขอ OT
// ฐานข้อมูลตัดสินจริงที่ approval_block_reason() (supabase/migrations/..._holidays_ot.sql) แก้ต้องแก้ทั้งสองฝั่ง

export type DecideCheck = { allowed: true } | { allowed: false; reason: string };

/**
 * ผู้ใช้คนนี้ตัดสินคำขอของพนักงานคนนั้นได้ไหม (ใช้ซ่อน/แสดงปุ่มในหน้าอนุมัติ)
 * ผู้อนุมัติ = ผู้มีสิทธิ์ "approvals.view" (00/01/HR), อนุมัติของตัวเองไม่ได้,
 * คำขอของ 00/01/HR ต้องให้ 00 อนุมัติ (เอกสาร SA ข้อ 3)
 */
export function canDecideRequest(params: {
  approverId: string;
  approverRole: string;
  requesterId: string;
  requesterRole: string;
}): DecideCheck {
  if (!can(params.approverRole, "approvals.view")) return { allowed: false, reason: "ไม่มีสิทธิ์อนุมัติ" };
  if (params.approverId === params.requesterId) return { allowed: false, reason: "อนุมัติคำขอของตัวเองไม่ได้" };
  if (can(params.requesterRole, "approvals.view") && params.approverRole !== "executive") {
    return { allowed: false, reason: "ต้องให้ผู้บริหารอนุมัติ" };
  }
  return { allowed: true };
}

export const MAX_NOTE_LENGTH = 500;

export const GENERIC_ERROR = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

// รหัส error จาก decide_leave_request() / decide_ot_request() → ข้อความที่ผู้ใช้เห็น
export const APPROVAL_ERROR_MESSAGES: Record<string, string> = {
  // ไม่มีสิทธิ์ กับ ไม่พบคำขอ ใช้ข้อความเดียวกัน ไม่บอกว่าคำขอนั้นมีอยู่จริงหรือไม่
  "approval.forbidden": "ไม่พบคำขอ หรือคุณไม่มีสิทธิ์อนุมัติคำขอนี้",
  "approval.not_found": "ไม่พบคำขอ หรือคุณไม่มีสิทธิ์อนุมัติคำขอนี้",
  "approval.already_decided": "คำขอนี้ถูกพิจารณาไปแล้ว",
  "approval.self_approval": "อนุมัติคำขอของตัวเองไม่ได้",
  "approval.executive_required": "คำขอนี้ต้องให้ผู้บริหารอนุมัติ",
  "approval.note_too_long": `หมายเหตุยาวเกิน ${MAX_NOTE_LENGTH} ตัวอักษร`,
};

/** แปลง error message จากฐานข้อมูลเป็นภาษาไทย error ที่ไม่รู้จักใช้ข้อความกลาง (ไม่โชว์รายละเอียดภายใน) */
export function dbErrorMessage(dbMessage: string | null | undefined, messages: Record<string, string>): string {
  if (!dbMessage) return GENERIC_ERROR;
  return messages[dbMessage] ?? APPROVAL_ERROR_MESSAGES[dbMessage] ?? GENERIC_ERROR;
}
