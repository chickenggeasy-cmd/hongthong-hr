import { Briefcase, CalendarClock, History, Thermometer, TreePalm, UsersRound, type LucideIcon } from "lucide-react";
import { formatThaiDate } from "@/lib/date";
import { EmptyState } from "@/components/features/empty-state";
import { leaveTypeLabel } from "@/lib/leave/logic";
import type { TeamLeave } from "@/lib/leave/team";
import { ExceedsQuotaBadge, LeaveStatusBadge } from "@/components/features/leave-status-badge";

// ชิ้นส่วนหน้าตาของหน้าลา (รับข้อมูลที่โหลดแล้ว ไม่ยิงฐานข้อมูลเอง)

const TYPE_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  sick: { icon: Thermometer, className: "bg-[#D64545]/10 text-[#D64545]" },
  personal: { icon: Briefcase, className: "bg-[#1E5FA8]/10 text-[#1E5FA8]" },
  vacation: { icon: TreePalm, className: "bg-[#2E9E5B]/10 text-[#2E9E5B]" },
};

function dateRange(start: string, end: string) {
  return start === end ? formatThaiDate(start) : `${formatThaiDate(start)} – ${formatThaiDate(end)}`;
}

/** โควตาลาเดือนนี้: ช่องละ 1 วัน (เต็ม = ใช้แล้ว รวมคำขอที่รออนุมัติ) */
export function QuotaCard({ quota, used, monthLabel }: { quota: number; used: number; monthLabel: string }) {
  const remaining = Math.max(quota - used, 0);
  const over = Math.max(used - quota, 0);
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E5FA8] to-[#0F3B6E] p-6 text-white shadow-lg shadow-[#1E5FA8]/20">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D4A017] via-[#F0C75E] to-[#D4A017]" aria-hidden />
      <p className="text-sm text-white/75">วันลาคงเหลือ {monthLabel}</p>
      <p className="mt-1 text-5xl font-bold">
        {remaining}
        <span className="text-xl font-medium text-white/75"> / {quota} วัน</span>
      </p>
      <div className="mt-4 flex gap-1.5" role="img" aria-label={`ใช้ไป ${used} วัน จากโควตา ${quota} วัน`}>
        {Array.from({ length: Math.max(quota, 1) }, (_, i) => (
          <span key={i} className={`h-2.5 flex-1 rounded-full ${i < used ? "bg-[#F0C75E]" : "bg-white/20"}`} />
        ))}
      </div>
      <p className="mt-2 text-sm text-white/80">
        ใช้ไป {used} วัน (รวมที่รออนุมัติ) · ยกยอดไปเดือนถัดไปไม่ได้
      </p>
      {over > 0 ? (
        <p className="mt-3 rounded-xl bg-[#D64545] px-3 py-1.5 text-sm font-semibold">เกินโควตา {over} วัน — มีผลหักเงินตอนคำนวณเงินเดือน</p>
      ) : null}
    </section>
  );
}

export type MyLeave = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: string;
  exceeds_quota: boolean;
  decision_note: string | null;
};

export function MyLeaveList({ requests }: { requests: MyLeave[] }) {
  return (
    <section className="ht-card p-6">
      <h2 className="mb-3 flex items-center gap-2 font-bold text-[#1A1A1A]">
        <History className="h-5 w-5 text-[#1E5FA8]" aria-hidden />
        คำขอลาของฉัน
      </h2>
      {requests.length === 0 ? (
        <EmptyState sticker="calendar">ยังไม่มีคำขอลา</EmptyState>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => {
            const type = TYPE_ICON[r.leave_type] ?? TYPE_ICON.personal;
            const Icon = type.icon;
            return (
              <li key={r.id} className="flex gap-3 rounded-2xl p-3 transition-colors hover:bg-[#F7FAFD]">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${type.className}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#1A1A1A]">
                      {leaveTypeLabel(r.leave_type)} · {r.days_count} วัน
                    </span>
                    <span className="flex gap-1">
                      {r.exceeds_quota ? <ExceedsQuotaBadge /> : null}
                      <LeaveStatusBadge status={r.status} />
                    </span>
                  </div>
                  <p className="text-[#5B6B7B]">{dateRange(r.start_date, r.end_date)}</p>
                  {r.reason ? <p className="text-[#5B6B7B]">เหตุผล: {r.reason}</p> : null}
                  {r.decision_note ? <p className="text-[#5B6B7B]">หมายเหตุผู้อนุมัติ: {r.decision_note}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type TeamLeaveRow = TeamLeave & { leaveType: string; daysCount: number };

function TeamRow({ leave }: { leave: TeamLeaveRow }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-2xl bg-[#F7FAFD] px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[#1A1A1A]">{leave.employeeName}</span>
        <span className="text-[#5B6B7B]">
          {leaveTypeLabel(leave.leaveType)} · {dateRange(leave.startDate, leave.endDate)} · {leave.daysCount} วัน
        </span>
      </span>
      <LeaveStatusBadge status={leave.status} />
    </li>
  );
}

/** หัวหน้าแผนก: การลาของลูกทีม (อ่านอย่างเดียว) */
export function TeamLeaveCard({ today, upcoming }: { today: TeamLeaveRow[]; upcoming: TeamLeaveRow[] }) {
  return (
    <section className="ht-card p-6">
      <h2 className="flex items-center gap-2 font-bold text-[#1A1A1A]">
        <UsersRound className="h-5 w-5 text-[#1E5FA8]" aria-hidden />
        ทีมของฉัน
      </h2>
      <p className="mt-0.5 text-sm text-[#5B6B7B]">การลาของลูกทีม ดูเพื่อวางแผนงาน (การอนุมัติทำโดย HR/การเงิน/ผู้บริหาร)</p>

      <h3 className="mt-4 text-sm font-semibold text-[#1A1A1A]">ลาวันนี้ ({today.length})</h3>
      {today.length === 0 ? (
        <p className="mt-1 text-sm text-[#5B6B7B]">ไม่มีลูกทีมลาวันนี้</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {today.map((l) => (
            <TeamRow key={l.id} leave={l} />
          ))}
        </ul>
      )}

      <h3 className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-[#1A1A1A]">
        <CalendarClock className="h-4 w-4 text-[#5B6B7B]" aria-hidden />
        กำลังจะลา ใน 30 วัน ({upcoming.length})
      </h3>
      {upcoming.length === 0 ? (
        <p className="mt-1 text-sm text-[#5B6B7B]">ยังไม่มีใครขอลา</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {upcoming.map((l) => (
            <TeamRow key={l.id} leave={l} />
          ))}
        </ul>
      )}
    </section>
  );
}
