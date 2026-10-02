-- ============================================================
-- hongthong-hr : migration ที่ 10 (ยกเลิกคำขอลา/OT ของตัวเอง)
--   - เพิ่มสถานะ 'cancelled' ยกเลิกได้เฉพาะคำขอของตัวเองที่ยัง "รออนุมัติ"
--   - คำขอที่ยกเลิกไม่นับโควตา/ไม่ชนวันซ้ำ/ไม่คิดเงินเดือน (ทุกจุดนับเฉพาะ pending + approved อยู่แล้ว)
--   - เขียนผ่าน SECURITY DEFINER function รู้ตัวผู้ใช้จาก auth.uid() จึงยกเลิกของคนอื่นไม่ได้
-- ============================================================

alter table public.leave_requests drop constraint leave_requests_status_check;
alter table public.leave_requests
  add constraint leave_requests_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled'));

alter table public.ot_requests drop constraint ot_requests_status_check;
alter table public.ot_requests
  add constraint ot_requests_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled'));

-- ยกเลิก = ผู้ยื่นปิดคำขอเอง: approver_id = ตัวผู้ยื่น, decided_at = เวลาที่ยกเลิก
-- (ตารางบังคับว่าคำขอที่ไม่ใช่ pending ต้องมีทั้งผู้ตัดสินและเวลาตัดสิน)
create function public.cancel_leave_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leave_requests
  set status = 'cancelled', approver_id = public.auth_employee_id(), decided_at = now()
  where id = p_request_id
    and employee_id = public.auth_employee_id()
    and status = 'pending';
  -- ไม่พบ/ไม่ใช่ของตัวเอง/ถูกพิจารณาไปแล้ว ใช้รหัสเดียวกัน ไม่บอกว่าคำขอของคนอื่นมีอยู่จริงหรือไม่
  if not found then
    raise exception 'request.not_cancellable' using errcode = '22023';
  end if;
end;
$$;

create function public.cancel_ot_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ot_requests
  set status = 'cancelled', approver_id = public.auth_employee_id(), decided_at = now()
  where id = p_request_id
    and employee_id = public.auth_employee_id()
    and status = 'pending';
  if not found then
    raise exception 'request.not_cancellable' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.cancel_leave_request(uuid) from public, anon;
revoke all on function public.cancel_ot_request(uuid) from public, anon;
grant execute on function public.cancel_leave_request(uuid) to authenticated;
grant execute on function public.cancel_ot_request(uuid) to authenticated;
