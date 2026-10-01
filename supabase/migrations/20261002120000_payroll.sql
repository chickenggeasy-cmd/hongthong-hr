-- ============================================================
-- hongthong-hr : migration ที่ 5 (เงินเดือน + สลิป)
--   - payroll_runs: งวดเงินเดือน 1 แถวต่อ 1 รอบ (draft = คำนวณใหม่ได้, finalized = ปิดงวดแล้ว แก้ไม่ได้)
--   - payslips: ผลคำนวณรายคน เก็บสำเนาชื่อ/แผนก ณ ตอนคำนวณ (ชื่อเปลี่ยนทีหลัง สลิปเก่าไม่เปลี่ยนตาม)
--   - คำนวณใน TypeScript (src/lib/payroll/logic.ts มีเทสต์) แล้วบันทึกผ่าน save_payroll_run()
--     ซึ่งเรียกได้จาก service role เท่านั้น (Server Action ตรวจสิทธิ์ payroll.manage ก่อนเรียก)
--     ใช้ฟังก์ชันเดียวบันทึกทั้งงวด เพื่อให้ลบของเก่า + ใส่ของใหม่อยู่ในทรานแซกชันเดียวกัน
-- ============================================================


-- ---------- 1) ค่าตั้งค่า (ค่าตั้งต้น ตัดสินใจเองแทนลูกค้า ดู README "ประเด็นที่ต้องตัดสินใจเอง") ----------
insert into public.app_settings (key, value, description) values
  ('leave.over_quota_deduction', '250', 'หักเงินต่อ "วัน" ที่ลาเกินโควตาของเดือน (README ประเด็นข้อ 1)'),
  ('payroll.cutoff_day', '25', 'วันตัดรอบเงินเดือน: นับวันถัดจากวันตัดรอบของเดือนก่อน ถึงวันตัดรอบของเดือนนี้ (เอกสาร SA)'),
  ('social_security.rate_percent', '5', 'เงินสมทบประกันสังคมฝั่งลูกจ้าง (%) (README ประเด็นข้อ 3)'),
  ('social_security.max_amount', '750', 'เงินสมทบประกันสังคมสูงสุดต่อเดือน (บาท) ตรวจสอบเพดานปัจจุบันก่อนใช้จริง'),
  ('warning.late_count_threshold', '3', 'ออกใบเตือนอัตโนมัติเมื่อมาสายกี่ครั้งต่อรอบเงินเดือน'),
  ('warning.absent_days_threshold', '1', 'ออกใบเตือนอัตโนมัติเมื่อขาดงานกี่วันต่อรอบเงินเดือน')
on conflict (key) do nothing;


-- ---------- 2) งวดเงินเดือน ----------
create table public.payroll_runs (
  id           uuid primary key default gen_random_uuid(),
  period       text not null unique check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), -- เดือนที่จ่าย เช่น 2026-10
  cycle_start  date not null,
  cycle_end    date not null,
  status       text not null default 'draft' check (status in ('draft', 'finalized')),
  created_by   uuid references public.employees (id),
  finalized_by uuid references public.employees (id),
  finalized_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (cycle_end >= cycle_start),
  check ((status = 'finalized') = (finalized_at is not null))
);

create trigger payroll_runs_set_updated_at
  before update on public.payroll_runs
  for each row execute function public.set_updated_at();


-- ---------- 3) สลิปรายคน ----------
-- เงินทุกช่องเป็นบาท ทศนิยม 2 ตำแหน่ง
create table public.payslips (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.payroll_runs (id) on delete cascade,
  employee_id       uuid not null references public.employees (id) on delete cascade,
  employee_code     text not null,
  full_name         text not null,
  dept_name         text not null,
  working_days      int not null default 0, -- วันทำงานในรอบ (ไม่รวมอาทิตย์/วันหยุด) ที่นับแล้ว
  worked_days       int not null default 0, -- วันที่มาทำงานจริง (มีเช็คอิน)
  paid_holiday_days int not null default 0, -- วันหยุดนักขัตฤกษ์ที่ได้ค่าจ้าง
  leave_days        int not null default 0, -- วันลาที่อนุมัติแล้ว (ไม่ได้ค่าจ้าง)
  absent_days       int not null default 0, -- ขาดงาน (ไม่มีเช็คอินและไม่ได้ลา)
  late_days         int not null default 0,
  late_minutes      int not null default 0,
  ot_hours          int not null default 0,
  over_quota_days   int not null default 0,
  daily_rate        numeric(12, 2) not null,
  base_pay          numeric(12, 2) not null default 0,
  ot_pay            numeric(12, 2) not null default 0,
  late_deduction    numeric(12, 2) not null default 0,
  leave_penalty     numeric(12, 2) not null default 0,
  social_security   numeric(12, 2) not null default 0,
  net_pay           numeric(12, 2) not null default 0,
  details           jsonb not null default '[]'::jsonb, -- รายวัน: [{date, status, lateMinutes, otHours, ...}]
  created_at        timestamptz not null default now(),
  unique (run_id, employee_id)
);

create index payslips_employee_idx on public.payslips (employee_id);


-- ---------- 4) บันทึกผลคำนวณทั้งงวด (service role เท่านั้น) ----------
create function public.save_payroll_run(
  p_period      text,
  p_cycle_start date,
  p_cycle_end   date,
  p_created_by  uuid,
  p_payslips    jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_status text;
begin
  select id, status into v_run_id, v_status from public.payroll_runs where period = p_period for update;

  if v_run_id is null then
    insert into public.payroll_runs (period, cycle_start, cycle_end, created_by)
    values (p_period, p_cycle_start, p_cycle_end, p_created_by)
    returning id into v_run_id;
  elsif v_status = 'finalized' then
    raise exception 'payroll.finalized' using errcode = '22023';
  else
    update public.payroll_runs
    set cycle_start = p_cycle_start, cycle_end = p_cycle_end, created_by = p_created_by
    where id = v_run_id;
    delete from public.payslips where run_id = v_run_id;
  end if;

  insert into public.payslips (
    run_id, employee_id, employee_code, full_name, dept_name,
    working_days, worked_days, paid_holiday_days, leave_days, absent_days, late_days, late_minutes,
    ot_hours, over_quota_days, daily_rate, base_pay, ot_pay, late_deduction, leave_penalty,
    social_security, net_pay, details
  )
  select
    v_run_id, x.employee_id, x.employee_code, x.full_name, x.dept_name,
    x.working_days, x.worked_days, x.paid_holiday_days, x.leave_days, x.absent_days, x.late_days, x.late_minutes,
    x.ot_hours, x.over_quota_days, x.daily_rate, x.base_pay, x.ot_pay, x.late_deduction, x.leave_penalty,
    x.social_security, x.net_pay, coalesce(x.details, '[]'::jsonb)
  from jsonb_to_recordset(p_payslips) as x (
    employee_id uuid, employee_code text, full_name text, dept_name text,
    working_days int, worked_days int, paid_holiday_days int, leave_days int, absent_days int,
    late_days int, late_minutes int, ot_hours int, over_quota_days int,
    daily_rate numeric, base_pay numeric, ot_pay numeric, late_deduction numeric, leave_penalty numeric,
    social_security numeric, net_pay numeric, details jsonb
  );

  return v_run_id;
end;
$$;

-- ปิดงวด: หลังปิดแล้วคำนวณใหม่ไม่ได้ และพนักงานเริ่มเห็นสลิปของตัวเอง
create function public.finalize_payroll_run(p_run_id uuid, p_finalized_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payroll_runs
  set status = 'finalized', finalized_at = now(), finalized_by = p_finalized_by
  where id = p_run_id and status = 'draft';
  if not found then
    raise exception 'payroll.not_draft' using errcode = '22023';
  end if;
end;
$$;


-- ---------- 5) RLS ----------
alter table public.payroll_runs enable row level security;
alter table public.payslips     enable row level security;

-- 00/01/HR เห็นทุกงวด | พนักงานเห็นเฉพาะงวดที่ปิดแล้ว (ใช้แสดงช่วงวันที่ในสลิปของตัวเอง)
create policy payroll_runs_select on public.payroll_runs
  for select to authenticated
  using (
    status = 'finalized'
    or (select public.auth_role()) in ('executive', 'finance', 'hr')
  );

-- พนักงานเห็นสลิปของตัวเองเฉพาะงวดที่ปิดแล้ว (งวดร่างอาจยังคำนวณใหม่) | 00/01/HR เห็นทั้งหมด
-- หัวหน้าแผนกไม่เห็นเงินเดือนลูกทีม (เงินเดือนเป็นข้อมูลส่วนตัว)
create policy payslips_select on public.payslips
  for select to authenticated
  using (
    (select public.auth_role()) in ('executive', 'finance', 'hr')
    or (
      employee_id = (select public.auth_employee_id())
      and exists (
        select 1 from public.payroll_runs r
        where r.id = payslips.run_id and r.status = 'finalized'
      )
    )
  );


-- ---------- 6) สิทธิ์ (GRANT) ----------
grant select on public.payroll_runs, public.payslips to authenticated;
grant all on public.payroll_runs, public.payslips to service_role;

revoke all on function public.save_payroll_run(text, date, date, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_payroll_run(text, date, date, uuid, jsonb) to service_role;

revoke all on function public.finalize_payroll_run(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_payroll_run(uuid, uuid) to service_role;
