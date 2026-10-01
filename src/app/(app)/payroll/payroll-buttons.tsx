"use client";

import { useActionState } from "react";
import { computePayroll, finalizePayroll, type PayrollActionState } from "./actions";

const initialState: PayrollActionState = { error: null, success: false };

function Message({ state }: { state: PayrollActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-[#D64545]/10 px-3 py-2 text-sm text-[#D64545]">
        {state.error}
      </p>
    );
  }
  if (state.success && state.message) {
    return (
      <p role="status" className="rounded-lg bg-[#2E9E5B]/10 px-3 py-2 text-sm text-[#2E9E5B]">
        {state.message}
      </p>
    );
  }
  return null;
}

export function PayrollButtons({
  period,
  hasRun,
  canCompute,
  finalizable,
}: {
  period: string;
  hasRun: boolean;
  canCompute: boolean;
  finalizable: boolean;
}) {
  const [computeState, computeAction, computing] = useActionState(computePayroll, initialState);
  const [finalizeState, finalizeAction, finalizing] = useActionState(finalizePayroll, initialState);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <form action={computeAction}>
          <input type="hidden" name="period" value={period} />
          <button
            type="submit"
            disabled={computing || !canCompute}
            className="rounded-lg bg-[#1E5FA8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1E5FA8]/90 disabled:opacity-50"
          >
            {computing ? "กำลังคำนวณ..." : hasRun ? "คำนวณใหม่" : "คำนวณเงินเดือน"}
          </button>
        </form>
        {hasRun ? (
          <form
            action={finalizeAction}
            onSubmit={(event) => {
              if (!window.confirm("ปิดงวดแล้วจะแก้ไข/คำนวณใหม่ไม่ได้ และพนักงานจะเห็นสลิปทันที ยืนยันหรือไม่?")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="period" value={period} />
            <button
              type="submit"
              disabled={finalizing || !finalizable}
              title={finalizable ? undefined : "ปิดงวดได้หลังพ้นวันตัดรอบ"}
              className="rounded-lg border border-[#2E9E5B] px-4 py-2 text-sm font-medium text-[#2E9E5B] transition-colors hover:bg-[#2E9E5B]/10 disabled:opacity-50"
            >
              {finalizing ? "กำลังปิดงวด..." : "ปิดงวด"}
            </button>
          </form>
        ) : null}
      </div>
      <Message state={computeState} />
      <Message state={finalizeState} />
    </div>
  );
}
