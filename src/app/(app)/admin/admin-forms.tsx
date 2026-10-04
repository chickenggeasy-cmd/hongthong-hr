"use client";

import { useActionState, useState } from "react";
import { addHoliday, deleteHoliday, updateSettings, type AdminFormState } from "./actions";
import type { SettingDefinition } from "@/lib/admin/settings";
import { CardHeading } from "@/components/features/card-heading";
import type { StickerName } from "@/components/brand/sticker";
import { DateField } from "@/components/ui/date-field";

// ภาพประจำหัวข้อการตั้งค่าแต่ละกลุ่ม
const GROUP_STICKER: Record<string, StickerName> = {
  เวลาทำงานและค่าจ้าง: "alarm-clock",
  การลา: "beach",
  เงินเดือน: "money-bag",
  ใบเตือน: "bell",
  ตำแหน่งบริษัท: "pin",
  ความปลอดภัย: "lock-key",
};

const initialState: AdminFormState = { error: null, success: false };

const inputClass =
  "w-full ht-input";

function FormMessage({ state }: { state: AdminFormState }) {
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

export function SettingsForm({
  groups,
  values,
}: {
  groups: { name: string; items: SettingDefinition[] }[];
  values: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(updateSettings, initialState);
  // controlled เพื่อไม่ให้ค่าที่กรอกหายตอนบันทึกไม่ผ่าน
  const [draft, setDraft] = useState(values);

  return (
    <form action={formAction} className="space-y-6">
      {groups.map((group) => (
        <fieldset key={group.name} className="ht-card p-6">
          <legend className="sr-only">{group.name}</legend>
          <CardHeading sticker={GROUP_STICKER[group.name] ?? "gear"}>{group.name}</CardHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {group.items.map((item) => (
              <div key={item.key}>
                <label htmlFor={item.key} className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
                  {item.label}
                  {item.unit ? <span className="font-normal text-[#5B6B7B]"> ({item.unit})</span> : null}
                </label>
                <input
                  id={item.key}
                  name={item.key}
                  type={item.kind === "time" ? "time" : "text"}
                  inputMode={item.kind === "time" ? undefined : "decimal"}
                  required
                  value={draft[item.key] ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, [item.key]: event.target.value }))}
                  className={inputClass}
                />
                {item.help ? <p className="mt-1 text-xs text-[#5B6B7B]">{item.help}</p> : null}
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="sticky bottom-4 space-y-2 rounded-2xl bg-white/95 p-4 shadow-sm">
        <FormMessage state={state} />
        <button
          type="submit"
          disabled={pending}
          className="w-full ht-btn-primary py-2.5"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </form>
  );
}

export function AddHolidayForm() {
  const [state, formAction, pending] = useActionState(addHoliday, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr_auto]">
        <DateField name="holidayDate" required ariaLabel="วันที่" />
        <input name="holidayName" type="text" required maxLength={100} placeholder="ชื่อวันหยุด" aria-label="ชื่อวันหยุด" className={inputClass} />
        <button
          type="submit"
          disabled={pending}
          className="ht-btn-primary px-4 py-2"
        >
          เพิ่ม
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function DeleteHolidayButton({ date }: { date: string }) {
  const [state, formAction, pending] = useActionState(deleteHoliday, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="holidayDate" value={date} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-2 py-1 text-sm text-[#D64545] transition-colors hover:bg-[#D64545]/10 disabled:opacity-50"
      >
        {state.error ? "ลองใหม่" : "ลบ"}
      </button>
    </form>
  );
}
