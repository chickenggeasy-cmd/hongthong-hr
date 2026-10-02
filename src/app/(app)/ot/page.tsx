import { Timer } from "lucide-react";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { bangkokToday, formatThaiDate } from "@/lib/date";
import { numberSetting, timeSetting, toSettingsRecord } from "@/lib/settings";
import { LeaveStatusBadge } from "@/components/features/leave-status-badge";
import { PageHeader } from "@/components/features/page-header";
import { EmptyState } from "@/components/features/empty-state";
import { OtRequestForm } from "./ot-request-form";
import { CardHeading } from "@/components/features/card-heading";

export default async function OtPage() {
  // ทุกคนที่ล็อกอินขอ OT ได้ จึงไม่ต้อง requirePermission()
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  // อ่านผ่าน client ปกติ RLS ให้พนักงานเห็นคำขอของตัวเองอยู่แล้ว
  const supabase = await createClient();
  const [{ data: settingRows }, { data: requests }] = await Promise.all([
    supabase.rpc("public_settings"),
    supabase
      .from("ot_requests")
      .select("id, work_date, hours, reason, status, decision_note")
      .eq("employee_id", employee.id)
      .order("work_date", { ascending: false })
      .limit(30),
  ]);

  const settings = toSettingsRecord(settingRows);
  const maxHoursPerDay = numberSetting(settings, "ot.max_hours_per_day");
  const workEndTime = timeSetting(settings, "work.end_time");
  if (maxHoursPerDay === null || workEndTime === null) {
    return (
      <div className="ht-card p-6">
        <p className="text-[#D64545]">ระบบยังไม่ได้ตั้งค่ากติกา OT กรุณาติดต่อ HR</p>
      </div>
    );
  }

  const thisMonth = bangkokToday().slice(0, 7);
  const approvedHours = (requests ?? [])
    .filter((r) => r.status === "approved" && r.work_date.startsWith(thisMonth))
    .reduce((sum, r) => sum + r.hours, 0);

  return (
    <div className="space-y-6">
      <PageHeader photo="logistics" icon={Timer} title="ขอทำ OT" description={`ต้องขอล่วงหน้าก่อน ${workEndTime} น. ของวันนั้น · จ่ายเฉพาะชั่วโมงเต็มที่ทำจริง`}>
        <span className="ht-stat text-center">
          <span className="block text-2xl font-bold text-[#1E5FA8]">{approvedHours} ชม.</span>
          <span className="text-xs text-[#5B6B7B]">OT ที่อนุมัติเดือนนี้</span>
        </span>
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <OtRequestForm
          today={bangkokToday()}
          maxHoursPerDay={maxHoursPerDay}
          workEndTime={workEndTime}
          hourlyRate={numberSetting(settings, "ot.hourly_rate")}
        />

        <section className="ht-card p-6">
          <CardHeading sticker="stopwatch">คำขอ OT ของฉัน</CardHeading>
          {!requests || requests.length === 0 ? (
            <EmptyState sticker="stopwatch">ยังไม่มีคำขอ OT</EmptyState>
          ) : (
            <ul className="space-y-2">
              {requests.map((request) => (
                <li key={request.id} className="flex gap-3 rounded-2xl p-3 transition-colors hover:bg-[#F7FAFD]">
                  <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-[#1E5FA8]/10 text-[#1E5FA8]">
                    <span className="text-sm font-bold leading-none">{request.hours}</span>
                    <span className="text-[10px] leading-none">ชม.</span>
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#1A1A1A]">{formatThaiDate(request.work_date)}</span>
                      <LeaveStatusBadge status={request.status} />
                    </div>
                    {request.reason ? <p className="text-[#5B6B7B]">งาน: {request.reason}</p> : null}
                    {request.decision_note ? <p className="text-[#5B6B7B]">หมายเหตุผู้อนุมัติ: {request.decision_note}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
