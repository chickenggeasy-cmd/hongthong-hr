-- ============================================================
-- hongthong-hr : migration ที่ 7 (รูปเช็คอินไม่บังคับ)
--   เจ้าของโปรเจกต์ตัดสินใจ 2 ต.ค. 2569: พนักงานบางคนไม่อยากถ่ายรูป จึงให้ส่งรูปหรือไม่ส่งก็ได้
--   การยืนยันตำแหน่ง (GPS + รัศมี) ยังบังคับเหมือนเดิม
-- ============================================================

alter table public.attendance_logs alter column photo_path drop not null;

comment on column public.attendance_logs.photo_path is
  'path ใน Storage bucket "attendance-photos" (null = พนักงานไม่ได้ส่งรูป)';
