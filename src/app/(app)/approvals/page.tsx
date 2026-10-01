import { requirePermission } from "@/lib/auth/require-permission";
import { createClient } from "@/lib/supabase/server";
import { formatThaiDate } from "@/lib/date";
import { canDecideLeave, leaveTypeLabel } from "@/lib/leave/logic";
import { ExceedsQuotaBadge, LeaveStatusBadge } from "@/components/features/leave-status-badge";
import { DecideLeaveForm } from "./decide-leave-form";

// leave_requests อ้างถึง employees 2 ทาง (ผู้ขอ / ผู้อนุมัติ) จึงต้องระบุชื่อ foreign key ให้ชัด
const REQUESTER = "requester:employees!leave_requests_employee_id_fkey(id, employee_code, full_name, departments(name, role))";

function dateRange(start: string, end: string) {
  return start === end ? formatThaiDate(start) : `${formatThaiDate(start)} – ${formatThaiDate(end)}`;
}

export default async function ApprovalsPage() {
  const employee = await requirePermission("approvals.view");

  // อ่านผ่าน client ปกติ RLS ให้ 00/01/HR เห็นคำขอทั้งหมดอยู่แล้ว
  const supabase = await createClient();
  const [{ data: pending }, { data: decided }] = await Promise.all([
    supabase
      .from("leave_requests")
      .select(`id, leave_type, start_date, end_date, days_count, reason, exceeds_quota, created_at, ${REQUESTER}`)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("leave_requests")
      .select(
        `id, leave_type, start_date, end_date, days_count, status, exceeds_quota, decision_note, ${REQUESTER}, approver:employees!leave_requests_approver_id_fkey(full_name)`,
      )
      .neq("status", "pending")
      .order("decided_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-[#1A1A1A]">คำขอลารออนุมัติ</h1>
        <p className="mt-1 text-sm text-[#5B6B7B]">คำขอของการเงิน/HR/ผู้บริหาร ต้องให้ผู้บริหารเป็นผู้อนุมัติ</p>

        {!pending || pending.length === 0 ? (
          <p className="mt-4 text-sm text-[#5B6B7B]">ไม่มีคำขอที่รออนุมัติ</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#5B6B7B]/10 text-sm">
            {pending.map((request) => {
              const requester = request.requester;
              const check = canDecideLeave({
                approverId: employee.id,
                approverRole: employee.role,
                requesterId: requester?.id ?? "",
                requesterRole: requester?.departments?.role ?? "",
              });
              return (
                <li key={request.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_14rem]">
                  <div className="space-y-1">
                    <p className="font-medium text-[#1A1A1A]">
                      {requester?.full_name ?? "-"}{" "}
                      <span className="font-normal text-[#5B6B7B]">
                        {requester?.employee_code} · {requester?.departments?.name}
                      </span>
                    </p>
                    <p className="flex flex-wrap items-center gap-1 text-[#1A1A1A]">
                      {leaveTypeLabel(request.leave_type)} · {request.days_count} วัน
                      {request.exceeds_quota ? <ExceedsQuotaBadge /> : null}
                    </p>
                    <p className="text-[#5B6B7B]">{dateRange(request.start_date, request.end_date)}</p>
                    {request.reason ? <p className="text-[#5B6B7B]">เหตุผล: {request.reason}</p> : null}
                  </div>
                  {check.allowed ? (
                    <DecideLeaveForm requestId={request.id} />
                  ) : (
                    <p className="self-center text-[#5B6B7B]">{check.reason}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-[#1A1A1A]">พิจารณาล่าสุด</h2>
        {!decided || decided.length === 0 ? (
          <p className="text-sm text-[#5B6B7B]">ยังไม่มีรายการ</p>
        ) : (
          <ul className="divide-y divide-[#5B6B7B]/10 text-sm">
            {decided.map((request) => (
              <li key={request.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[#1A1A1A]">
                    {request.requester?.full_name ?? "-"} · {leaveTypeLabel(request.leave_type)} ·{" "}
                    {request.days_count} วัน
                  </span>
                  <span className="flex gap-1">
                    {request.exceeds_quota ? <ExceedsQuotaBadge /> : null}
                    <LeaveStatusBadge status={request.status} />
                  </span>
                </div>
                <p className="text-[#5B6B7B]">
                  {dateRange(request.start_date, request.end_date)} · โดย {request.approver?.full_name ?? "-"}
                </p>
                {request.decision_note ? <p className="text-[#5B6B7B]">หมายเหตุ: {request.decision_note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-sm text-[#5B6B7B]">การอนุมัติ OT จะเพิ่มในหน้านี้ภายหลัง</p>
    </div>
  );
}
