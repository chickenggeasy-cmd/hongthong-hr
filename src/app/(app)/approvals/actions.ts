"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { leaveErrorMessage, MAX_REASON_LENGTH } from "@/lib/leave/logic";

export type DecideLeaveState = {
  error: string | null;
  success: boolean;
  approved?: boolean;
};

export async function decideLeave(_prevState: DecideLeaveState, formData: FormData): Promise<DecideLeaveState> {
  // เช็กสิทธิ์ซ้ำที่นี่ แม้หน้า /approvals จะกันด้วย requirePermission() แล้ว
  // เพราะ Server Action ถูกเรียกตรงได้โดยไม่ผ่านหน้าเว็บ
  const employee = await getCurrentEmployee();
  if (!employee || !can(employee.role, "approvals.view")) {
    return { error: leaveErrorMessage("leave.forbidden"), success: false };
  }

  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "");

  if (!requestId || (decision !== "approve" && decision !== "reject")) {
    return { error: leaveErrorMessage("leave.not_found"), success: false };
  }
  if (note.trim().length > MAX_REASON_LENGTH) {
    return { error: leaveErrorMessage("leave.note_too_long"), success: false };
  }

  // requestId ใช้แค่ระบุว่า "คำขอไหน" ส่วน "ใครเป็นคนอนุมัติ" decide_leave_request() หาจาก auth.uid() เอง
  // และตรวจกติกาทั้งหมดซ้ำในฐานข้อมูล (อนุมัติตัวเองไม่ได้ / คำขอของ 00, 01, HR ต้องให้ 00 อนุมัติ)
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_leave_request", {
    p_request_id: requestId,
    p_approve: decision === "approve",
    p_note: note,
  });
  if (error) {
    return { error: leaveErrorMessage(error.message), success: false };
  }

  revalidatePath("/approvals");
  revalidatePath("/leave");
  return { error: null, success: true, approved: decision === "approve" };
}
