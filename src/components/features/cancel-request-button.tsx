"use client";

import { useActionState } from "react";
import { X } from "lucide-react";
import type { CancelRequestState } from "@/app/(app)/requests-cancel";

type CancelAction = (prev: CancelRequestState, formData: FormData) => Promise<CancelRequestState>;

/** ปุ่มยกเลิกคำขอของตัวเอง (แสดงเฉพาะคำขอที่ยังรออนุมัติ) ถามยืนยันก่อนส่ง */
export function CancelRequestButton({ requestId, action, label }: { requestId: string; action: CancelAction; label: string }) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`ยืนยันยกเลิก${label}นี้หรือไม่? ยกเลิกแล้วต้องยื่นใหม่ถ้าต้องการ`)) event.preventDefault();
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#5B6B7B] transition-colors hover:bg-[#D64545]/10 hover:text-[#D64545] disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        {pending ? "กำลังยกเลิก..." : "ยกเลิกคำขอ"}
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-[#D64545]">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
