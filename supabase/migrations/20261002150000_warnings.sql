-- ============================================================
-- hongthong-hr : migration ที่ 6 (ใบเตือน)
--   - ออกอัตโนมัติจากผลคำนวณเงินเดือนของงวด (มาสาย/ขาดงานเกินเกณฑ์ใน app_settings)
--   - HR/การเงินออกเองได้ (สิทธิ์ employees.manage ตามเอกสาร SA ข้อ 3)
--   - เขียนผ่าน service role จาก Server Action เท่านั้น ยกเว้น "รับทราบ" ที่พนักงานกดเองผ่าน acknowledge_warning()
-- ============================================================

create table public.warnings (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees (id) on delete cascade,
  kind            text not null check (kind in ('late', 'absent', 'manual')),
  period          text check (period is null or period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), -- งวดเงินเดือนที่เป็นเหตุ (อัตโนมัติ)
  reason          text not null check (length(btrim(reason)) > 0 and length(reason) <= 500),
  issued_by       uuid references public.employees (id), -- null = ระบบออกอัตโนมัติ
  issued_at       timestamptz not null default now(),
  acknowledged_at timestamptz,
  -- ใบเตือนอัตโนมัติประเภทเดียวกัน ออกได้ครั้งเดียวต่องวด (กดตรวจซ้ำไม่ออกซ้ำ)
  -- ใบเตือนที่ออกเอง period = null จึงไม่ติดเงื่อนไขนี้ (null ไม่นับว่าซ้ำกัน)
  unique (employee_id, period, kind),
  check (kind = 'manual' or period is not null)
);

create index warnings_employee_idx on public.warnings (employee_id, issued_at desc);

-- พนักงานกด "รับทราบ" ใบเตือนของตัวเอง
create function public.acknowledge_warning(p_warning_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.warnings
  set acknowledged_at = now()
  where id = p_warning_id
    and employee_id = public.auth_employee_id()
    and acknowledged_at is null;
  if not found then
    raise exception 'warning.not_found' using errcode = '22023';
  end if;
end;
$$;

alter table public.warnings enable row level security;

-- เห็นเหมือนข้อมูลเช็คอิน: ตัวเอง | หัวหน้าเห็นทีม | 00/01/HR เห็นทั้งหมด
create policy warnings_select on public.warnings
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
        where e.id = warnings.employee_id
          and d.team_group = left((select public.auth_dept_code()), 1)
      )
    )
  );

grant select on public.warnings to authenticated;
grant all on public.warnings to service_role;

revoke all on function public.acknowledge_warning(uuid) from public, anon;
grant execute on function public.acknowledge_warning(uuid) to authenticated;
