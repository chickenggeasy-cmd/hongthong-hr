-- ============================================================
-- hongthong-hr : migration ที่ 4 (วันหยุด + ขอ OT / อนุมัติ OT)
--   - ตาราง holidays (วันหยุดนักขัตฤกษ์ HR จัดการผ่านหน้าตั้งค่า)
--   - นับวันลาไม่รวมวันหยุดนักขัตฤกษ์ด้วย (แก้ leave_working_days)
--   - ตัวเช็กสิทธิ์อนุมัติกลาง approval_block_reason() ใช้ร่วมกันทั้งลาและ OT
--   - ตาราง ot_requests + request_ot() / decide_ot_request() แบบเดียวกับระบบลา
--   - public_settings(): เปิดค่ากติกาที่ไม่ลับให้หน้าเว็บอ่านได้ (app_settings ยังปิดทั้งตาราง)
-- ============================================================


-- ---------- 1) ค่าตั้งค่าเวลาทำงาน / ค่าจ้าง / OT ----------
insert into public.app_settings (key, value, description) values
  ('work.start_time', '09:00', 'เวลาเข้างาน (เอกสาร SA)'),
  ('work.end_time', '17:00', 'เวลาเลิกงาน OT นับหลังเวลานี้ (เอกสาร SA)'),
  ('wage.daily_rate', '550', 'ค่าจ้างรายวัน (บาท) ทุกแผนก (เอกสาร SA)'),
  ('wage.late_deduction_per_minute', '2.5', 'หักมาสายนาทีละ (บาท) นับตั้งแต่นาทีที่ 1 หลังเวลาเข้างาน (เอกสาร SA)'),
  ('ot.hourly_rate', '150', 'ค่า OT ต่อชั่วโมง (บาท) จ่ายเฉพาะชั่วโมงเต็ม (เอกสาร SA)'),
  ('ot.max_hours_per_day', '4', 'ขอ OT ได้สูงสุดกี่ชั่วโมงต่อวัน (ค่าตั้งต้นที่ตั้งเอง)')
on conflict (key) do nothing;

-- ค่ากติกาที่ไม่เป็นความลับ ให้หน้าเว็บ (authenticated) อ่านได้ เช่น โควตาลา เวลาทำงาน อัตราค่าจ้าง
-- ไม่รวมพิกัดบริษัท/ตั้งค่ารหัสพนักงาน (ยังต้องอ่านผ่าน service role เหมือนเดิม)
create function public.public_settings()
returns table (key text, value text)
language sql
stable
security definer
set search_path = public
as $$
  select s.key, s.value
  from public.app_settings s
  where s.key like 'leave.%'
     or s.key like 'ot.%'
     or s.key like 'work.%'
     or s.key like 'wage.%'
     or s.key like 'payroll.%'
     or s.key like 'social_security.%'
     or s.key like 'warning.%'
$$;


-- ---------- 2) วันหยุดนักขัตฤกษ์ ----------
create table public.holidays (
  holiday_date date primary key,
  name         text not null check (length(btrim(name)) > 0 and length(name) <= 100),
  created_at   timestamptz not null default now()
);

-- ตัวอย่างวันหยุดปี 2569-2570 (HR แก้/เพิ่มเองได้ที่หน้าตั้งค่า)
insert into public.holidays (holiday_date, name) values
  ('2026-10-13', 'วันนวมินทรมหาราช'),
  ('2026-10-23', 'วันปิยมหาราช'),
  ('2026-12-05', 'วันพ่อแห่งชาติ'),
  ('2026-12-10', 'วันรัฐธรรมนูญ'),
  ('2026-12-31', 'วันสิ้นปี'),
  ('2027-01-01', 'วันขึ้นปีใหม่')
on conflict (holiday_date) do nothing;

-- นับวันทำงาน: ไม่นับวันอาทิตย์ และไม่นับวันหยุดนักขัตฤกษ์
-- ต้องได้ผลตรงกับ countLeaveDays() ใน src/lib/leave/logic.ts เสมอ
create or replace function public.leave_working_days(p_start date, p_end date)
returns int
language sql
stable
set search_path = public
as $$
  select count(*)::int
  from generate_series(p_start, p_end, interval '1 day') as d
  where extract(isodow from d) <> 7
    and not exists (select 1 from public.holidays h where h.holiday_date = d::date)
$$;


-- ---------- 3) ตัวเช็กสิทธิ์อนุมัติกลาง (ลา + OT) ----------
-- คืน null = ผู้ใช้ที่ล็อกอินอยู่อนุมัติคำขอของพนักงานคนนี้ได้ / คืนรหัสเหตุผลถ้าไม่ได้
-- ผู้อนุมัติ = 00/01/HR (ต้องตรงกับ "approvals.view" ใน src/lib/permissions.ts)
-- อนุมัติของตัวเองไม่ได้ / คำขอของ 00, 01, HR ต้องให้ 00 อนุมัติ (เอกสาร SA ข้อ 3)
-- ต้องตรงกับ canDecideRequest() ใน src/lib/approvals/logic.ts
create function public.approval_block_reason(p_requester_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_approver_id    uuid := public.auth_employee_id();
  v_approver_role  text := public.auth_role();
  v_requester_role text;
begin
  if v_approver_id is null or v_approver_role is null
     or v_approver_role not in ('executive', 'finance', 'hr') then
    return 'approval.forbidden';
  end if;
  if p_requester_id = v_approver_id then
    return 'approval.self_approval';
  end if;

  select d.role into v_requester_role
  from public.employees e
  join public.departments d on d.code = e.dept_code
  where e.id = p_requester_id;

  if v_requester_role in ('executive', 'finance', 'hr') and v_approver_role <> 'executive' then
    return 'approval.executive_required';
  end if;
  return null;
end;
$$;

-- เขียน decide_leave_request ใหม่ให้ใช้ตัวเช็กกลาง (รหัส error เปลี่ยนเป็น approval.* ใช้ร่วมกับ OT)
create or replace function public.decide_leave_request(
  p_request_id uuid,
  p_approve    boolean,
  p_note       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note         text := nullif(btrim(p_note), '');
  v_status       text;
  v_requester_id uuid;
  v_block        text;
begin
  if public.approval_block_reason(null) = 'approval.forbidden' then
    raise exception 'approval.forbidden' using errcode = '42501';
  end if;
  if p_request_id is null or p_approve is null then
    raise exception 'approval.not_found' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'approval.note_too_long' using errcode = '22023';
  end if;

  -- for update: กันผู้อนุมัติ 2 คนกดพร้อมกันแล้วเขียนทับกัน
  select r.status, r.employee_id into v_status, v_requester_id
  from public.leave_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'approval.not_found' using errcode = '22023';
  end if;
  if v_status <> 'pending' then
    raise exception 'approval.already_decided' using errcode = '22023';
  end if;
  v_block := public.approval_block_reason(v_requester_id);
  if v_block is not null then
    raise exception '%', v_block using errcode = '42501';
  end if;

  update public.leave_requests
  set status        = case when p_approve then 'approved' else 'rejected' end,
      approver_id   = public.auth_employee_id(),
      decided_at    = now(),
      decision_note = v_note
  where id = p_request_id;
end;
$$;


-- ---------- 4) ตารางคำขอ OT ----------
create table public.ot_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,
  work_date     date not null,
  hours         int  not null check (hours between 1 and 12), -- ชั่วโมงเต็มเท่านั้น (เอกสาร SA)
  reason        text check (reason is null or length(reason) <= 500),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approver_id   uuid references public.employees (id),
  decided_at    timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((status = 'pending') = (approver_id is null and decided_at is null)),
  check ((approver_id is null) = (decided_at is null))
);

-- 1 คนมีคำขอ OT ที่ยังใช้งาน (รอ/อนุมัติ) ได้วันละ 1 รายการ
create unique index ot_requests_one_active_per_day_idx
  on public.ot_requests (employee_id, work_date)
  where status in ('pending', 'approved');
create index ot_requests_status_idx on public.ot_requests (status, created_at);

create trigger ot_requests_set_updated_at
  before update on public.ot_requests
  for each row execute function public.set_updated_at();


-- ---------- 5) ยื่นคำขอ OT ----------
-- กติกา (ต้องตรงกับ validateOtInput() ใน src/lib/ot/logic.ts):
--   - ต้องขอล่วงหน้า = ก่อนเวลาเลิกงานของวันนั้น (เอกสาร SA: ต้องขออนุมัติล่วงหน้า)
--   - เฉพาะวันทำงาน (ไม่ใช่วันอาทิตย์/วันหยุดนักขัตฤกษ์) และไม่ใช่วันที่ลาอยู่
--   - ชั่วโมงเต็ม 1 ถึง ot.max_hours_per_day
create function public.request_ot(
  p_work_date date,
  p_hours     int,
  p_reason    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid := public.auth_employee_id();
  v_reason      text := nullif(btrim(p_reason), '');
  v_max_hours   int;
  v_end_time    time;
  v_id          uuid;
begin
  if v_employee_id is null then
    raise exception 'ot.not_authenticated' using errcode = '42501';
  end if;

  select value::int  into v_max_hours from public.app_settings where key = 'ot.max_hours_per_day';
  select value::time into v_end_time  from public.app_settings where key = 'work.end_time';
  if v_max_hours is null or v_end_time is null then
    raise exception 'ot.settings_missing' using errcode = '22023';
  end if;

  if p_work_date is null then
    raise exception 'ot.invalid_date' using errcode = '22023';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > v_max_hours then
    raise exception 'ot.invalid_hours' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'ot.reason_too_long' using errcode = '22023';
  end if;
  if now() >= ((p_work_date + v_end_time) at time zone 'Asia/Bangkok') then
    raise exception 'ot.too_late' using errcode = '22023';
  end if;
  if p_work_date > (now() at time zone 'Asia/Bangkok')::date + 366 then
    raise exception 'ot.invalid_date' using errcode = '22023';
  end if;
  if public.leave_working_days(p_work_date, p_work_date) = 0 then
    raise exception 'ot.not_working_day' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('ot_requests:' || v_employee_id::text));

  if exists (
    select 1 from public.leave_requests r
    where r.employee_id = v_employee_id
      and r.status in ('pending', 'approved')
      and p_work_date between r.start_date and r.end_date
  ) then
    raise exception 'ot.on_leave' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.ot_requests o
    where o.employee_id = v_employee_id
      and o.work_date = p_work_date
      and o.status in ('pending', 'approved')
  ) then
    raise exception 'ot.duplicate' using errcode = '23505';
  end if;

  insert into public.ot_requests (employee_id, work_date, hours, reason)
  values (v_employee_id, p_work_date, p_hours, v_reason)
  returning id into v_id;
  return v_id;
end;
$$;


-- ---------- 6) อนุมัติ / ไม่อนุมัติ OT ----------
create function public.decide_ot_request(
  p_request_id uuid,
  p_approve    boolean,
  p_note       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note         text := nullif(btrim(p_note), '');
  v_status       text;
  v_requester_id uuid;
  v_block        text;
begin
  if public.approval_block_reason(null) = 'approval.forbidden' then
    raise exception 'approval.forbidden' using errcode = '42501';
  end if;
  if p_request_id is null or p_approve is null then
    raise exception 'approval.not_found' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'approval.note_too_long' using errcode = '22023';
  end if;

  select o.status, o.employee_id into v_status, v_requester_id
  from public.ot_requests o
  where o.id = p_request_id
  for update;

  if not found then
    raise exception 'approval.not_found' using errcode = '22023';
  end if;
  if v_status <> 'pending' then
    raise exception 'approval.already_decided' using errcode = '22023';
  end if;
  v_block := public.approval_block_reason(v_requester_id);
  if v_block is not null then
    raise exception '%', v_block using errcode = '42501';
  end if;

  update public.ot_requests
  set status        = case when p_approve then 'approved' else 'rejected' end,
      approver_id   = public.auth_employee_id(),
      decided_at    = now(),
      decision_note = v_note
  where id = p_request_id;
end;
$$;


-- ---------- 7) RLS ----------
alter table public.holidays    enable row level security;
alter table public.ot_requests enable row level security;

-- ทุกคนที่ล็อกอินเห็นวันหยุด (ใช้แสดงในฟอร์มลา/OT) แก้ไขผ่าน service role จากหน้าตั้งค่าเท่านั้น
create policy holidays_select on public.holidays
  for select to authenticated
  using (true);

-- เห็นเหมือน leave_requests_select: ตัวเอง | หัวหน้าเห็นทีม | 00/01/HR เห็นทั้งหมด
create policy ot_requests_select on public.ot_requests
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
        where e.id = ot_requests.employee_id
          and d.team_group = left((select public.auth_dept_code()), 1)
      )
    )
  );


-- ---------- 8) สิทธิ์ (GRANT) ----------
grant select on public.holidays, public.ot_requests to authenticated;
grant all on public.holidays, public.ot_requests to service_role;

revoke all on function public.public_settings() from public, anon;
grant execute on function public.public_settings() to authenticated, service_role;

revoke all on function public.approval_block_reason(uuid) from public, anon, authenticated;

revoke all on function public.request_ot(date, int, text) from public, anon;
grant execute on function public.request_ot(date, int, text) to authenticated;

revoke all on function public.decide_ot_request(uuid, boolean, text) from public, anon;
grant execute on function public.decide_ot_request(uuid, boolean, text) to authenticated;
