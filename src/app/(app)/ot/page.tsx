import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { bangkokToday, formatThaiDate } from "@/lib/date";
import { numberSetting, timeSetting, toSettingsRecord } from "@/lib/settings";
import { LeaveStatusBadge } from "@/components/features/leave-status-badge";
import { OtRequestForm } from "./ot-request-form";

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
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-[#D64545]">ระบบยังไม่ได้ตั้งค่ากติกา OT กรุณาติดต่อ HR</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OtRequestForm
        today={bangkokToday()}
        maxHoursPerDay={maxHoursPerDay}
        workEndTime={workEndTime}
        hourlyRate={numberSetting(settings, "ot.hourly_rate")}
      />

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-[#1A1A1A]">คำขอ OT ของฉัน</h2>
        {!requests || requests.length === 0 ? (
          <p className="text-sm text-[#5B6B7B]">ยังไม่มีคำขอ OT</p>
        ) : (
          <ul className="divide-y divide-[#5B6B7B]/10 text-sm">
            {requests.map((request) => (
              <li key={request.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[#1A1A1A]">
                    {formatThaiDate(request.work_date)} · {request.hours} ชั่วโมง
                  </span>
                  <LeaveStatusBadge status={request.status} />
                </div>
                {request.reason ? <p className="text-[#5B6B7B]">งาน: {request.reason}</p> : null}
                {request.decision_note ? (
                  <p className="text-[#5B6B7B]">หมายเหตุผู้อนุมัติ: {request.decision_note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
