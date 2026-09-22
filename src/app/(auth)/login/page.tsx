"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#EAF3FC] px-4 py-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[#D4A017]" />
          <h1 className="text-xl font-semibold text-[#1A1A1A]">หงส์ทอง</h1>
          <p className="mt-1 text-sm text-[#5B6B7B]">ระบบเข้าสู่ระบบพนักงาน</p>
        </div>

        <form action={formAction} className="space-y-5">
          <div>
            <label htmlFor="employeeCode" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
              รหัสพนักงาน
            </label>
            <input
              id="employeeCode"
              name="employeeCode"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              maxLength={8}
              required
              placeholder="8 หลัก เช่น 69200001"
              className="w-full rounded-lg border border-[#5B6B7B]/30 px-4 py-2.5 text-[#1A1A1A] outline-none focus:border-[#1E5FA8] focus:ring-2 focus:ring-[#1E5FA8]/20"
            />
          </div>

          <div>
            <label htmlFor="nationalId" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
              เลขบัตรประชาชน
            </label>
            <input
              id="nationalId"
              name="nationalId"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
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

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[#1E5FA8] py-2.5 font-medium text-white transition-colors hover:bg-[#1E5FA8]/90 disabled:opacity-60"
          >
            {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#5B6B7B]">
          ล็อกอินครั้งแรกด้วยรหัสพนักงาน + เลขบัตรประชาชน ครั้งต่อไปเข้าจากอุปกรณ์เดิมได้ทันที
        </p>
      </div>
    </main>
  );
}