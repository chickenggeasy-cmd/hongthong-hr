-- ============================================================
-- hongthong-hr : migration ที่ 8 (แก้ไขข้อมูลพนักงาน / ลาออก / กลับเข้าทำงาน)
--   - เพิ่ม resigned_on (วันทำงานวันสุดท้าย) ใช้คิดเงินเดือนคนที่ลาออกกลางงวด
--   - เขียนผ่าน SECURITY DEFINER function 2 ตัว ผู้ใช้ต้องมีบทบาท 01/HR
--     (ตรงกับ "employees.manage" ใน src/lib/permissions.ts) ไม่ใช้ service role
--   - รหัสพนักงานไม่เปลี่ยนแม้ย้ายแผนก เพราะใช้เป็นชื่อผู้ใช้ล็อกอิน
--     (2 หลักกลางของรหัสจึงบอกแผนก "ตอนเริ่มงาน" ส่วนแผนกปัจจุบันดูที่ dept_code)
--   - คนที่ลาออกแล้วล็อกอินไม่ได้ผล: getCurrentEmployee()/RLS ดูเฉพาะ status = 'active'
-- ============================================================

alter table public.employees add column resigned_on date;
-- คนที่ลาออกไปก่อนหน้านี้ (ถ้ามี) ใช้วันที่แก้ไขล่าสุดเป็นวันสุดท้ายไปก่อน
update public.employees set resigned_on = (updated_at at time zone 'Asia/Bangkok')::date where status = 'resigned';
alter table public.employees add constraint employees_resigned_on_check
  check ((status = 'resigned') = (resigned_on is not null));

-- ผู้ใช้ที่ล็อกอินอยู่จัดการข้อมูลพนักงานได้ไหม (01/HR) — ใช้ภายในฟังก์ชันในไฟล์นี้
create function public.can_manage_employees()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role() in ('finance', 'hr'), false)
$$;

-- แก้ชื่อ / ย้ายแผนก
create function public.update_employee(p_employee_id uuid, p_full_name text, p_dept_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_full_name);
begin
  if not public.can_manage_employees() then
    raise exception 'employee.forbidden' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) < 2 or length(v_name) > 200 then
    raise exception 'employee.invalid_name' using errcode = '22023';
  end if;
  perform 1 from public.departments where code = p_dept_code and is_active;
  if not found then
    raise exception 'employee.invalid_dept' using errcode = '22023';
  end if;

  update public.employees
  set full_name = v_name, dept_code = p_dept_code
  where id = p_employee_id;
  if not found then
    raise exception 'employee.not_found' using errcode = '22023';
  end if;
end;
$$;

-- บันทึกลาออก (ต้องระบุวันทำงานวันสุดท้าย) หรือกลับเข้าทำงาน (p_resigned_on = null)
create function public.set_employee_status(p_employee_id uuid, p_resigned_on date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_employees() then
    raise exception 'employee.forbidden' using errcode = '42501';
  end if;
  -- กันกดลาออกให้ตัวเองแล้วเข้าระบบไม่ได้ (ต้องให้ 01/HR อีกคนทำ)
  if p_employee_id = public.auth_employee_id() then
    raise exception 'employee.self' using errcode = '42501';
  end if;

  update public.employees
  set status      = case when p_resigned_on is null then 'active' else 'resigned' end,
      resigned_on = p_resigned_on
  where id = p_employee_id;
  if not found then
    raise exception 'employee.not_found' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.can_manage_employees() from public, anon, authenticated;

revoke all on function public.update_employee(uuid, text, text) from public, anon;
grant execute on function public.update_employee(uuid, text, text) to authenticated;

revoke all on function public.set_employee_status(uuid, date) from public, anon;
grant execute on function public.set_employee_status(uuid, date) to authenticated;
