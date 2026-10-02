"use client";

import { useActionState, useMemo, useState } from "react";
import { requestLeave, type LeaveRequestState } from "./actions";
import {
  countLeaveDays,
  earliestStartDate,
  LEAVE_TYPE_LABEL_TH,
  LEAVE_TYPES,
  MAX_REASON_LENGTH,
  type LeaveSettings,
  type LeaveType,
} from "@/lib/leave/logic";
import { formatThaiDate, isValidDateOnly, type DateOnly } from "@/lib/date";

const initialState: LeaveRequestState = { error: null, success: false };

const inputClass =
  "w-full ht-input";

export function LeaveRequestForm({
  today,
  holidays,
  settings,
}: {
  today: DateOnly;
  holidays: readonly DateOnly[];
  settings: LeaveSettings;
}) {
  const [state, formAction, pending] = useActionState(requestLeave, initialState);
  const [leaveType, setLeaveType] = useState<LeaveType>("personal");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  // ทุกช่องเป็น controlled เพื่อไม่ให้ข้อมูลที่กรอกหายตอนส่งไม่ผ่าน แล้วล้างเองเมื่อส่งสำเร็จ
  // (ปรับ state ระหว่าง render ตามที่ React แนะนำ แทนการเรียก setState ใน useEffect)
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) {
      setStartDate("");
      setEndDate("");
      setReason("");
    }
  }

  const holidaySet = useMemo(() => new Set(holidays), [holidays]);
  const minStart = earliestStartDate(leaveType, today, settings);
  const daysPreview =
    isValidDateOnly(startDate) && isValidDateOnly(endDate) && endDate >= startDate
      ? countLeaveDays(startDate, endDate, holidaySet)
      : null;

  return (
    <form action={formAction} className="space-y-4 ht-card p-6">
      <h2 className="text-lg font-semibold text-[#1A1A1A]">ยื่นคำขอลา</h2>

      <div>
        <label htmlFor="leaveType" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
          ประเภทการลา
        </label>
        <select
          id="leaveType"
          name="leaveType"
          value={leaveType}
          onChange={(event) => setLeaveType(event.target.value as LeaveType)}
          className={inputClass}
        >
          {LEAVE_TYPES.map((type) => (
            <option key={type} value={type}>
              {LEAVE_TYPE_LABEL_TH[type]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[#5B6B7B]">
          {leaveType === "sick"
            ? `ลาป่วยยื่นย้อนหลังได้ไม่เกิน ${settings.sickBackdateDays} วัน`
            : `ต้องยื่นล่วงหน้าอย่างน้อย ${settings.advanceNoticeMonths} เดือน (เริ่มลาได้ตั้งแต่ ${formatThaiDate(minStart)})`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="startDate" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
            วันแรกที่ลา
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            min={minStart}
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="endDate" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
            วันสุดท้ายที่ลา
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            min={startDate || minStart}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      {daysPreview !== null ? (
        <p className="text-sm text-[#5B6B7B]">
          รวม <span className="font-medium text-[#1A1A1A]">{daysPreview} วันทำงาน</span> (ไม่นับวันอาทิตย์และวันหยุดนักขัตฤกษ์)
        </p>
      ) : null}

      <div>
        <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
          เหตุผล (ไม่บังคับ)
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          maxLength={MAX_REASON_LENGTH}
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
          ยื่นคำขอลา {state.daysCount} วันแล้ว รอผู้อนุมัติพิจารณา
          {state.exceedsQuota ? (
            <span className="mt-1 block text-[#E8890C]">คำขอนี้ทำให้วันลาเกินโควตาของเดือน อาจถูกหักเงินตามกติกาบริษัท</span>
          ) : null}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full ht-btn-primary py-3"
      >
        {pending ? "กำลังส่ง..." : "ยื่นคำขอลา"}
      </button>
    </form>
  );
}
