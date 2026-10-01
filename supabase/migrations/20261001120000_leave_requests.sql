-- ============================================================
-- hongthong-hr : migration ที่ 3 (ขอลา / อนุมัติลา)
--   - ตาราง leave_requests + ค่าตั้งค่ากติกาการลาใน app_settings
--   - เขียนข้อมูลผ่าน SECURITY DEFINER function 2 ตัวเท่านั้น:
--       request_leave()        พนักงานยื่นคำขอลาของตัวเอง
--       decide_leave_request() ผู้อนุมัติ อนุมัติ/ไม่อนุมัติ
--     ไม่ใช้ service role เพราะสิทธิ์ตัดสินได้จากผู้ใช้ที่ล็อกอินอยู่ (auth.uid()) ล้วนๆ
--   - RLS select แบบเดียวกับ attendance_logs (ตัวเอง / หัวหน้าเห็นทีม / 00, 01, HR เห็นทั้งหมด)
--
-- error ที่ตั้งใจโยนจากฟังก์ชันในไฟล์นี้ ใช้ message เป็นรหัสภาษาอังกฤษ (เช่น leave.overlap)
-- ฝั่งเว็บแปลงเป็นข้อความภาษาไทยเองที่ src/lib/leave/logic.ts (leaveErrorMessage)
-- ============================================================


-- ---------- 1) ค่าตั้งค่ากติกาการลา (แก้ได้โดยไม่ต้องแก้โค้ด) ----------
insert into public.app_settings (key, value, description) values
  ('leave.monthly_quota_days', '4',
   'โควตาลารวมทุกประเภทต่อเดือน นับตามเดือนปฏิทิน (ค่าตั้งต้น ยังไม่ยืนยัน ดู README ประเด็นข้อ 7)'),
  ('leave.advance_notice_months', '1',
   'ลากิจ/ลาพักร้อนต้องขอล่วงหน้ากี่เดือน ลาป่วยไม่บังคับ (สมมติฐาน ยังไม่ยืนยัน)'),
  ('leave.sick_backdate_days', '7',
   'ลาป่วยยื่นย้อนหลังได้ไม่เกินกี่วัน (สมมติฐาน ยังไม่ยืนยัน)')
on conflict (key) do nothing;


-- ---------- 2) ตารางคำขอลา ----------
create table public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,
  leave_type    text not null check (leave_type in ('sick', 'personal', 'vacation')),
  start_date    date not null,
  end_date      date not null,
  days_count    int  not null check (days_count > 0), -- นับเฉพาะวันทำงาน (ไม่นับวันอาทิตย์)
  reason        text check (reason is null or length(reason) <= 500),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  exceeds_quota boolean not null default false,       -- ตั้งตอนยื่นคำขอ ใช้คิดหักเงินลาเกินโควตาทีหลัง
  approver_id   uuid references public.employees (id),
  decided_at    timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_date >= start_date),
  -- รอพิจารณา = ยังไม่มีผู้อนุมัติ/เวลาตัดสิน | ตัดสินแล้ว = ต้องมีทั้งคู่
  check ((status = 'pending') = (approver_id is null and decided_at is null)),
  check ((approver_id is null) = (decided_at is null))
);

create index leave_requests_employee_dates_idx on public.leave_requests (employee_id, start_date);
create index leave_requests_status_idx on public.leave_requests (status, created_at);

create trigger leave_requests_set_updated_at
  before update on public.leave_requests
  for each row execute function public.set_updated_at();


-- ---------- 3) ฟังก์ชันช่วย ----------
-- นับวันทำงานในช่วงวันที่ (รวมวันแรกและวันสุดท้าย) ไม่นับวันอาทิตย์ (ทำงาน 6 วัน/สัปดาห์ ตามเอกสาร SA)
-- ยังไม่หักวันหยุดนักขัตฤกษ์ เพราะยังไม่มีตารางวันหยุด (ทำตอนสร้างหน้าแอดมิน)
-- ต้องได้ผลตรงกับ countLeaveDays() ใน src/lib/leave/logic.ts เสมอ
create function public.leave_working_days(p_start date, p_end date)
returns int
language sql
immutable
as $$
  select count(*)::int
  from generate_series(p_start, p_end, interval '1 day') as d
  where extract(isodow from d) <> 7
$$;

-- ค่ากติกาการลาที่ฝั่งเว็บต้องใช้แสดงผล (app_settings ปิดสิทธิ์ authenticated ไว้ทั้งตาราง
-- จึงเปิดเฉพาะ 3 ค่านี้ผ่านฟังก์ชัน แทนการใช้ service role)
create function public.leave_settings()
returns table (monthly_quota_days int, advance_notice_months int, sick_backdate_days int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select value::int from public.app_settings where key = 'leave.monthly_quota_days'),
    (select value::int from public.app_settings where key = 'leave.advance_notice_months'),
    (select value::int from public.app_settings where key = 'leave.sick_backdate_days')
$$;


-- ---------- 4) ยื่นคำขอลา ----------
-- ใช้ได้เฉพาะคำขอของตัวเอง (หา id พนักงานจาก auth.uid() ไม่รับ employee_id จากภายนอก)
-- ลาเกินโควตา "ยื่นได้" แต่จะถูกตั้ง exceeds_quota = true (เอกสาร SA: ลาเกินโควตาหักเงิน ไม่ได้ห้ามลา)
-- โควตานับรวมคำขอที่ "รออนุมัติ" กับ "อนุมัติแล้ว" ไม่นับคำขอที่ถูกปฏิเสธ
create function public.request_leave(
  p_leave_type text,
  p_start_date date,
  p_end_date   date,
  p_reason     text default null
)
returns table (new_request_id uuid, total_days int, over_quota boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id   uuid := public.auth_employee_id();
  v_today         date := (now() at time zone 'Asia/Bangkok')::date;
  v_reason        text := nullif(btrim(p_reason), '');
  v_quota         int;
  v_notice_months int;
  v_sick_backdate int;
  v_days          int;
  v_exceeds       boolean := false;
  v_month         date;
  v_month_end     date;
  v_used          int;
  v_id            uuid;
begin
  if v_employee_id is null then
    raise exception 'leave.not_authenticated' using errcode = '42501';
  end if;

  if p_leave_type is null or p_leave_type not in ('sick', 'personal', 'vacation') then
    raise exception 'leave.invalid_type' using errcode = '22023';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'leave.invalid_range' using errcode = '22023';
  end if;
  -- กันช่วงวันที่ยาวผิดปกติ (กันการยิงค่าแปลกๆ ไม่ใช่กติกาธุรกิจ)
  if p_end_date - p_start_date > 366 then
    raise exception 'leave.range_too_long' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'leave.reason_too_long' using errcode = '22023';
  end if;

  select s.monthly_quota_days, s.advance_notice_months, s.sick_backdate_days
    into v_quota, v_notice_months, v_sick_backdate
  from public.leave_settings() s;
  if v_quota is null or v_notice_months is null or v_sick_backdate is null then
    raise exception 'leave.settings_missing' using errcode = '22023';
  end if;

  if p_leave_type = 'sick' then
    if p_start_date < v_today - v_sick_backdate then
      raise exception 'leave.sick_too_late' using errcode = '22023';
    end if;
  elsif p_start_date < (v_today + make_interval(months => v_notice_months))::date then
    raise exception 'leave.notice_too_short' using errcode = '22023';
  end if;

  v_days := public.leave_working_days(p_start_date, p_end_date);
  if v_days = 0 then
    raise exception 'leave.no_working_days' using errcode = '22023';
  end if;

  -- ล็อกต่อพนักงาน กันกดยื่นซ้อนกัน 2 ครั้งพร้อมกันแล้วผ่านการเช็กวันซ้ำ/โควตาทั้งคู่
  perform pg_advisory_xact_lock(hashtext('leave_requests:' || v_employee_id::text));

  if exists (
    select 1 from public.leave_requests r
    where r.employee_id = v_employee_id
      and r.status in ('pending', 'approved')
      and r.start_date <= p_end_date
      and r.end_date >= p_start_date
  ) then
    raise exception 'leave.overlap' using errcode = '23P01';
  end if;

  -- เช็กโควตาแยกทีละเดือน (คำขอที่คร่อม 2 เดือน แบ่งวันเข้าแต่ละเดือนตามจริง)
  v_month := date_trunc('month', p_start_date)::date;
  while v_month <= p_end_date loop
    v_month_end := (v_month + interval '1 month')::date - 1;

    select coalesce(sum(public.leave_working_days(greatest(r.start_date, v_month), least(r.end_date, v_month_end))), 0)
      into v_used
    from public.leave_requests r
    where r.employee_id = v_employee_id
      and r.status in ('pending', 'approved')
      and r.start_date <= v_month_end
      and r.end_date >= v_month;

    if v_used + public.leave_working_days(greatest(p_start_date, v_month), least(p_end_date, v_month_end)) > v_quota then
      v_exceeds := true;
    end if;

    v_month := (v_month + interval '1 month')::date;
  end loop;

  insert into public.leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason, exceeds_quota)
  values (v_employee_id, p_leave_type, p_start_date, p_end_date, v_days, v_reason, v_exceeds)
  returning id into v_id;

  return query select v_id, v_days, v_exceeds;
end;
$$;


-- ---------- 5) อนุมัติ / ไม่อนุมัติ ----------
-- ผู้อนุมัติ = 00 / 01 / HR (ต้องตรงกับ "approvals.view" ใน src/lib/permissions.ts)
-- กติกาเพิ่มเติมตามเอกสาร SA ข้อ 3 (ต้องตรงกับ canDecideLeave() ใน src/lib/leave/logic.ts):
--   - อนุมัติคำขอของตัวเองไม่ได้
--   - คำขอของ 01 / HR ต้องให้ผู้บริหาร (00) อนุมัติเท่านั้น
--   - คำขอของ 00 เอง ใช้กฎเดียวกัน (ต้องเป็น 00 คนอื่น) ไว้ก่อน เพราะยังไม่ได้ตัดสินใจ (README ประเด็นข้อ 4)
create function public.decide_leave_request(
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
  v_approver_id    uuid := public.auth_employee_id();
  v_approver_role  text := public.auth_role();
  v_note           text := nullif(btrim(p_note), '');
  v_status         text;
  v_requester_id   uuid;
  v_requester_role text;
begin
  if v_approver_id is null or v_approver_role is null
     or v_approver_role not in ('executive', 'finance', 'hr') then
    raise exception 'leave.forbidden' using errcode = '42501';
  end if;
  if p_request_id is null or p_approve is null then
    raise exception 'leave.not_found' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'leave.note_too_long' using errcode = '22023';
  end if;

  -- for update: กันผู้อนุมัติ 2 คนกดพร้อมกันแล้วเขียนทับกัน
  select r.status, r.employee_id, d.role
    into v_status, v_requester_id, v_requester_role
  from public.leave_requests r
  join public.employees e on e.id = r.employee_id
  join public.departments d on d.code = e.dept_code
  where r.id = p_request_id
  for update of r;

  if not found then
    raise exception 'leave.not_found' using errcode = '22023';
  end if;
  if v_status <> 'pending' then
    raise exception 'leave.already_decided' using errcode = '22023';
  end if;
  if v_requester_id = v_approver_id then
    raise exception 'leave.self_approval' using errcode = '42501';
  end if;
  if v_requester_role in ('executive', 'finance', 'hr') and v_approver_role <> 'executive' then
    raise exception 'leave.executive_required' using errcode = '42501';
  end if;

  update public.leave_requests
  set status        = case when p_approve then 'approved' else 'rejected' end,
      approver_id   = v_approver_id,
      decided_at    = now(),
      decision_note = v_note
  where id = p_request_id;
end;
$$;


-- ---------- 6) RLS ----------
alter table public.leave_requests enable row level security;

-- เห็นเหมือน attendance_logs_select: ตัวเอง | หัวหน้าเห็นทีม | 00/01/HR เห็นทั้งหมด
-- ไม่มี policy insert/update/delete = authenticated เขียนตรงไม่ได้ ต้องผ่าน 2 ฟังก์ชันข้างบนเท่านั้น
create policy leave_requests_select on public.leave_requests
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
        where e.id = leave_requests.employee_id
          and d.team_group = left((select public.auth_dept_code()), 1)
      )
    )
  );


-- ---------- 7) สิทธิ์ (GRANT) ----------
grant select on public.leave_requests to authenticated;
grant all on public.leave_requests to service_role;

revoke all on function public.leave_working_days(date, date) from public, anon;
grant execute on function public.leave_working_days(date, date) to authenticated, service_role;

revoke all on function public.leave_settings() from public, anon;
grant execute on function public.leave_settings() to authenticated, service_role;

revoke all on function public.request_leave(text, date, date, text) from public, anon;
grant execute on function public.request_leave(text, date, date, text) to authenticated;

revoke all on function public.decide_leave_request(uuid, boolean, text) from public, anon;
grant execute on function public.decide_leave_request(uuid, boolean, text) to authenticated;
