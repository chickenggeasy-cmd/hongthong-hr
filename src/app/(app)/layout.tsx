import type { ReactNode } from "react";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { logout } from "@/lib/auth/actions";
import { AppHeader } from "@/components/features/app-header";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const employee = await getCurrentEmployee();

  // เกิดได้เมื่อ session ยังอยู่ (proxy.ts เลยปล่อยผ่านมาถึงหน้านี้) แต่พนักงานถูกลบ/ปิดใช้งานไปแล้ว (เช่น ลาออก)
  // ไม่ redirect ไป /login ตรงนี้ตรงๆ เพราะ proxy.ts จะเห็นว่ายังมี session แล้วเด้งกลับมาที่นี่วนซ้ำ
  // ให้กดออกจากระบบเอง (signOut ผ่าน Server Action ทำได้ ต่างจาก redirect ระหว่าง render)
  if (!employee) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#EAF3FC] px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-[#1A1A1A]">บัญชีนี้ไม่สามารถใช้งานได้ในขณะนี้</p>
          <p className="mt-1 text-sm text-[#5B6B7B]">กรุณาติดต่อ HR หากคิดว่านี่คือความผิดพลาด</p>
          <form action={logout} className="mt-6">
            <button
              type="submit"
              className="w-full rounded-lg bg-[#1E5FA8] py-2.5 font-medium text-white hover:bg-[#1E5FA8]/90"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-[#EAF3FC]">
      <AppHeader employee={employee} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}