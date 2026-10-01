import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { addDays, bangkokToday, type DateOnly } from "@/lib/date";
import { isWorkingDay } from "@/lib/leave/logic";
import { timeSetting, toSettingsRecord } from "@/lib/settings";
import { bangkokDayRange, todayStatus, type TodayResult } from "./logic";

// โหลดภาพรวม "วันนี้" ของพนักงานที่ผู้ใช้เห็นได้ (ฝั่งเซิร์ฟเวอร์เท่านั้น)
// ใช้ client ปกติ RLS จึงคุมเองว่าใครเห็นใคร: หัวหน้าเห็นทีม, 00/01/HR เห็นทั้งบริษัท

export type TeamMember = {
  id: string;
  employeeCode: string;
  fullName: string;
  deptCode: string;
  deptName: string;
  today: TodayResult;
  upcomingLeave: { startDate: DateOnly; endDate: DateOnly; leaveType: string; status: string } | null;
};

export type TodayOverview = {
  date: DateOnly;
  isWorkingDay: boolean;
  holidayName: string | null;
  members: TeamMember[];
};

export async function loadTodayOverview(
  supabase: SupabaseClient<Database>,
  options: { excludeEmployeeId?: string; upcomingDays?: number } = {},
): Promise<TodayOverview> {
  const now = new Date();
  const today = bangkokToday(now);
  const range = bangkokDayRange(today);
  const until = addDays(today, options.upcomingDays ?? 14);

  const [{ data: employees }, { data: logs }, { data: leaves }, { data: holiday }, { data: settingRows }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, employee_code, full_name, dept_code, departments(name)")
      .eq("status", "active")
      .order("dept_code")
      .order("employee_code"),
    supabase
      .from("attendance_logs")
      .select("employee_id, type, recorded_at")
      .gte("recorded_at", range.from)
      .lt("recorded_at", range.to),
    supabase
      .from("leave_requests")
      .select("employee_id, start_date, end_date, leave_type, status")
      .in("status", ["pending", "approved"])
      .lte("start_date", until)
      .gte("end_date", today)
      .order("start_date"),
    supabase.from("holidays").select("name").eq("holiday_date", today).maybeSingle(),
    supabase.rpc("public_settings"),
  ]);

  const workStartTime = timeSetting(toSettingsRecord(settingRows), "work.start_time") ?? "09:00";
  const holidays = holiday ? new Set([today]) : new Set<string>();
  const workingDay = isWorkingDay(today, holidays);

  const members = (employees ?? [])
    .filter((e) => e.id !== options.excludeEmployeeId)
    .map((e): TeamMember => {
      const myLeaves = (leaves ?? []).filter((l) => l.employee_id === e.id);
      const leaveToday = myLeaves.find((l) => l.status === "approved" && l.start_date <= today && l.end_date >= today);
      const next = myLeaves[0] ?? null;
      return {
        id: e.id,
        employeeCode: e.employee_code,
        fullName: e.full_name,
        deptCode: e.dept_code,
        deptName: e.departments?.name ?? "",
        today: todayStatus({
          now,
          isWorkingDay: workingDay,
          onApprovedLeave: Boolean(leaveToday),
          workStartTime,
          logs: (logs ?? []).filter((l) => l.employee_id === e.id).map((l) => ({ type: l.type, recordedAt: l.recorded_at })),
        }),
        upcomingLeave: next
          ? { startDate: next.start_date, endDate: next.end_date, leaveType: next.leave_type, status: next.status }
          : null,
      };
    });

  return { date: today, isWorkingDay: workingDay, holidayName: holiday?.name ?? null, members };
}
