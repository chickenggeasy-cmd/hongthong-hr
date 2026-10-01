@AGENTS.md

# คำสั่งสำหรับ Claude Code — อ่านไฟล์นี้ก่อนทุกครั้ง

โปรเจกต์นี้พัฒนาคู่กับ Claude (แชท) มาก่อน ไฟล์นี้สรุปบริบทและแบบแผน (pattern) ที่ใช้ซ้ำทั้งโปรเจกต์
อ่าน `README.md` ประกอบด้วยเสมอ (มีรายละเอียดฟีเจอร์ ธีมสี ตารางแผนก ที่ไม่ซ้ำกับที่นี่)

## บริบท

งานจำลองเพื่อการศึกษา (ไม่มีลูกค้าจริง ไม่มีงบจริง) อิงจากเอกสาร SA ฉบับร่าง แล้วต่อยอดเอง
เจ้าของโปรเจกต์ไม่ถนัดสาย dev มาก่อน **อธิบายทุกคำสั่งที่ต้องรันแบบละเอียด ทีละขั้น เหมือนอธิบายให้มือใหม่**
อย่าข้ามขั้นตอนหรือสมมติว่ารู้คำสั่ง

## กฎการเขียนโค้ดที่ใช้ทั้งโปรเจกต์ (ห้ามเบี่ยงจากนี้โดยไม่ถาม)

1. ภาษาไทยในสิ่งที่ผู้ใช้เห็นและในคอมเมนต์อธิบายเหตุผล โค้ด/ชื่อตัวแปร/ชื่อฟังก์ชันเป็นอังกฤษ
2. เขียน migration SQL ก่อนเขียนหน้าเว็บเสมอ ฐานข้อมูลเป็นฐานของทุกฟีเจอร์
3. เขียนข้อมูลผ่านเซิร์ฟเวอร์เท่านั้น ฝั่งเบราว์เซอร์ (`authenticated`) มีสิทธิ์อ่านอย่างเดียวทุกตาราง
   มี 2 วิธีเขียนข้อมูล เลือกตามสถานการณ์:
   - **SECURITY DEFINER function** ในฐานข้อมูล (เช่น `register_employee`, `request_leave`,
     `decide_leave_request`) ใช้เมื่อตัดสินสิทธิ์ได้จากผู้ใช้ที่ล็อกอินอยู่ (`auth.uid()`)
     เรียกผ่าน `supabase.rpc()` ด้วย client ธรรมดา (`src/lib/supabase/server.ts`) ข้อดี: ไม่ต้องใช้ service role เลย
   - **service role client** (`src/lib/supabase/service.ts`) ใช้เมื่อต้องอ่าน/เขียนตารางที่ปิดสิทธิ์
     authenticated ไปเลย (เช่น `app_settings`) หรือ logic ซับซ้อนเกินจะเขียนเป็น SQL function
     **กฎเหล็ก:** ก่อนใช้ service role ต้องตรวจตัวตนด้วย `getCurrentEmployee()` (client ธรรมดา) ก่อนเสมอ
     ห้ามเชื่อ id ใดๆ ที่ส่งมาจากฟอร์ม/ฝั่งเบราว์เซอร์ตรงๆ
4. ทุก Server Action เช็กสิทธิ์ซ้ำที่ตัวมันเอง แม้หน้าเว็บจะกันด้วย `requirePermission()` แล้วก็ตาม
   เพราะ Server Action เรียกตรงได้โดยไม่ผ่านหน้าเว็บ (ดูตัวอย่างใน `approvals/actions.ts`)
5. error message ไม่บอกรายละเอียดที่ช่วยให้เดาข้อมูลคนอื่นได้ เช่น ล็อกอินผิดใช้ข้อความเดียวกันทุกกรณี
   ไม่บอกว่า "รหัสพนักงานไม่มีอยู่จริง" ต่างจาก "เลขบัตรผิด"
6. ใช้ `useActionState` + Server Action สำหรับทุกฟอร์ม ไม่ใช้ fetch/API route เอง
   รูปแบบ state: `{ error: string | null; success: boolean; ...ข้อมูลเสริม }`
7. สิทธิ์หน้าเว็บมาจากตารางเดียว `src/lib/permissions.ts` (`PERMISSION_ROLES`, `NAV_ITEMS`)
   เพิ่มหน้าใหม่ที่ต้องกันสิทธิ์ → เพิ่ม permission ที่นั่น + เรียก `requirePermission()` บรรทัดแรกของ `page.tsx`
   อย่าเขียนเช็กสิทธิ์กระจายเองในแต่ละหน้า
8. ทุก logic ที่คำนวณ/ตัดสินใจ (ไม่ใช่ UI) แยกเป็น pure function ใน `src/lib/` แล้วเขียนเทสต์
   (ดู `src/lib/leave/logic.ts` + `tests/leave-logic.test.ts` เป็นตัวอย่าง)
   ไฟล์ใน `src/lib/` ที่เทสต์เรียกใช้ ให้ import กันเองแบบ relative (`../date`) เพราะ Vitest ไม่รู้จัก `@/`
9. ตัวเลขกติกาธุรกิจที่อาจเปลี่ยน เก็บในตาราง `app_settings` ไม่ hardcode ในโค้ด
10. ก่อนส่งงานทุกครั้ง: `npx tsc --noEmit` ผ่าน + `npx vitest run` ผ่านทั้งหมด (ปัจจุบัน 50 ข้อ)
    (ถ้า tsc ฟ้อง `LayoutProps` ไม่รู้จัก ให้รัน `npx next typegen` ก่อน)

## โครงสร้างที่ตั้งไว้แล้ว ห้ามสร้างซ้ำซ้อน

- `src/lib/supabase/client.ts` / `server.ts` / `service.ts` / `middleware.ts` — Supabase client ทุกแบบ
- `src/lib/auth/current-user.ts` — `getCurrentEmployee()` ใช้ตรงนี้ที่เดียว ห้ามเขียน query ซ้ำที่อื่น
- `src/lib/auth/require-permission.ts` — ตัวกั้นหน้า
- `src/lib/permissions.ts` — ตารางสิทธิ์+เมนูกลาง
- `src/lib/date.ts` — ตัวช่วยวันที่ `YYYY-MM-DD` ตามเวลาไทย (`bangkokToday`, `addMonths`, `formatThaiDate` ...)
- `src/lib/attendance/logic.ts`, `src/lib/leave/logic.ts` — ตัวอย่าง pure logic ที่มีเทสต์
- `src/components/features/app-header.tsx`, `placeholder-page.tsx`, `leave-status-badge.tsx` — คอมโพเนนต์ใช้ซ้ำ
- `scripts/create-first-user.ts` — อ้างอิงถ้าต้องเขียนสคริปต์รันครั้งเดียวอีก
- error จาก SQL function ใช้ message เป็นรหัสภาษาอังกฤษ (เช่น `leave.overlap`) แล้วแปลเป็นไทยฝั่งเว็บ
  (ดู `leaveErrorMessage()` ใน `src/lib/leave/logic.ts`)

## ธีมสี

ใช้ hex ตรงๆ ใน className ของ Tailwind (ไม่ได้ตั้งเป็น theme token ใน config)

ฟ้าเข้ม `#1E5FA8` · ฟ้าอ่อน `#EAF3FC` · ทอง `#D4A017` (เน้น/โลโก้เท่านั้น ห้ามใช้เป็นสีตัวหนังสือ) ·
ดำ `#1A1A1A` · เทา `#5B6B7B` · เขียว `#2E9E5B` (สำเร็จ) · ส้ม `#E8890C` (รอ) · แดง `#D64545` (ผิดพลาด)

## สถานะปัจจุบัน (เช็ค README.md ว่าทันสมัยกว่านี้ไหมก่อนเชื่อ)

**เสร็จแล้ว:** ฐานข้อมูลแกนหลัก, ล็อกอิน, เช็คอิน/เช็คเอาท์ (GPS+รูป), สิทธิ์หน้าเว็บตามบทบาท,
ขอลา/อนุมัติลา (migration `..._leave_requests.sql` + หน้า `/leave`, `/approvals`)

**ลงทะเบียนพนักงานผ่านเว็บ:** เจ้าของโปรเจกต์เขียนไว้ในเครื่องแล้ว แต่ ณ 1 ต.ค. 2569 ยังไม่ได้ขึ้น GitHub
(`employees/actions.ts`, `register-form.tsx`)

## ประเด็นที่ยังไม่ยืนยัน (ห้ามเดาเติมเอง ถ้าไม่ชัวร์ให้ถามหรือทำเป็นค่าตั้งต้นที่แก้ง่าย)

ดูหัวข้อ "ประเด็นที่ต้องตัดสินใจเอง" ใน README.md — มีผลต่อสูตรเงินเดือนและกฎการลา/OT โดยตรง
