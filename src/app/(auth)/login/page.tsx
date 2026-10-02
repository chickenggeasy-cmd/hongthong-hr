"use client";

import Image from "next/image";
import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { DotPattern } from "@/components/brand/illustrations";
import { LoginScene } from "@/components/brand/scenes";
import { Sticker, type StickerName } from "@/components/brand/sticker";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

const FEATURES: { sticker: StickerName; text: string }[] = [
  { sticker: "pin", text: "เช็คอิน/เช็คเอาท์ด้วย GPS" },
  { sticker: "calendar", text: "ขอลา · ขอ OT · อนุมัติออนไลน์" },
  { sticker: "receipt", text: "สลิปเงินเดือนดาวน์โหลดได้ทันที" },
];

const inputClass =
  "w-full ht-input py-3";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="grid min-h-dvh bg-[#EAF3FC] lg:grid-cols-[1.1fr_1fr]">
      {/* ฝั่งแบรนด์ (จอใหญ่) */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#1E5FA8] via-[#0F3B6E] to-[#2A73C2] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <DotPattern className="absolute inset-0 h-full w-full text-white/[0.07]" />
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#D4A017] via-[#FFF1BF] to-[#D4A017]" aria-hidden />
        <div className="ht-blob absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#5BA4E6]/25 blur-3xl" aria-hidden />
        <div className="ht-blob absolute -right-24 top-24 h-80 w-80 rounded-full bg-[#D4A017]/15 blur-3xl" style={{ animationDelay: "-7s" }} aria-hidden />

        <div className="relative flex items-center gap-3">
          <Image src="/brand/logo.webp" alt="" width={56} height={56} className="h-14 w-14 rounded-full ring-2 ring-[#D4A017]" />
          <div>
            <p className="text-xl font-bold">หงส์ทอง</p>
            <p className="text-sm text-white/70">Cash &amp; Carry · ระบบพนักงาน</p>
          </div>
        </div>

        <div className="ht-rise relative">
          <h2 className="text-4xl font-bold leading-tight xl:text-5xl">
            ทุกเรื่องงานของคุณ
            <br />
            <span className="text-[#F0C75E]">ครบจบในที่เดียว</span>
          </h2>
          <ul className="mt-6 space-y-3">
            {FEATURES.map(({ sticker, text }, i) => (
              <li
                key={text}
                className="ht-rise flex items-center gap-3 text-white/90"
                style={{ animationDelay: `${250 + i * 120}ms` }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                  <Sticker name={sticker} size={30} />
                </span>
                {text}
              </li>
            ))}
          </ul>
          {/* ฉาก 3D: ห้าง + พนักงานหลายฝ่าย + สินค้าของทุกแผนก */}
          <LoginScene className="mt-10 origin-left scale-[0.85] xl:scale-100" />
        </div>

        <p className="relative text-sm text-white/60">ของดี ราคาส่ง เพื่อธุรกิจของคุณ</p>
      </section>

      {/* ฝั่งฟอร์ม */}
      <section className="relative flex items-center justify-center overflow-hidden px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="ht-blob absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#5BA4E6]/25 blur-3xl" aria-hidden />
        <div className="ht-blob absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#F0C75E]/25 blur-3xl" style={{ animationDelay: "-5s" }} aria-hidden />
        <div className="ht-rise relative w-full max-w-sm">
          {/* ภาพ 3D เล็กๆ เกาะขอบการ์ด */}
          <span className="ht-float absolute -right-2 -top-6 z-10 block sm:-right-5" aria-hidden>
            <Sticker name="key" size={56} className="ht-pop" style={{ animationDelay: "400ms" }} />
          </span>
          <span className="ht-float-slow absolute -bottom-5 -left-2 z-10 block sm:-left-5" style={{ animationDelay: "-2s" }} aria-hidden>
            <Sticker name="sparkles" size={44} className="ht-pop" style={{ animationDelay: "600ms" }} />
          </span>
          <div className="rounded-3xl border border-white bg-white p-8 shadow-2xl shadow-[#1E5FA8]/15">
            <div className="mb-8 text-center">
              <Image
                src="/brand/logo.webp"
                alt="หงส์ทอง Cash & Carry"
                width={112}
                height={112}
                priority
                className="ht-pop mx-auto h-28 w-28 rounded-full shadow-lg shadow-[#D4A017]/30 ring-4 ring-[#F0C75E]/50"
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
                className="group relative w-full overflow-hidden ht-btn-primary py-3"
              >
                <span className="ht-shine" aria-hidden />
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
