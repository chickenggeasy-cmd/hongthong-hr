import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { bangkokToday, endOfMonth, startOfMonth } from "@/lib/date";
import { nextAttendanceType, type AttendanceType } from "@/lib/attendance/logic";
import { usedLeaveDaysInMonth } from "@/lib/leave/logic";
import { canDecideRequest } from "@/lib/approvals/logic";
import { periodForDate } from "@/lib/payroll/logic";
import { numberSetting, timeSetting, toSettingsRecord } from "@/lib/settings";
import { bangkokClock, bangkokDayRange, todayStatus, type TodayStatus } from "@/lib/team/logic";
import { loadTodayOverview } from "@/lib/team/overview";
import { DashboardView, type DashboardData } from "./dashboard-view";

function greeting(now: Date): string {
  const hour = Number(bangkokClock(now.toISOString())?.slice(0, 2));
  if (hour < 12) return "สวัสดีตอนเช้า";
  if (hour < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

function thaiLongDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const PRESENT: TodayStatus[] = ["working", "checked_out", "late"];

export default async function HomePage() {
  // ไม่มีทาง null ในหน้านี้ตามปกติ เพราะ layout.tsx เช็คและกันไว้ให้แล้ว
  // แต่ TypeScript ไม่รู้ จึงต้องเช็คอีกชั้น (cache() ทำให้เรียกซ้ำแทบไม่มีต้นทุนเพิ่ม)
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  const supabase = await createClient();
  const now = new Date();
  const today = bangkokToday(now);
  const todayRange = bangkokDayRange(today);
  const pendingCount = { count: "exact", head: true } as const;

  // ข้อมูลส่วนตัว (ทุกบทบาท) อ่านผ่าน client ปกติ RLS ให้เห็นของตัวเองอยู่แล้ว
  const [
    { data: settingRows },
    { data: lastLog },
    { data: myLogsToday },
    { data: myMonthLeaves },
    { data: holidayRows },
    { count: myPendingLeaves },
    { count: myPendingOts },
    { data: myWarnings },
    { data: latestPayslip },
  ] = await Promise.all([
    supabase.rpc("public_settings"),
    supabase
      .from("attendance_logs")
      .select("type")
      .eq("employee_id", employee.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("attendance_logs")
      .select("type, recorded_at")
      .eq("employee_id", employee.id)
      .gte("recorded_at", todayRange.from)
      .lt("recorded_at", todayRange.to),
    supabase
      .from("leave_requests")
      .select("start_date, end_date, status")
      .eq("employee_id", employee.id)
      .lte("start_date", endOfMonth(today))
      .gte("end_date", startOfMonth(today)),
    supabase.from("holidays").select("holiday_date, name").gte("holiday_date", startOfMonth(today)).lte("holiday_date", endOfMonth(today)),
    supabase.from("leave_requests").select("id", pendingCount).eq("employee_id", employee.id).eq("status", "pending"),
    supabase.from("ot_requests").select("id", pendingCount).eq("employee_id", employee.id).eq("status", "pending"),
    supabase
      .from("warnings")
      .select("id, kind, reason, issued_at")
      .eq("employee_id", employee.id)
      .is("acknowledged_at", null)
      .order("issued_at", { ascending: false }),
    supabase
      .from("payslips")
      .select("id, net_pay, payroll_runs!inner(period, status)")
      .eq("employee_id", employee.id)
      .eq("payroll_runs.status", "finalized")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const settings = toSettingsRecord(settingRows);
  const quota = numberSetting(settings, "leave.monthly_quota_days");
  const cutoffDay = numberSetting(settings, "payroll.cutoff_day") ?? 25;
  const holidays = new Set((holidayRows ?? []).map((h) => h.holiday_date));
  const holidayToday = (holidayRows ?? []).find((h) => h.holiday_date === today)?.name ?? null;
  const usedLeave = usedLeaveDaysInMonth(myMonthLeaves ?? [], today, holidays);
  const onLeaveToday = (myMonthLeaves ?? []).some((l) => l.status === "approved" && l.start_date <= today && l.end_date >= today);
  const isSunday = new Date(`${today}T00:00:00Z`).getUTCDay() === 0;
  const myToday = todayStatus({
    now,
    isWorkingDay: !isSunday && !holidayToday,
    onApprovedLeave: onLeaveToday,
    workStartTime: timeSetting(settings, "work.start_time") ?? "09:00",
    logs: (myLogsToday ?? []).map((l) => ({ type: l.type, recordedAt: l.recorded_at })),
  });
  const nextType = nextAttendanceType((lastLog?.type as AttendanceType | undefined) ?? null);

  // ข้อมูลตามบทบาท (โหลดเฉพาะที่มีสิทธิ์)
  const canTeam = can(employee.role, "team.view");
  const canApprove = can(employee.role, "approvals.view");
  const canPayroll = can(employee.role, "payroll.view");
  const requester = "requester:employees!leave_requests_employee_id_fkey(id, departments(role))";
  const [overview, pendingLeaves, pendingOts, currentRun] = await Promise.all([
    canTeam ? loadTodayOverview(supabase, { excludeEmployeeId: employee.id, upcomingDays: 7 }) : null,
    canApprove
      ? supabase.from("leave_requests").select(`id, ${requester}`).eq("status", "pending").then((r) => r.data ?? [])
      : [],
    canApprove
      ? supabase
          .from("ot_requests")
          .select("id, requester:employees!ot_requests_employee_id_fkey(id, departments(role))")
          .eq("status", "pending")
          .then((r) => r.data ?? [])
      : [],
    canPayroll
      ? supabase.from("payroll_runs").select("status").eq("period", periodForDate(today, cutoffDay)).maybeSingle().then((r) => r.data)
      : null,
  ]);

  // แยกคำขอที่รอ: ฉันอนุมัติได้ / ต้องรอผู้บริหาร / คำขอที่ "ต้องให้ผู้บริหารอนุมัติเท่านั้น" (มุมมองผู้บริหาร)
  const pendingAll = [...pendingLeaves, ...pendingOts];
  const decidable = pendingAll.filter(
    (r) =>
      canDecideRequest({
        approverId: employee.id,
        approverRole: employee.role,
        requesterId: r.requester?.id ?? "",
        requesterRole: r.requester?.departments?.role ?? "",
      }).allowed,
  );
  const executiveOnly = decidable.filter((r) => can(r.requester?.departments?.role ?? "", "approvals.view"));

  const presentCount = overview?.members.filter((m) => PRESENT.includes(m.today.status)).length ?? 0;
  const lateCount = overview?.members.filter((m) => m.today.status === "late").length ?? 0;
  const leaveCount = overview?.members.filter((m) => m.today.status === "on_leave").length ?? 0;
  const absentCount = overview?.members.filter((m) => m.today.status === "absent").length ?? 0;
  const currentPeriod = periodForDate(today, cutoffDay);

  const data: DashboardData = {
    nowIso: now.toISOString(),
    dateLabel: thaiLongDate(today),
    greeting: greeting(now),
    employee,
    todayStatus: myToday.status,
    holidayToday,
    checkIn: bangkokClock(myToday.checkInAt),
    checkOut: bangkokClock(myToday.checkOutAt),
    nextAction: nextType === "check_in" ? "เช็คอิน" : "เช็คเอาท์",
    leave: { quota, used: usedLeave },
    myPending: { leaves: myPendingLeaves ?? 0, ots: myPendingOts ?? 0 },
    latestPayslip: latestPayslip
      ? { id: latestPayslip.id, netPay: Number(latestPayslip.net_pay), period: latestPayslip.payroll_runs.period }
      : null,
    warnings: myWarnings ?? [],
    approvals: canApprove
      ? {
          decidable: decidable.length,
          total: pendingAll.length,
          leaves: pendingLeaves.length,
          ots: pendingOts.length,
          executiveOnly: employee.role === "executive" ? executiveOnly.length : null,
        }
      : null,
    overview: overview
      ? {
          title: employee.role === "head" ? "ทีมของฉันวันนี้" : "ภาพรวมบริษัทวันนี้",
          total: overview.members.length,
          present: presentCount,
          late: lateCount,
          leave: leaveCount,
          absent: absentCount,
        }
      : null,
    payroll: canPayroll
      ? { period: currentPeriod, status: !currentRun ? "none" : currentRun.status === "finalized" ? "finalized" : "draft" }
      : null,
    showHrShortcuts: can(employee.role, "admin.view"),
  };

  return <DashboardView data={data} />;
}
