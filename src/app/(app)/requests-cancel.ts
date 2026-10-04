"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/approvals/logic";

// ยกเลิกคำขอลา/OT ของตัวเอง (ใช้ร่วมกันทั้งหน้าลาและหน้า OT)
// เรียก SECURITY DEFINER function ที่หาตัวผู้ใช้จาก auth.uid() เอง จึงยกเลิกของคนอื่นไม่ได้แม้ส่ง id มามั่ว

export type CancelRequestState = { error: string | null; success: boolean };

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cancel(kind: "leave" | "ot", formData: FormData): Promise<CancelRequestState> {
  const employee = await getCurrentEmployee();
  if (!employee) return { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", success: false };

  const requestId = String(formData.get("requestId") ?? "");
  if (!ID_PATTERN.test(requestId)) return { error: dbErrorMessage("request.not_cancellable", {}), success: false };

  const supabase = await createClient();
  const { error } =
    kind === "leave"
      ? await supabase.rpc("cancel_leave_request", { p_request_id: requestId })
      : await supabase.rpc("cancel_ot_request", { p_request_id: requestId });
  if (error) return { error: dbErrorMessage(error.message, {}), success: false };

  revalidatePath(kind === "leave" ? "/leave" : "/ot");
  revalidatePath("/");
  return { error: null, success: true };
}

export async function cancelLeaveRequest(_prev: CancelRequestState, formData: FormData): Promise<CancelRequestState> {
  return cancel("leave", formData);
}

export async function cancelOtRequest(_prev: CancelRequestState, formData: FormData): Promise<CancelRequestState> {
  return cancel("ot", formData);
}
