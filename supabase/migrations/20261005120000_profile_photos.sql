-- ============================================================
-- hongthong-hr : migration ที่ 15 (รูปโปรไฟล์ของพนักงาน)
--   - ทุกคนเลือกรูปของตัวเองได้ เปลี่ยน/ลบได้ตลอด
--   - เก็บในคอลัมน์เดิม employees.photo_path (มีตั้งแต่ migration แรก ยังไม่เคยใช้)
--   - ไฟล์อยู่ใน bucket ส่วนตัว "avatars" อัปโหลด/อ่านผ่านเซิร์ฟเวอร์ (service role) หลังตรวจตัวตนแล้วเท่านั้น
--     เหมือนรูปเช็คอิน จึงไม่ต้องตั้ง policy ของ storage.objects
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

comment on column public.employees.photo_path is
  'รูปโปรไฟล์: path ใน Storage bucket "avatars" รูปแบบ <employee_id>/<ชื่อไฟล์> (null = ใช้ตัวอักษรแรกของชื่อแทน)';

-- กันข้อมูลแปลกปลอม: path ต้องอยู่ในโฟลเดอร์ของพนักงานคนนั้นเอง
alter table public.employees
  add constraint employees_photo_path_check
  check (photo_path is null or photo_path ~ ('^' || id::text || '/[A-Za-z0-9_-]+\.(jpg|png|webp)$'));
