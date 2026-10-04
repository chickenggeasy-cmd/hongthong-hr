"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { APPROVAL_ERROR_MESSAGES, dbErrorMessage, MAX_NOTE_LENGTH } from "@/lib/approvals/logic";
import { schedulePushDelivery } from "@/lib/notifications/push";

export type DecideRequestState = {
  error: string | null;
  success: boolean;
  approved?: boolean;
};

const DECIDE_FUNCTIONS = {
  leave: "decide_leave_request",
  ot: "decide_ot_request",
} as const;

export async function decideRequest(_prevState: DecideRequestState, formData: FormData): Promise<DecideRequestState> {
  // เช็กสิทธิ์ซ้ำที่นี่ แม้หน้า /approvals จะกันด้วย requirePermission() แล้ว
  // เพราะ Server Action ถูกเรียกตรงได้โดยไม่ผ่านหน้าเว็บ
  const employee = await getCurrentEmployee();
  if (!employee || !can(employee.role, "approvals.view")) {
    return { error: APPROVAL_ERROR_MESSAGES["approval.forbidden"], success: false };
  }

  const kind = String(formData.get("kind") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "");

  if ((kind !== "leave" && kind !== "ot") || !requestId || (decision !== "approve" && decision !== "reject")) {
    return { error: APPROVAL_ERROR_MESSAGES["approval.not_found"], success: false };
  }
  if (note.trim().length > MAX_NOTE_LENGTH) {
    return { error: APPROVAL_ERROR_MESSAGES["approval.note_too_long"], success: false };
  }

  // requestId ใช้แค่ระบุว่า "คำขอไหน" ส่วน "ใครเป็นคนอนุมัติ" ฟังก์ชันในฐานข้อมูลหาจาก auth.uid() เอง
  // และตรวจกติกาทั้งหมดซ้ำ (อนุมัติตัวเองไม่ได้ / คำขอของ 00, 01, HR ต้องให้ 00 อนุมัติ)
  const supabase = await createClient();
  const { error } = await supabase.rpc(DECIDE_FUNCTIONS[kind], {
    p_request_id: requestId,
    p_approve: decision === "approve",
    p_note: note,
  });
  if (error) {
    return { error: dbErrorMessage(error.message, {}), success: false };
  }

  revalidatePath("/approvals");
  revalidatePath(kind === "leave" ? "/leave" : "/ot");
  revalidatePath("/");
  schedulePushDelivery();
  return { error: null, success: true, approved: decision === "approve" };
}
