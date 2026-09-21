-- ============================================================
-- hongthong-hr : migration แรก (แกนหลักของระบบ)
--   - ตั้งค่าระบบ, แผนก (รหัส 00-71), พนักงาน
--   - ตัวสร้างรหัสพนักงาน 8 หลัก (ปี พ.ศ. 2 หลัก + แผนก 2 หลัก + เลขรัน 4 หลัก)
--   - RLS: พนักงานเห็นตัวเอง / หัวหน้าเห็นทีม / 00, 01, HR เห็นทั้งหมด
--
-- หลักการ: การเขียนข้อมูล (ลงทะเบียน/แก้ไข) ทำผ่านเซิร์ฟเวอร์ด้วย service role เท่านั้น
--          ฝั่งเบราว์เซอร์ (authenticated) อ่านได้อย่างเดียว
-- ============================================================


-- ---------- 1) ตั้งค่าระบบ (แก้ค่าได้โดยไม่ต้องแก้โปรแกรม) ----------
create table public.app_settings (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value, description) values
  ('employee_code.reset_years', '2',
   'เลขรันของรหัสพนักงานรีเซ็ตทุกกี่ปี (รอ SA ยืนยันวิธีนับรอบ)'),
  ('employee_code.anchor_year', '2569',
   'ปี พ.ศ. ที่เริ่มนับรอบแรก (รอ SA ยืนยัน)');


-- ---------- 2) แผนก / ตำแหน่ง ----------
-- role: executive=00, finance=01, hr=20/21, head=หัวหน้าแผนก, employee=พนักงานทั่วไป
-- team_group: เลขหลักแรกของรหัส ใช้จับทีม (30 เห็น 31, 40 เห็น 41 ...)
create table public.departments (
  code       text primary key check (code ~ '^[0-9]{2}$'),
  name       text not null,
  role       text not null check (role in ('executive', 'finance', 'hr', 'head', 'employee')),
  team_group text generated always as (left(code, 1)) stored,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.departments (code, name, role) values
  ('00', 'ผู้บริหาร',                      'executive'),
  ('01', 'การเงิน',                        'finance'),
  ('20', 'หัวหน้าแผนก HR',                 'hr'),
  ('21', 'พนักงาน HR',                     'hr'),
  ('30', 'หัวหน้าแผนกช่าง',                'head'),
  ('31', 'พนักงานช่าง',                    'employee'),
  ('40', 'หัวหน้าแผนกอาหารสด',             'head'),
  ('41', 'พนักงานอาหารสด',                 'employee'),
  ('50', 'หัวหน้าแผนกอาหารแห้ง',           'head'),
  ('51', 'พนักงานอาหารแห้ง',               'employee'),
  ('60', 'หัวหน้าแผนกเครื่องใช้ในบ้าน',    'head'),
  ('61', 'พนักงานแผนกเครื่องใช้ในบ้าน',    'employee'),
  ('70', 'หัวหน้าเครื่องใช้ไฟฟ้า',         'head'),
  ('71', 'พนักงานแผนกเครื่องใช้ไฟฟ้า',     'employee')
on conflict (code) do nothing;


-- ---------- 3) พนักงาน ----------
create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  employee_code text not null unique check (employee_code ~ '^[0-9]{8}$'),
  dept_code     text not null references public.departments (code),
  full_name     text not null check (length(btrim(full_name)) > 0),
  photo_path    text,                                   -- path ใน Supabase Storage
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  status        text not null default 'active' check (status in ('active', 'resigned')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index employees_dept_code_idx on public.employees (dept_code);

-- เลขบัตรประชาชนเก็บแยกตาราง เป็นค่า HMAC-SHA256 (hex 64 ตัว) ที่คำนวณฝั่งเซิร์ฟเวอร์
-- ไม่เปิดสิทธิ์ให้เบราว์เซอร์อ่านเลย (unique = ป้องกันลงทะเบียนเลขบัตรซ้ำ)
create table public.employee_credentials (
  employee_id      uuid primary key references public.employees (id) on delete cascade,
  national_id_hash text not null unique check (national_id_hash ~ '^[0-9a-f]{64}$')
);

-- ตัวนับเลขรันต่อ (แผนก, รอบ)
create table public.employee_code_counters (
  dept_code        text not null references public.departments (code),
  block_start_year int  not null,
  last_number      int  not null default 0,
  primary key (dept_code, block_start_year)
);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();


-- ---------- 4) ฟังก์ชันช่วยเช็กสิทธิ์ (ใช้ใน RLS) ----------
create function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select d.role
  from public.employees e
  join public.departments d on d.code = e.dept_code
  where e.auth_user_id = (select auth.uid())
    and e.status = 'active'
$$;

create function public.auth_dept_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select e.dept_code
  from public.employees e
  where e.auth_user_id = (select auth.uid())
    and e.status = 'active'
$$;


-- ---------- 5) ตัวสร้างรหัสพนักงาน ----------
-- รูปแบบ: YY + แผนก + เลขรัน 4 หลัก เช่น 69 31 0001
-- เลขรันนับต่อเนื่องภายในรอบ (ค่าเริ่มต้น 2 ปี นับจากปีอ้างอิง) แล้วรีเซ็ตเป็น 0001
-- p_be_year ใช้ทดสอบเท่านั้น (ปกติใช้ปี พ.ศ. ปัจจุบันตามเวลาไทย)
create function public.generate_employee_code(p_dept_code text, p_be_year int default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year        int;
  v_block_years int;
  v_anchor      int;
  v_block_start int;
  v_next        int;
begin
  perform 1 from public.departments where code = p_dept_code and is_active;
  if not found then
    raise exception 'ไม่พบรหัสแผนก % หรือถูกปิดใช้งาน', p_dept_code using errcode = '22023';
  end if;

  v_year := coalesce(
    p_be_year,
    extract(year from (now() at time zone 'Asia/Bangkok'))::int + 543
  );

  select value::int into v_block_years from public.app_settings where key = 'employee_code.reset_years';
  select value::int into v_anchor      from public.app_settings where key = 'employee_code.anchor_year';

  if v_block_years is null or v_block_years < 1 or v_anchor is null then
    raise exception 'ตั้งค่ารอบเลขรันใน app_settings ไม่ถูกต้อง' using errcode = '22023';
  end if;

  v_block_start := v_anchor + floor((v_year - v_anchor)::numeric / v_block_years)::int * v_block_years;

  insert into public.employee_code_counters as c (dept_code, block_start_year, last_number)
  values (p_dept_code, v_block_start, 1)
  on conflict (dept_code, block_start_year)
  do update set last_number = c.last_number + 1
  returning c.last_number into v_next;

  if v_next > 9999 then
    raise exception 'เลขรันของแผนก % ในรอบนี้เต็มแล้ว (เกิน 9999)', p_dept_code using errcode = '54000';
  end if;

  return lpad((v_year % 100)::text, 2, '0') || p_dept_code || lpad(v_next::text, 4, '0');
end;
$$;

-- ลงทะเบียนพนักงานใหม่ในทรานแซกชันเดียว (สร้างรหัส + พนักงาน + เลขบัตรที่แฮชแล้ว)
-- ถ้าเลขบัตรซ้ำ จะ error และตัวนับเลขรันถูกย้อนกลับด้วย ไม่เกิดเลขข้าม
create function public.register_employee(
  p_dept_code        text,
  p_full_name        text,
  p_national_id_hash text,
  p_photo_path       text default null
)
returns table (new_id uuid, new_employee_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_id   uuid;
begin
  v_code := public.generate_employee_code(p_dept_code);

  insert into public.employees (employee_code, dept_code, full_name, photo_path)
  values (v_code, p_dept_code, p_full_name, p_photo_path)
  returning id into v_id;

  insert into public.employee_credentials (employee_id, national_id_hash)
  values (v_id, p_national_id_hash);

  return query select v_id, v_code;
end;
$$;


-- ---------- 6) RLS ----------
alter table public.app_settings          enable row level security;
alter table public.departments           enable row level security;
alter table public.employees             enable row level security;
alter table public.employee_credentials  enable row level security;
alter table public.employee_code_counters enable row level security;
-- app_settings / employee_credentials / employee_code_counters ไม่มี policy = เบราว์เซอร์เข้าไม่ได้เลย

create policy departments_select on public.departments
  for select to authenticated
  using (true);

-- พนักงานเห็นตัวเอง | 00, 01, HR เห็นทั้งหมด | หัวหน้าเห็นแผนกตัวเอง + ลูกทีม
-- (สิทธิ์ของ HR ยังรอ SA ยืนยันข้อ 5 ตอนนี้ให้เห็นทั้งหมดไว้ก่อน)
create policy employees_select on public.employees
  for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or (select public.auth_role()) in ('executive', 'finance', 'hr')
    or (
      (select public.auth_role()) = 'head'
      and exists (
        select 1
        from public.departments d
        where d.code = employees.dept_code
          and d.team_group = left((select public.auth_dept_code()), 1)
      )
    )
  );


-- ---------- 7) สิทธิ์ (GRANT) ----------
-- โปรเจกต์ปิด "expose new tables อัตโนมัติ" จึงต้องให้สิทธิ์เองทุกตาราง
grant select on public.departments to authenticated;
grant select on public.employees   to authenticated;

grant all on
  public.app_settings,
  public.departments,
  public.employees,
  public.employee_credentials,
  public.employee_code_counters
to service_role;

revoke all on function public.auth_role()      from public, anon;
revoke all on function public.auth_dept_code() from public, anon;
grant execute on function public.auth_role()      to authenticated, service_role;
grant execute on function public.auth_dept_code() to authenticated, service_role;

revoke all on function public.generate_employee_code(text, int)      from public, anon, authenticated;
revoke all on function public.register_employee(text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_employee(text, text, text, text) to service_role;