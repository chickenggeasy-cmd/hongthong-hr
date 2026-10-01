"use client";

import { useActionState } from "react";
import { decideRequest, type DecideRequestState } from "./actions";
import { MAX_NOTE_LENGTH } from "@/lib/approvals/logic";

const initialState: DecideRequestState = { error: null, success: false };

export function DecideRequestForm({ kind, requestId }: { kind: "leave" | "ot"; requestId: string }) {
  const [state, formAction, pending] = useActionState(decideRequest, initialState);

  if (state.success) {
    return (
      <p role="status" className={`text-sm ${state.approved ? "text-[#2E9E5B]" : "text-[#D64545]"}`}>
        {state.approved ? "อนุมัติแล้ว" : "ไม่อนุมัติแล้ว"}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="requestId" value={requestId} />
      <input
        name="note"
        type="text"
        maxLength={MAX_NOTE_LENGTH}
        placeholder="หมายเหตุ (ไม่บังคับ)"
        aria-label="หมายเหตุ"
        className="w-full rounded-lg border border-[#5B6B7B]/30 px-3 py-1.5 text-sm text-[#1A1A1A] outline-none focus:border-[#1E5FA8] focus:ring-2 focus:ring-[#1E5FA8]/20"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className="flex-1 rounded-lg bg-[#2E9E5B] py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#2E9E5B]/90 disabled:opacity-50"
        >
          อนุมัติ
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="flex-1 rounded-lg border border-[#D64545]/40 py-1.5 text-sm font-medium text-[#D64545] transition-colors hover:bg-[#D64545]/10 disabled:opacity-50"
        >
          ไม่อนุมัติ
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="rounded-lg bg-[#D64545]/10 px-3 py-2 text-sm text-[#D64545]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
