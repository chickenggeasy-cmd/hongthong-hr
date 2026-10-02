"use client";

import Image from "next/image";
import { useActionState } from "react";
import { CalendarCheck, Clock, ReceiptText, ShieldCheck } from "lucide-react";
import { DotPattern, WarehouseScene } from "@/components/brand/illustrations";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

const FEATURES = [
  { icon: Clock, text: "เช็คอิน/เช็คเอาท์ด้วย GPS" },
  { icon: CalendarCheck, text: "ขอลา · ขอ OT · อนุมัติออนไลน์" },
  { icon: ReceiptText, text: "สลิปเงินเดือนดาวน์โหลดได้ทันที" },
];

const inputClass =
  "w-full rounded-xl border border-[#5B6B7B]/25 bg-white px-4 py-3 text-[#1A1A1A] outline-none transition-shadow focus:border-[#1E5FA8] focus:ring-4 focus:ring-[#1E5FA8]/15";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="grid min-h-dvh bg-[#EAF3FC] lg:grid-cols-[1.1fr_1fr]">
      {/* ฝั่งแบรนด์ (จอใหญ่) */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#1E5FA8] via-[#18528F] to-[#0F3B6E] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <DotPattern className="absolute inset-0 h-full w-full text-white/[0.07]" />
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#D4A017] via-[#F0C75E] to-[#D4A017]" aria-hidden />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#5BA4E6]/20 blur-3xl" aria-hidden />

        <div className="relative flex items-center gap-3">
          <Image src="/brand/logo.webp" alt="" width={56} height={56} className="h-14 w-14 rounded-full ring-2 ring-[#D4A017]" />
          <div>
            <p className="text-xl font-bold">หงส์ทอง</p>
            <p className="text-sm text-white/70">Cash &amp; Carry · ระบบพนักงาน</p>
          </div>
        </div>

        <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="text-4xl font-bold leading-tight">
            ทุกเรื่องงานของคุณ
            <br />
            <span className="text-[#F0C75E]">ครบจบในที่เดียว</span>
          </h2>
          <ul className="mt-6 space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/90">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <WarehouseScene className="mt-8 w-full max-w-md drop-shadow-2xl" />
        </div>

        <p className="relative text-sm text-white/60">ของดี ราคาส่ง เพื่อธุรกิจของคุณ</p>
      </section>

      {/* ฝั่งฟอร์ม */}
      <section className="flex items-center justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-500">
          <div className="rounded-3xl bg-white p-8 shadow-xl shadow-[#1E5FA8]/10">
            <div className="mb-8 text-center">
              <Image
                src="/brand/logo.webp"
                alt="หงส์ทอง Cash & Carry"
                width={112}
                height={112}
                priority
                className="mx-auto h-28 w-28 rounded-full shadow-md ring-4 ring-[#EAF3FC]"
              />
              <h1 className="mt-4 text-2xl font-bold text-[#1A1A1A]">ยินดีต้อนรับ</h1>
              <p className="mt-1 text-sm text-[#5B6B7B]">เข้าสู่ระบบพนักงานหงส์ทอง</p>
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
                  className={inputClass}
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
                  className={inputClass}
                />
              </div>

              {state.error ? (
                <p role="alert" className="rounded-xl bg-[#D64545]/10 px-3 py-2 text-sm text-[#D64545]">
                  {state.error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-gradient-to-r from-[#1E5FA8] to-[#164A85] py-3 font-bold text-white shadow-lg shadow-[#1E5FA8]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-60"
              >
                {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </button>
            </form>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-[#5B6B7B]">
              <ShieldCheck className="h-4 w-4 text-[#2E9E5B]" aria-hidden />
              เลขบัตรถูกเข้ารหัส ไม่มีการเก็บเลขจริง
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
