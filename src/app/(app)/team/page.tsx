import { requirePermission } from "@/lib/auth/require-permission";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatThaiDate } from "@/lib/date";
import { leaveStatusLabel, leaveTypeLabel } from "@/lib/leave/logic";
import { bangkokClock, TODAY_STATUS_CLASS, TODAY_STATUS_LABEL_TH, type TodayStatus } from "@/lib/team/logic";
import { loadTodayOverview, type TeamMember } from "@/lib/team/overview";
import { CardHeading } from "@/components/features/card-heading";

const SUMMARY: { status: TodayStatus[]; label: string; className: string }[] = [
  { status: ["working", "checked_out"], label: "มาแล้ว", className: "text-[#2E9E5B]" },
  { status: ["late"], label: "มาสาย", className: "text-[#E8890C]" },
  { status: ["on_leave"], label: "ลา", className: "text-[#1E5FA8]" },
  { status: ["absent", "not_yet"], label: "ยังไม่มา", className: "text-[#D64545]" },
];

export default async function TeamPage() {
  const employee = await requirePermission("team.view");

  // RLS คุมว่าใครเห็นใคร: หัวหน้าเห็นแผนกกลุ่มเดียวกัน, 00/01/HR เห็นทั้งบริษัท
  const supabase = await createClient();
  const overview = await loadTodayOverview(supabase, { excludeEmployeeId: employee.id });
  const isCompanyWide = employee.role !== "head";

  const byDepartment = new Map<string, TeamMember[]>();
  for (const member of overview.members) {
    const key = `${member.deptCode} · ${member.deptName}`;
    byDepartment.set(key, [...(byDepartment.get(key) ?? []), member]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title={isCompanyWide ? "พนักงานทั้งบริษัท" : "ทีมของฉัน"}
        description={`วันนี้ ${formatThaiDate(overview.date)}${overview.holidayName ? ` · วันหยุด: ${overview.holidayName}` : !overview.isWorkingDay ? " · วันหยุดประจำสัปดาห์" : ""}`}
      />
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SUMMARY.map((item) => (
            <div key={item.label} className="ht-card p-4">
              <p className="text-xs text-[#5B6B7B]">{item.label}</p>
              <p className={`text-2xl font-semibold ${item.className}`}>
                {overview.members.filter((m) => item.status.includes(m.today.status)).length}
              </p>
            </div>
          ))}
        </div>
      </div>

      {overview.members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#5B6B7B]/30 bg-white/60 p-6 text-center text-sm text-[#5B6B7B]">
          ยังไม่มีลูกทีม
        </div>
      ) : (
        [...byDepartment.entries()].map(([department, members]) => (
          <section key={department} className="ht-card p-6">
            <CardHeading sticker="people" className="mb-3">{department}</CardHeading>
            <ul className="divide-y divide-[#5B6B7B]/10 text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium text-[#1A1A1A]">{m.fullName}</p>
                    <p className="text-xs text-[#5B6B7B]">
                      {m.employeeCode}
                      {m.today.checkInAt ? ` · เข้า ${bangkokClock(m.today.checkInAt)}` : ""}
                      {m.today.checkOutAt ? ` · ออก ${bangkokClock(m.today.checkOutAt)}` : ""}
                    </p>
                    {m.upcomingLeave && m.today.status !== "on_leave" ? (
                      <p className="text-xs text-[#1E5FA8]">
                        {leaveTypeLabel(m.upcomingLeave.leaveType)} {formatThaiDate(m.upcomingLeave.startDate)}
                        {m.upcomingLeave.endDate !== m.upcomingLeave.startDate ? ` – ${formatThaiDate(m.upcomingLeave.endDate)}` : ""} (
                        {leaveStatusLabel(m.upcomingLeave.status)})
                      </p>
                    ) : null}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TODAY_STATUS_CLASS[m.today.status]}`}>
                    {TODAY_STATUS_LABEL_TH[m.today.status]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
