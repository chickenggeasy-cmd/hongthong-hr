import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-permission";
import { createClient } from "@/lib/supabase/server";
import { formatThaiDate } from "@/lib/date";
import { numberSetting, toSettingsRecord } from "@/lib/settings";
import { leaveTypeLabel } from "@/lib/leave/logic";
import {
  approvalView,
  arrangeForExecutive,
  arrangeForFinance,
  arrangeForHr,
  decisionFor,
} from "@/lib/approvals/view";
import { PageHeader } from "@/components/features/page-header";
import { ExceedsQuotaBadge, LeaveStatusBadge } from "@/components/features/leave-status-badge";
import { Group, RequestCard, type Card } from "./request-card";

// คำขอลา/OT อ้างถึง employees 2 ทาง (ผู้ขอ / ผู้อนุมัติ) จึงต้องระบุชื่อ foreign key ให้ชัด
const REQUESTER_FIELDS = "id, employee_code, full_name, dept_code, departments(name, role)";

function dateRange(start: string, end: string) {
  return start === end ? formatThaiDate(start) : `${formatThaiDate(start)} – ${formatThaiDate(end)}`;
}

export default async function ApprovalsPage({ searchParams }: PageProps<"/approvals">) {
  const employee = await requirePermission("approvals.view");
  const view = approvalView(employee.role) ?? "hr";
  const viewer = { id: employee.id, role: employee.role };

  // อ่านผ่าน client ปกติ RLS ให้ 00/01/HR เห็นคำขอทั้งหมดอยู่แล้ว
  const supabase = await createClient();
  const [{ data: pendingLeaves }, { data: pendingOts }, { data: decidedLeaves }, { data: decidedOts }, { data: settingRows }] =
    await Promise.all([
      supabase
        .from("leave_requests")
        .select(`id, leave_type, start_date, end_date, days_count, reason, exceeds_quota, requester:employees!leave_requests_employee_id_fkey(${REQUESTER_FIELDS})`)
        .eq("status", "pending"),
      supabase
        .from("ot_requests")
        .select(`id, work_date, hours, reason, requester:employees!ot_requests_employee_id_fkey(${REQUESTER_FIELDS})`)
        .eq("status", "pending"),
      supabase
        .from("leave_requests")
        .select(
          "id, leave_type, start_date, end_date, days_count, status, exceeds_quota, decision_note, decided_at, requester:employees!leave_requests_employee_id_fkey(full_name), approver:employees!leave_requests_approver_id_fkey(full_name)",
        )
        .neq("status", "pending")
        .order("decided_at", { ascending: false })
        .limit(15),
      supabase
        .from("ot_requests")
        .select(
          "id, work_date, hours, status, decision_note, decided_at, requester:employees!ot_requests_employee_id_fkey(full_name), approver:employees!ot_requests_approver_id_fkey(full_name)",
        )
        .neq("status", "pending")
        .order("decided_at", { ascending: false })
        .limit(15),
      supabase.rpc("public_settings"),
    ]);
  const penalty = numberSetting(toSettingsRecord(settingRows), "leave.over_quota_deduction");

  const cards: Card[] = [
    ...(pendingLeaves ?? []).map((r) => ({
      kind: "leave" as const,
      id: r.id,
      requesterId: r.requester?.id ?? "",
      requesterName: r.requester?.full_name ?? "-",
      requesterRole: r.requester?.departments?.role ?? "",
      requesterCode: r.requester?.employee_code ?? "",
      deptCode: r.requester?.dept_code ?? "",
      deptName: r.requester?.departments?.name ?? "",
      exceedsQuota: r.exceeds_quota,
      sortDate: r.start_date,
      heading: `${leaveTypeLabel(r.leave_type)} · ${r.days_count} วัน`,
      dates: dateRange(r.start_date, r.end_date),
      reason: r.reason,
    })),
    ...(pendingOts ?? []).map((r) => ({
      kind: "ot" as const,
      id: r.id,
      requesterId: r.requester?.id ?? "",
      requesterName: r.requester?.full_name ?? "-",
      requesterRole: r.requester?.departments?.role ?? "",
      requesterCode: r.requester?.employee_code ?? "",
      deptCode: r.requester?.dept_code ?? "",
      deptName: r.requester?.departments?.name ?? "",
      exceedsQuota: false,
      sortDate: r.work_date,
      heading: `OT ${r.hours} ชั่วโมง`,
      dates: formatThaiDate(r.work_date),
      reason: r.reason,
    })),
  ];

  // HR: ตัวกรองแผนก (?dept=31)
  const requestedDept = (await searchParams).dept;
  const deptFilter = typeof requestedDept === "string" && /^\d{2}$/.test(requestedDept) ? requestedDept : null;
  const deptChips = [...new Map(cards.map((c) => [c.deptCode, c.deptName])).entries()].sort(([a], [b]) => a.localeCompare(b));

  const decidable = cards.filter((c) => decisionFor(viewer, c).allowed).length;
  const overQuota = cards.filter((c) => c.exceedsQuota).length;

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

  const description =
    view === "finance"
      ? "มุมมองการเงิน: คำขอที่เกินโควตา (มีผลหักเงิน) แสดงก่อน"
      : view === "hr"
        ? "มุมมอง HR: เรียงตามแผนกและชื่อ กรองแผนกได้"
        : "มุมมองผู้บริหาร: คำขอจาก HR/การเงิน อนุมัติได้เฉพาะคุณ";

  return (
    <div className="space-y-6">
      <PageHeader photo="handshake" icon={CheckCheck} title="อนุมัติคำขอลาและ OT" description={description}>
        <div className="flex gap-2">
          <span className="ht-stat text-center">
            <span className="block text-2xl font-bold text-[#1E5FA8]">{decidable}</span>
            <span className="text-xs text-[#5B6B7B]">คุณอนุมัติได้</span>
          </span>
          <span className="ht-stat text-center">
            <span className="block text-2xl font-bold text-[#1A1A1A]">{cards.length}</span>
            <span className="text-xs text-[#5B6B7B]">รอทั้งหมด</span>
          </span>
          {view === "finance" ? (
            <span className="ht-stat text-center">
              <span className="block text-2xl font-bold text-[#D64545]">{overQuota}</span>
              <span className="text-xs text-[#5B6B7B]">เกินโควตา</span>
            </span>
          ) : null}
        </div>
      </PageHeader>

      {view === "finance" ? (
        <Group title="คำขอรออนุมัติ" count={cards.length}>
          {arrangeForFinance(cards).map((c) => (
            <RequestCard key={`${c.kind}-${c.id}`} card={c} viewer={viewer} emphasis="finance" penalty={penalty} />
          ))}
        </Group>
      ) : null}

      {view === "hr" ? (
        <>
          {deptChips.length > 0 ? (
            <nav aria-label="กรองตามแผนก" className="flex flex-wrap gap-2">
              <Link
                href="/approvals"
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${!deptFilter ? "bg-[#1E5FA8] text-white" : "bg-white text-[#1E5FA8] shadow-sm hover:bg-[#EAF3FC]"}`}
              >
                ทุกแผนก ({cards.length})
              </Link>
              {deptChips.map(([code, name]) => (
                <Link
                  key={code}
                  href={`/approvals?dept=${code}`}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${deptFilter === code ? "bg-[#1E5FA8] text-white" : "bg-white text-[#1E5FA8] shadow-sm hover:bg-[#EAF3FC]"}`}
                >
                  {code} · {name} ({cards.filter((c) => c.deptCode === code).length})
                </Link>
              ))}
            </nav>
          ) : null}
          {(() => {
            const list = arrangeForHr(cards, deptFilter);
            return (
              <Group title={deptFilter ? `คำขอของแผนก ${deptFilter}` : "คำขอรออนุมัติ"} count={list.length}>
                {list.map((c) => (
                  <RequestCard key={`${c.kind}-${c.id}`} card={c} viewer={viewer} emphasis="people" penalty={penalty} />
                ))}
              </Group>
            );
          })()}
        </>
      ) : null}

      {view === "executive"
        ? (() => {
            const { general, executiveOnly } = arrangeForExecutive(cards, employee.id);
            return (
              <>
                <Group title="คำขอทั่วไป" description="HR/การเงินอนุมัติได้เช่นกัน" count={general.length}>
                  {general.map((c) => (
                    <RequestCard key={`${c.kind}-${c.id}`} card={c} viewer={viewer} emphasis="default" penalty={penalty} />
                  ))}
                </Group>
                <Group
                  gold
                  title="คำขอจาก HR/การเงิน ที่ต้องให้คุณอนุมัติเท่านั้น"
                  description="ตามกติกาบริษัท คำขอของ 01/20/21 และผู้บริหารคนอื่น อนุมัติได้เฉพาะผู้บริหาร"
                  count={executiveOnly.length}
                >
                  {executiveOnly.map((c) => (
                    <RequestCard key={`${c.kind}-${c.id}`} card={c} viewer={viewer} emphasis="default" penalty={penalty} />
                  ))}
                </Group>
              </>
            );
          })()
        : null}

      <section className="ht-card p-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-[#1A1A1A]">
          <span className="h-5 w-1 rounded-full bg-[#D4A017]" aria-hidden />
          พิจารณาล่าสุด
        </h2>
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
