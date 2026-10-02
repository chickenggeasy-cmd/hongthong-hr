"use client";

import { useActionState, useRef } from "react";
import { registerEmployee, type RegisterEmployeeState } from "./actions";
import { CardHeading } from "@/components/features/card-heading";

const initialState: RegisterEmployeeState = { error: null, success: false };

export function RegisterForm({ departments }: { departments: { code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(registerEmployee, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="space-y-4 ht-card p-6"
    >
      <CardHeading sticker="cards" className="">ลงทะเบียนพนักงานใหม่</CardHeading>

      <div>
        <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
          ชื่อ-นามสกุล
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          className="w-full rounded-lg border border-[#5B6B7B]/30 px-4 py-2.5 text-[#1A1A1A] outline-none focus:border-[#1E5FA8] focus:ring-2 focus:ring-[#1E5FA8]/20"
        />
      </div>

      <div>
        <label htmlFor="deptCode" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
          แผนก
        </label>
        <select
          id="deptCode"
          name="deptCode"
          required
          defaultValue=""
          className="w-full rounded-lg border border-[#5B6B7B]/30 bg-white px-4 py-2.5 text-[#1A1A1A] outline-none focus:border-[#1E5FA8] focus:ring-2 focus:ring-[#1E5FA8]/20"
        >
          <option value="" disabled>
            เลือกแผนก
          </option>
          {departments.map((dept) => (
            <option key={dept.code} value={dept.code}>
              {dept.code} — {dept.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="nationalId" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
          เลขบัตรประชาชน
        </label>
        <input
          id="nationalId"
          name="nationalId"
          type="text"
          inputMode="numeric"
          maxLength={17}
          required
          placeholder="13 หลัก"
          className="w-full rounded-lg border border-[#5B6B7B]/30 px-4 py-2.5 text-[#1A1A1A] outline-none focus:border-[#1E5FA8] focus:ring-2 focus:ring-[#1E5FA8]/20"
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-[#D64545]/10 px-3 py-2 text-sm text-[#D64545]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-lg bg-[#2E9E5B]/10 px-3 py-2 text-sm text-[#2E9E5B]">
          ลงทะเบียนสำเร็จ รหัสพนักงานคือ <strong>{state.employeeCode}</strong> — แจ้งรหัสนี้พร้อมเลขบัตร
          ให้พนักงานใช้ล็อกอินครั้งแรก
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full ht-btn-primary py-2.5"
      >
        {pending ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
      </button>
    </form>
  );
}