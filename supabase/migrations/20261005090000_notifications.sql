-- ============================================================
-- hongthong-hr : migration ที่ 14 (แจ้งเตือนแบบเวลาจริง + แจ้งเตือนบนมือถือ)
--   - ตาราง notifications: กล่องแจ้งเตือนของแต่ละคน สร้างโดย trigger ในฐานข้อมูลเท่านั้น
--     (คำขอใหม่ → ผู้อนุมัติ, ลูกทีมขอลา → หัวหน้า, ผลอนุมัติ → ผู้ยื่น, ใบเตือน → พนักงาน, ปิดงวด → ทุกคนที่มีสลิป)
--   - หน้าเว็บฟังการเปลี่ยนแปลงผ่าน Supabase Realtime (เห็นเฉพาะของตัวเองตาม RLS)
--   - ตาราง push_subscriptions: เครื่องที่เปิดรับแจ้งเตือนตอนปิดเว็บ (Web Push) เซิร์ฟเวอร์เป็นผู้ส่ง
-- ============================================================

-- ---------- 1) ตาราง ----------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.employees (id) on delete cascade,
  kind         text not null check (kind ~ '^[a-z_]+\.[a-z_]+$'),  -- เช่น leave.new, ot.approved
  title        text not null check (length(btrim(title)) > 0 and length(title) <= 120),
  body         text not null default '' check (length(body) <= 300),
  link         text not null default '/' check (link ~ '^/[a-z0-9/_-]*$'), -- ลิงก์ภายในเว็บเท่านั้น
  ref_id       uuid,          -- id ของคำขอ/ใบเตือน/งวด ที่เป็นต้นเรื่อง
  read_at      timestamptz,
  pushed_at    timestamptz,   -- เซิร์ฟเวอร์หยิบไปส่ง Web Push แล้ว (กันส่งซ้ำ)
  created_at   timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_ref_unread_idx on public.notifications (ref_id) where read_at is null;
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;
create index notifications_created_idx on public.notifications (created_at);

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh      text not null check (length(p256dh) between 1 and 200),
  auth        text not null check (length(auth) between 1 and 100),
  user_agent  text check (user_agent is null or length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);

create index push_subscriptions_employee_idx on public.push_subscriptions (employee_id);


-- ---------- 2) ตัวช่วยสร้างข้อความ ----------
-- วันที่สั้นแบบไทย เช่น "5 ต.ค." (ข้อความแจ้งเตือนต้องสั้น อ่านบนมือถือได้)
create function public.thai_short_date(p_date date)
returns text
language sql
immutable
set search_path = public
as $$
  select extract(day from p_date)::int || ' '
    || (array['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'])[extract(month from p_date)::int]
$$;

create function public.thai_date_range(p_start date, p_end date)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_start = p_end then public.thai_short_date(p_start)
              else public.thai_short_date(p_start) || ' – ' || public.thai_short_date(p_end) end
$$;

-- งวด "2026-10" → "ตุลาคม 2569"
create function public.thai_period_label(p_period text)
returns text
language sql
immutable
set search_path = public
as $$
  select (array['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'])[split_part(p_period, '-', 2)::int]
    || ' ' || (split_part(p_period, '-', 1)::int + 543)
$$;

create function public.leave_type_label(p_type text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_type when 'sick' then 'ลาป่วย' when 'personal' then 'ลากิจ' when 'vacation' then 'ลาพักร้อน' else 'ลา' end
$$;

-- ตัดข้อความยาวให้พอดีแจ้งเตือน
create function public.clip_text(p_text text, p_max int)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_text is null then '' when length(p_text) <= p_max then p_text
              else left(p_text, p_max - 1) || '…' end
$$;

-- ผู้ที่อนุมัติคำขอของพนักงานคนนี้ได้ (พนักงานที่ยังทำงานอยู่และมีบัญชี)
-- ต้องตรงกับ approval_block_reason() และ canDecideRequest() ใน src/lib/approvals/logic.ts:
-- 00/01/HR อนุมัติได้, อนุมัติของตัวเองไม่ได้, คำขอของ 00/01/HR ต้องให้ 00 อนุมัติ
create function public.request_approver_ids(p_requester_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with requester as (
    select d.role
    from public.employees e
    join public.departments d on d.code = e.dept_code
    where e.id = p_requester_id
  )
  select e.id
  from public.employees e
  join public.departments d on d.code = e.dept_code
  where e.status = 'active'
    and e.auth_user_id is not null
    and e.id <> p_requester_id
    and d.role in ('executive', 'finance', 'hr')
    and (d.role = 'executive' or (select role from requester) not in ('executive', 'finance', 'hr'))
$$;

-- หัวหน้าแผนกของทีมเดียวกัน (30 เห็น 31, 40 เห็น 41 ...) ตรงกับสิทธิ์อ่านการลาของลูกทีมใน RLS
create function public.team_head_ids(p_employee_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select h.id
  from public.employees x
  join public.departments xd on xd.code = x.dept_code
  join public.employees h on h.status = 'active' and h.auth_user_id is not null and h.id <> x.id
  join public.departments hd on hd.code = h.dept_code and hd.role = 'head' and hd.team_group = xd.team_group
  where x.id = p_employee_id
$$;

-- ปิดแจ้งเตือน "มีคำขอใหม่" ของทุกผู้อนุมัติเมื่อคำขอนั้นถูกพิจารณา/ยกเลิกไปแล้ว (ไม่ต้องทำอะไรต่อ ตัวเลขบนกระดิ่งจะได้ไม่ค้าง)
create function public.close_request_notifications(p_ref_id uuid, p_kind text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set read_at = now()
  where ref_id = p_ref_id and kind = p_kind and read_at is null
$$;


-- ---------- 3) trigger: คำขอลา ----------
create function public.notify_leave_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name   text;
  v_detail text;
begin
  select full_name into v_name from public.employees where id = new.employee_id;
  v_detail := public.leave_type_label(new.leave_type) || ' ' || new.days_count || ' วัน · '
    || public.thai_date_range(new.start_date, new.end_date);

  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (recipient_id, kind, title, body, link, ref_id)
    select a, 'leave.new', 'คำขอลาใหม่',
           public.clip_text(v_name || ' ขอ' || v_detail || case when new.exceeds_quota then ' · เกินโควตา' else '' end, 300),
           '/approvals', new.id
    from public.request_approver_ids(new.employee_id) as a;

    -- หัวหน้าทีมได้รู้ด้วย (ดูอย่างเดียว) ยกเว้นคนที่เป็นผู้อนุมัติอยู่แล้ว
    insert into public.notifications (recipient_id, kind, title, body, link, ref_id)
    select h, 'leave.team', 'ลูกทีมขอลา', public.clip_text(v_name || ' ขอ' || v_detail, 300), '/leave', new.id
    from public.team_head_ids(new.employee_id) as h
    where h not in (select public.request_approver_ids(new.employee_id));

  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    perform public.close_request_notifications(new.id, 'leave.new');

    if new.status in ('approved', 'rejected') then
      insert into public.notifications (recipient_id, kind, title, body, link, ref_id)
      values (
        new.employee_id,
        'leave.' || new.status,
        case new.status when 'approved' then 'อนุมัติคำขอลาแล้ว' else 'คำขอลาไม่ได้รับอนุมัติ' end,
        public.clip_text(
          v_detail
          || coalesce(' · โดย ' || (select full_name from public.employees where id = new.approver_id), '')
          || coalesce(' · ' || nullif(btrim(new.decision_note), ''), ''),
          300),
        '/leave',
        new.id
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger leave_requests_notify
  after insert or update of status on public.leave_requests
  for each row execute function public.notify_leave_request();


-- ---------- 4) trigger: คำขอ OT ----------
create function public.notify_ot_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name   text;
  v_detail text;
begin
  select full_name into v_name from public.employees where id = new.employee_id;
  v_detail := 'OT ' || new.hours || ' ชม. · ' || public.thai_short_date(new.work_date);

  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (recipient_id, kind, title, body, link, ref_id)
    select a, 'ot.new', 'คำขอ OT ใหม่', public.clip_text(v_name || ' ขอ ' || v_detail, 300), '/approvals', new.id
    from public.request_approver_ids(new.employee_id) as a;

  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    perform public.close_request_notifications(new.id, 'ot.new');

    if new.status in ('approved', 'rejected') then
      insert into public.notifications (recipient_id, kind, title, body, link, ref_id)
      values (
        new.employee_id,
        'ot.' || new.status,
        case new.status when 'approved' then 'อนุมัติคำขอ OT แล้ว' else 'คำขอ OT ไม่ได้รับอนุมัติ' end,
        public.clip_text(
          v_detail
          || coalesce(' · โดย ' || (select full_name from public.employees where id = new.approver_id), '')
          || coalesce(' · ' || nullif(btrim(new.decision_note), ''), ''),
          300),
        '/ot',
        new.id
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger ot_requests_notify
  after insert or update of status on public.ot_requests
  for each row execute function public.notify_ot_request();


-- ---------- 5) trigger: ใบเตือน ----------
create function public.notify_warning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, kind, title, body, link, ref_id)
  values (new.employee_id, 'warning.issued', 'คุณได้รับใบเตือน', public.clip_text(new.reason, 200), '/warnings', new.id);
  return null;
end;
$$;

create trigger warnings_notify
  after insert on public.warnings
  for each row execute function public.notify_warning();


-- ---------- 6) trigger: ปิดงวดเงินเดือน → สลิปออก ----------
create function public.notify_payroll_finalized()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'draft' and new.status = 'finalized' then
    insert into public.notifications (recipient_id, kind, title, body, link, ref_id)
    select p.employee_id, 'payslip.ready', 'สลิปเงินเดือนออกแล้ว',
           'งวด ' || public.thai_period_label(new.period) || ' เปิดดูและดาวน์โหลดได้แล้ว', '/payslip', new.id
    from public.payslips p
    join public.employees e on e.id = p.employee_id and e.auth_user_id is not null
    where p.run_id = new.id;
  end if;
  return null;
end;
$$;

create trigger payroll_runs_notify
  after update of status on public.payroll_runs
  for each row execute function public.notify_payroll_finalized();


-- ---------- 7) ฟังก์ชันที่ผู้ใช้เรียก (ผ่าน Server Action) ----------
-- อ่านแล้ว: ระบุ id = อ่านรายการเดียว / null = อ่านทั้งหมด (เฉพาะของตัวเอง)
create function public.mark_notifications_read(p_notification_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where recipient_id = public.auth_employee_id()
    and read_at is null
    and (p_notification_id is null or id = p_notification_id);
end;
$$;

-- ส่งแจ้งเตือนทดสอบให้ตัวเอง (ปุ่ม "ลองส่งแจ้งเตือน") กดถี่ไม่ได้: 1 ครั้ง / 10 วินาที
create function public.send_test_notification()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.auth_employee_id();
begin
  if v_me is null then
    raise exception 'notification.forbidden' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.notifications
    where recipient_id = v_me and kind = 'system.test' and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'notification.too_fast' using errcode = '22023';
  end if;
  insert into public.notifications (recipient_id, kind, title, body, link)
  values (v_me, 'system.test', 'ทดสอบการแจ้งเตือน', 'ถ้าเห็นข้อความนี้ แปลว่าเครื่องนี้รับแจ้งเตือนได้แล้ว', '/');
end;
$$;

-- เครื่องนี้เปิดรับแจ้งเตือนตอนปิดเว็บ: ผูก endpoint กับผู้ใช้ที่ล็อกอินอยู่ (ถ้าเครื่องนี้เคยผูกกับคนอื่น ย้ายมาเป็นของคนนี้)
-- เก็บไม่เกิน 10 เครื่องต่อคน (เครื่องเก่าสุดถูกลบ)
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.auth_employee_id();
begin
  if v_me is null then
    raise exception 'notification.forbidden' using errcode = '42501';
  end if;

  insert into public.push_subscriptions (employee_id, endpoint, p256dh, auth, user_agent)
  values (v_me, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set employee_id = excluded.employee_id,
        p256dh      = excluded.p256dh,
        auth        = excluded.auth,
        user_agent  = excluded.user_agent,
        created_at  = now();

  delete from public.push_subscriptions
  where employee_id = v_me
    and id not in (
      select id from public.push_subscriptions where employee_id = v_me order by created_at desc limit 10
    );
end;
$$;

create function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions
  where endpoint = p_endpoint and employee_id = public.auth_employee_id()
$$;


-- ---------- 8) RLS + สิทธิ์ ----------
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_id = (select public.auth_employee_id()));

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (employee_id = (select public.auth_employee_id()));

grant select on public.notifications, public.push_subscriptions to authenticated;
grant all on public.notifications, public.push_subscriptions to service_role;

-- ฟังก์ชันภายใน (trigger/ตัวช่วย) เรียกจากภายนอกไม่ได้
revoke all on function public.request_approver_ids(uuid) from public, anon, authenticated;
revoke all on function public.team_head_ids(uuid) from public, anon, authenticated;
revoke all on function public.close_request_notifications(uuid, text) from public, anon, authenticated;
revoke all on function public.notify_leave_request() from public, anon, authenticated;
revoke all on function public.notify_ot_request() from public, anon, authenticated;
revoke all on function public.notify_warning() from public, anon, authenticated;
revoke all on function public.notify_payroll_finalized() from public, anon, authenticated;

revoke all on function public.mark_notifications_read(uuid) from public, anon;
revoke all on function public.send_test_notification() from public, anon;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.mark_notifications_read(uuid) to authenticated;
grant execute on function public.send_test_notification() to authenticated;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;


-- ---------- 9) เปิด Realtime ให้ตาราง notifications ----------
-- (Supabase มี publication ชื่อนี้อยู่แล้ว ฐานข้อมูลทดสอบในเครื่องไม่มี จึงเช็กก่อน)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
