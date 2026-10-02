-- ============================================================
-- hongthong-hr : migration ที่ 9 (จำกัดจำนวนครั้งล็อกอินผิด)
--   - บันทึกการล็อกอินผิดแยกตาม "กุญแจ" 2 แบบ: รหัสพนักงาน (code:69200001) และ IP (ip:1.2.3.4)
--     ผิดเกินเกณฑ์ภายในช่วงเวลาที่ตั้งไว้ = ล็อกอินไม่ได้ชั่วคราว (กันการเดาเลขบัตรทีละเลข)
--   - ตารางนี้ปิดสิทธิ์เบราว์เซอร์ทั้งหมด เขียน/อ่านผ่าน service role จาก Server Action ล็อกอินเท่านั้น
--   - การตัดสินว่าถูกล็อกหรือไม่อยู่ใน src/lib/auth/login-throttle.ts (มีเทสต์)
-- ============================================================

create table public.login_failures (
  id            bigint generated always as identity primary key,
  throttle_key  text not null check (length(throttle_key) between 1 and 100),
  failed_at     timestamptz not null default now()
);

create index login_failures_key_idx on public.login_failures (throttle_key, failed_at desc);
-- ใช้ตอนลบแถวเก่าทิ้ง (เก็บไว้ไม่เกิน 1 วัน)
create index login_failures_failed_at_idx on public.login_failures (failed_at);

alter table public.login_failures enable row level security;
-- ไม่มี policy = authenticated/anon เข้าไม่ได้เลย

grant all on public.login_failures to service_role;

insert into public.app_settings (key, value, description) values
  ('login.max_failures_per_code', '5',
   'ล็อกอินผิดได้กี่ครั้งต่อรหัสพนักงาน ก่อนถูกล็อกชั่วคราว'),
  ('login.max_failures_per_ip', '20',
   'ล็อกอินผิดได้กี่ครั้งต่อ IP (ทุกรหัสรวมกัน) ก่อนถูกล็อกชั่วคราว'),
  ('login.lock_minutes', '15',
   'นับครั้งที่ผิดย้อนหลังกี่นาที (ผิดครบเกณฑ์ในช่วงนี้ = ล็อก จนกว่าครั้งเก่าจะพ้นช่วง)')
on conflict (key) do nothing;
