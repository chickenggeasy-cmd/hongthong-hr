"use client";

import { useActionState, useState } from "react";
import {
  acknowledgeWarning,
  generateWarnings,
  issueWarning,
  type WarningActionState,
} from "./actions";
import { MAX_WARNING_REASON_LENGTH } from "@/lib/warnings/logic";

const initialState: WarningActionState = { error: null, success: false };

const inputClass =
  "w-full rounded-lg border border-[#5B6B7B]/30 px-3 py-2 text-[#1A1A1A] outline-none focus:border-[#1E5FA8] focus:ring-2 focus:ring-[#1E5FA8]/20";

function Message({ state }: { state: WarningActionState }) {
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

export function GenerateWarningsForm({ periods }: { periods: { value: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(generateWarnings, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select name="period" aria-label="งวด" className={`${inputClass} w-auto`} defaultValue={periods[0]?.value}>
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              งวด {p.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || periods.length === 0}
          className="rounded-lg bg-[#1E5FA8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1E5FA8]/90 disabled:opacity-50"
        >
          {pending ? "กำลังตรวจ..." : "ตรวจและออกใบเตือนอัตโนมัติ"}
        </button>
      </div>
      <Message state={state} />
    </form>
  );
}

export function IssueWarningForm({ employees }: { employees: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(issueWarning, initialState);
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState("");

  // controlled: ข้อมูลไม่หายตอนส่งไม่ผ่าน ล้างเมื่อสำเร็จ (ปรับ state ระหว่าง render)
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) {
      setEmployeeId("");
      setReason("");
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      <select
        name="employeeId"
        aria-label="พนักงาน"
        required
        value={employeeId}
        onChange={(event) => setEmployeeId(event.target.value)}
        className={inputClass}
      >
        <option value="">— เลือกพนักงาน —</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>
      <textarea
        name="reason"
        aria-label="เหตุผล"
        required
        rows={2}
        maxLength={MAX_WARNING_REASON_LENGTH}
        placeholder="เหตุผลที่ออกใบเตือน"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className={inputClass}
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#D64545] py-2 text-sm font-medium text-white transition-colors hover:bg-[#D64545]/90 disabled:opacity-50"
      >
        {pending ? "กำลังบันทึก..." : "ออกใบเตือน"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function AcknowledgeButton({ warningId }: { warningId: string }) {
  const [state, formAction, pending] = useActionState(acknowledgeWarning, initialState);
  if (state.success) return <span className="text-sm text-[#2E9E5B]">รับทราบแล้ว</span>;
  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="warningId" value={warningId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-[#1E5FA8]/40 px-3 py-1 text-sm text-[#1E5FA8] transition-colors hover:bg-[#EAF3FC] disabled:opacity-50"
      >
        {state.error ? "ลองใหม่" : "รับทราบ"}
      </button>
    </form>
  );
}
