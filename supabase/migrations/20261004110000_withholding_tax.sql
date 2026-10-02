-- ============================================================
-- hongthong-hr : migration ที่ 11 (ภาษีหัก ณ ที่จ่าย)
--   - แบบง่าย: หักเป็นเปอร์เซ็นต์คงที่ของ (ค่าจ้าง + OT − หักมาสาย) ทุกคนเท่ากัน
--   - ค่าเริ่มต้น 0% = ยังไม่หัก (HR เปิดใช้ได้ที่หน้าตั้งค่า) งวดที่ปิดไปแล้วไม่ถูกคำนวณใหม่
--   - ภาษีตามขั้นบันไดจริง (หักค่าใช้จ่าย/ลดหย่อนรายคน) ยังไม่ทำ ต้องเก็บข้อมูลลดหย่อนของพนักงานเพิ่ม
-- ============================================================

alter table public.payslips add column withholding_tax numeric(12, 2) not null default 0;

insert into public.app_settings (key, value, description) values
  ('tax.withholding_percent', '0',
   'ภาษีหัก ณ ที่จ่าย เปอร์เซ็นต์ของ (ค่าจ้าง + OT − หักมาสาย) 0 = ไม่หัก')
on conflict (key) do nothing;

-- บันทึกงวดเงินเดือน: เหมือนเดิม + คอลัมน์ withholding_tax (ไม่ส่งมา = 0)
create or replace function public.save_payroll_run(
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
    social_security, withholding_tax, net_pay, details
  )
  select
    v_run_id, x.employee_id, x.employee_code, x.full_name, x.dept_name,
    x.working_days, x.worked_days, x.paid_holiday_days, x.leave_days, x.absent_days, x.late_days, x.late_minutes,
    x.ot_hours, x.over_quota_days, x.daily_rate, x.base_pay, x.ot_pay, x.late_deduction, x.leave_penalty,
    x.social_security, coalesce(x.withholding_tax, 0), x.net_pay, coalesce(x.details, '[]'::jsonb)
  from jsonb_to_recordset(p_payslips) as x (
    employee_id uuid, employee_code text, full_name text, dept_name text,
    working_days int, worked_days int, paid_holiday_days int, leave_days int, absent_days int,
    late_days int, late_minutes int, ot_hours int, over_quota_days int,
    daily_rate numeric, base_pay numeric, ot_pay numeric, late_deduction numeric, leave_penalty numeric,
    social_security numeric, withholding_tax numeric, net_pay numeric, details jsonb
  );

  return v_run_id;
end;
$$;
