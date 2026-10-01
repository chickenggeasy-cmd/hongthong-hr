"use client";

import { useActionState, useState } from "react";
import { requestOt, type OtRequestState } from "./actions";
import { MAX_OT_REASON_LENGTH } from "@/lib/ot/logic";
import type { DateOnly } from "@/lib/date";

const initialState: OtRequestState = { error: null, success: false };

const inputClass =
  "w-full rounded-lg border border-[#5B6B7B]/30 px-3 py-2 text-[#1A1A1A] outline-none focus:border-[#1E5FA8] focus:ring-2 focus:ring-[#1E5FA8]/20";

export function OtRequestForm({
  today,
  maxHoursPerDay,
  workEndTime,
  hourlyRate,
}: {
  today: DateOnly;
  maxHoursPerDay: number;
  workEndTime: string;
  hourlyRate: number | null;
}) {
  const [state, formAction, pending] = useActionState(requestOt, initialState);
  const [workDate, setWorkDate] = useState("");
  const [hours, setHours] = useState("1");
  const [reason, setReason] = useState("");

  // controlled ทุกช่อง ข้อมูลไม่หายตอนส่งไม่ผ่าน และล้างเองเมื่อส่งสำเร็จ (ปรับ state ระหว่าง render ตามที่ React แนะนำ)
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) {
      setWorkDate("");
      setHours("1");
      setReason("");
    }
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-lg font-semibold text-[#1A1A1A]">ขอทำ OT</h1>
        <p className="mt-1 text-sm text-[#5B6B7B]">
          ต้องขอล่วงหน้าก่อน {workEndTime} น. ของวันนั้น · จ่ายเฉพาะชั่วโมงเต็มที่ทำจริงหลัง {workEndTime} น.
          {hourlyRate !== null ? ` · ชั่วโมงละ ${hourlyRate.toLocaleString("th-TH")} บาท` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="workDate" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
            วันที่ทำ OT
          </label>
          <input
            id="workDate"
            name="workDate"
            type="date"
            required
            min={today}
            value={workDate}
            onChange={(event) => setWorkDate(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="hours" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
            จำนวนชั่วโมง
          </label>
          <select
            id="hours"
            name="hours"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className={inputClass}
          >
            {Array.from({ length: maxHoursPerDay }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {h} ชั่วโมง
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="otReason" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
          งานที่จะทำ (ไม่บังคับ)
        </label>
        <textarea
          id="otReason"
          name="reason"
          rows={2}
          maxLength={MAX_OT_REASON_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={inputClass}
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-[#D64545]/10 px-3 py-2 text-sm text-[#D64545]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-lg bg-[#2E9E5B]/10 px-3 py-2 text-sm text-[#2E9E5B]">
          ยื่นคำขอ OT {state.hours} ชั่วโมงแล้ว รอผู้อนุมัติพิจารณา
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#1E5FA8] py-2.5 font-medium text-white transition-colors hover:bg-[#1E5FA8]/90 disabled:opacity-50"
      >
        {pending ? "กำลังส่ง..." : "ยื่นคำขอ OT"}
      </button>
    </form>
  );
}
