-- ============================================================
-- hongthong-hr : migration ที่ 2 (เช็คอิน/เช็คเอาท์)
--   - เพิ่มระบบเช็คอินของเราเอง (นอกเหนือขอบเขตเดิมที่วางแผนไว้)
--   - ตรวจระยะทางจากพิกัดบริษัทที่เซิร์ฟเวอร์ (ไม่เชื่อพิกัด/เวลาจากเครื่องพนักงาน)
--   - เขียนข้อมูล + อัปโหลดรูปผ่าน service role เท่านั้น (Server Action)
-- ============================================================


-- ---------- 1) ค่าตั้งค่าตำแหน่งบริษัท (แก้ได้ทีหลังไม่ต้องแก้โค้ด) ----------
insert into public.app_settings (key, value, description) values
  ('company.latitude', '13.7563', 'พิกัดละติจูดบริษัท (ค่าเริ่มต้น เป็นค่าตัวอย่าง ต้องแก้เป็นพิกัดจริง)'),
  ('company.longitude', '100.5018', 'พิกัดลองจิจูดบริษัท (ค่าเริ่มต้น เป็นค่าตัวอย่าง ต้องแก้เป็นพิกัดจริง)'),
  ('attendance.radius_meters', '200', 'รัศมีที่ยอมให้เช็คอินได้ (เมตร) จากพิกัดบริษัท')
on conflict (key) do nothing;


-- ---------- 2) ฟังก์ชันคำนวณระยะทางระหว่างพิกัด 2 จุด (หน่วยเมตร) ----------
-- สูตร haversine ระยะทางบนพื้นผิวโลก แม่นยำพอสำหรับระยะไม่กี่กิโลเมตร
create function public.distance_meters(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000 * asin(
    sqrt(
      sin(radians(lat2 - lat1) / 2) ^ 2 +
      cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
    )
  )
$$;


-- ---------- 3) ตัวช่วยหา id พนักงานของผู้ใช้ที่ล็อกอินอยู่ ----------
-- แยกไว้เป็นฟังก์ชันกลาง เพราะตารางถัดไป (ลา/OT) ก็ต้องใช้ตัวเดียวกันนี้
create function public.auth_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id from public.employees e
  where e.auth_user_id = (select auth.uid())
    and e.status = 'active'
$$;


-- ---------- 4) ตารางบันทึกเช็คอิน/เช็คเอาท์ ----------
create table public.attendance_logs (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees (id) on delete cascade,
  type            text not null check (type in ('check_in', 'check_out')),
  recorded_at     timestamptz not null default now(), -- เวลาเซิร์ฟเวอร์เท่านั้น ไม่รับเวลาจากเครื่อง
  latitude        double precision not null,
  longitude       double precision not null,
  distance_meters double precision not null,
  within_radius   boolean not null,
  photo_path      text not null, -- path ใน Storage bucket "attendance-photos"
  created_at      timestamptz not null default now()
);

create index attendance_logs_employee_time_idx on public.attendance_logs (employee_id, recorded_at desc);


-- ---------- 5) Storage bucket เก็บรูปเช็คอิน (ส่วนตัว ไม่ public) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-photos', 'attendance-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
-- ไม่ต้องตั้ง RLS policy ของ storage.objects เพราะอัปโหลด/อ่านรูปทำผ่าน service role ทั้งหมด
-- (อัปโหลดตอนเช็คอิน และสร้างลิงก์ดูรูปแบบมีอายุ - signed URL - ตอนแสดงผลย้อนหลัง)


-- ---------- 6) RLS ----------
alter table public.attendance_logs enable row level security;

-- เห็นเหมือน employees_select: ตัวเอง | หัวหน้าเห็นทีม | 00/01/HR เห็นทั้งหมด
-- ไม่มี policy insert/update/delete ให้ authenticated เขียนไม่ได้เลย ต้องผ่าน service role เท่านั้น
create policy attendance_logs_select on public.attendance_logs
  for select to authenticated
  using (
    employee_id = (select public.auth_employee_id())
    or (select public.auth_role()) in ('executive', 'finance', 'hr')
    or (
      (select public.auth_role()) = 'head'
      and exists (
        select 1
        from public.employees e
        join public.departments d on d.code = e.dept_code
        where e.id = attendance_logs.employee_id
          and d.team_group = left((select public.auth_dept_code()), 1)
      )
    )
  );


-- ---------- 7) สิทธิ์ (GRANT) ----------
grant select on public.attendance_logs to authenticated;
grant all on public.attendance_logs to service_role;

revoke all on function public.auth_employee_id() from public, anon;
grant execute on function public.auth_employee_id() to authenticated, service_role;

revoke all on function public.distance_meters(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.distance_meters(double precision, double precision, double precision, double precision) to authenticated, service_role;