-- ============================================================
-- hongthong-hr : migration ที่ 12 (บันทึกประวัติการแก้ไข / audit log)
--   - เก็บว่า "ใคร ทำอะไร กับอะไร เมื่อไหร่" สำหรับงานสำคัญ: ตั้งค่า, วันหยุด, พนักงาน, เงินเดือน, ใบเตือน
--   - เขียนผ่าน service role จาก Server Action เท่านั้น (หลังตรวจสิทธิ์แล้ว) แก้/ลบย้อนหลังไม่ได้จากหน้าเว็บ
--   - อ่านได้เฉพาะ HR และผู้บริหาร
--   (การอนุมัติลา/OT มีผู้อนุมัติ + เวลาบันทึกในตารางคำขออยู่แล้ว ไม่ต้องเก็บซ้ำ)
-- ============================================================

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.employees (id) on delete set null,
  action      text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target      text check (target is null or length(target) <= 200),
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using ((select public.auth_role()) in ('hr', 'executive'));

grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
