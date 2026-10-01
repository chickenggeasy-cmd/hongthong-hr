import type { ReactNode } from "react";
import { requirePermission } from "@/lib/auth/require-permission";
import type { CurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { formatThaiDate } from "@/lib/date";
import { canDecideRequest } from "@/lib/approvals/logic";
import { leaveTypeLabel } from "@/lib/leave/logic";
import { ExceedsQuotaBadge, LeaveStatusBadge } from "@/components/features/leave-status-badge";
import { DecideRequestForm } from "./decide-request-form";

// คำขอลา/OT อ้างถึง employees 2 ทาง (ผู้ขอ / ผู้อนุมัติ) จึงต้องระบุชื่อ foreign key ให้ชัด
const LEAVE_REQUESTER =
  "requester:employees!leave_requests_employee_id_fkey(id, employee_code, full_name, departments(name, role))";
const OT_REQUESTER = "requester:employees!ot_requests_employee_id_fkey(id, employee_code, full_name, departments(name, role))";

type Requester = {
  id: string;
  employee_code: string;
  full_name: string;
  departments: { name: string; role: string } | null;
} | null;

function dateRange(start: string, end: string) {
  return start === end ? formatThaiDate(start) : `${formatThaiDate(start)} – ${formatThaiDate(end)}`;
}

function PendingItem({
  approver,
  kind,
  requestId,
  requester,
  children,
}: {
  approver: CurrentEmployee;
  kind: "leave" | "ot";
  requestId: string;
  requester: Requester;
  children: ReactNode;
}) {
  const check = canDecideRequest({
    approverId: approver.id,
    approverRole: approver.role,
    requesterId: requester?.id ?? "",
    requesterRole: requester?.departments?.role ?? "",
  });
  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[1fr_14rem]">
      <div className="space-y-1">
        <p className="font-medium text-[#1A1A1A]">
          {requester?.full_name ?? "-"}{" "}
          <span className="font-normal text-[#5B6B7B]">
            {requester?.employee_code} · {requester?.departments?.name}
          </span>
        </p>
        {children}
      </div>
      {check.allowed ? (
        <DecideRequestForm kind={kind} requestId={requestId} />
      ) : (
        <p className="self-center text-[#5B6B7B]">{check.reason}</p>
      )}
    </li>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[#1A1A1A]">
        {title}
        <span className="rounded-full bg-[#E8890C]/10 px-2 py-0.5 text-sm text-[#E8890C]">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="mt-4 text-sm text-[#5B6B7B]">ไม่มีคำขอที่รออนุมัติ</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#5B6B7B]/10 text-sm">{children}</ul>
      )}
    </section>
  );
}

export default async function ApprovalsPage() {
  const employee = await requirePermission("approvals.view");

  // อ่านผ่าน client ปกติ RLS ให้ 00/01/HR เห็นคำขอทั้งหมดอยู่แล้ว
  const supabase = await createClient();
  const [{ data: pendingLeaves }, { data: pendingOts }, { data: decidedLeaves }, { data: decidedOts }] =
    await Promise.all([
      supabase
        .from("leave_requests")
        .select(`id, leave_type, start_date, end_date, days_count, reason, exceeds_quota, ${LEAVE_REQUESTER}`)
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("ot_requests")
        .select(`id, work_date, hours, reason, ${OT_REQUESTER}`)
        .eq("status", "pending")
        .order("work_date", { ascending: true }),
      supabase
        .from("leave_requests")
        .select(
          `id, leave_type, start_date, end_date, days_count, status, exceeds_quota, decision_note, decided_at, ${LEAVE_REQUESTER}, approver:employees!leave_requests_approver_id_fkey(full_name)`,
        )
        .neq("status", "pending")
        .order("decided_at", { ascending: false })
        .limit(15),
      supabase
        .from("ot_requests")
        .select(
          `id, work_date, hours, status, decision_note, decided_at, ${OT_REQUESTER}, approver:employees!ot_requests_approver_id_fkey(full_name)`,
        )
        .neq("status", "pending")
        .order("decided_at", { ascending: false })
        .limit(15),
    ]);

  // รวมประวัติการพิจารณาลา + OT เรียงจากล่าสุด
  const decided = [
    ...(decidedLeaves ?? []).map((r) => ({
      key: `leave-${r.id}`,
      decidedAt: r.decided_at ?? "",
      title: `${r.requester?.full_name ?? "-"} · ${leaveTypeLabel(r.leave_type)} · ${r.days_count} วัน`,
      detail: dateRange(r.start_date, r.end_date),
      status: r.status,
      exceedsQuota: r.exceeds_quota,
      approverName: r.approver?.full_name,
      note: r.decision_note,
    })),
    ...(decidedOts ?? []).map((r) => ({
      key: `ot-${r.id}`,
      decidedAt: r.decided_at ?? "",
      title: `${r.requester?.full_name ?? "-"} · OT · ${r.hours} ชม.`,
      detail: formatThaiDate(r.work_date),
      status: r.status,
      exceedsQuota: false,
      approverName: r.approver?.full_name,
      note: r.decision_note,
    })),
  ]
    .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#5B6B7B]">คำขอของการเงิน/HR/ผู้บริหาร ต้องให้ผู้บริหารเป็นผู้อนุมัติ</p>

      <Section title="คำขอลารออนุมัติ" count={pendingLeaves?.length ?? 0}>
        {(pendingLeaves ?? []).map((request) => (
          <PendingItem
            key={request.id}
            approver={employee}
            kind="leave"
            requestId={request.id}
            requester={request.requester}
          >
            <p className="flex flex-wrap items-center gap-1 text-[#1A1A1A]">
              {leaveTypeLabel(request.leave_type)} · {request.days_count} วัน
              {request.exceeds_quota ? <ExceedsQuotaBadge /> : null}
            </p>
            <p className="text-[#5B6B7B]">{dateRange(request.start_date, request.end_date)}</p>
            {request.reason ? <p className="text-[#5B6B7B]">เหตุผล: {request.reason}</p> : null}
          </PendingItem>
        ))}
      </Section>

      <Section title="คำขอ OT รออนุมัติ" count={pendingOts?.length ?? 0}>
        {(pendingOts ?? []).map((request) => (
          <PendingItem
            key={request.id}
            approver={employee}
            kind="ot"
            requestId={request.id}
            requester={request.requester}
          >
            <p className="text-[#1A1A1A]">OT {request.hours} ชั่วโมง</p>
            <p className="text-[#5B6B7B]">{formatThaiDate(request.work_date)}</p>
            {request.reason ? <p className="text-[#5B6B7B]">เหตุผล: {request.reason}</p> : null}
          </PendingItem>
        ))}
      </Section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-[#1A1A1A]">พิจารณาล่าสุด</h2>
        {decided.length === 0 ? (
          <p className="text-sm text-[#5B6B7B]">ยังไม่มีรายการ</p>
        ) : (
          <ul className="divide-y divide-[#5B6B7B]/10 text-sm">
            {decided.map((item) => (
              <li key={item.key} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[#1A1A1A]">{item.title}</span>
                  <span className="flex gap-1">
                    {item.exceedsQuota ? <ExceedsQuotaBadge /> : null}
                    <LeaveStatusBadge status={item.status} />
                  </span>
                </div>
                <p className="text-[#5B6B7B]">
                  {item.detail} · โดย {item.approverName ?? "-"}
                </p>
                {item.note ? <p className="text-[#5B6B7B]">หมายเหตุ: {item.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
