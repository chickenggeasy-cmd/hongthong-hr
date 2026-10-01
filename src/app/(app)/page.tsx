import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { can, roleLabel } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { bangkokToday, endOfMonth, startOfMonth } from "@/lib/date";
import { nextAttendanceType, type AttendanceType } from "@/lib/attendance/logic";
import { usedLeaveDaysInMonth } from "@/lib/leave/logic";
import { canDecideRequest } from "@/lib/approvals/logic";
import { formatBaht, periodForDate, periodLabel } from "@/lib/payroll/logic";
import { numberSetting, timeSetting, toSettingsRecord } from "@/lib/settings";
import { bangkokClock, bangkokDayRange, todayStatus, TODAY_STATUS_CLASS, TODAY_STATUS_LABEL_TH, type TodayStatus } from "@/lib/team/logic";
import { loadTodayOverview } from "@/lib/team/overview";
import { warningKindLabel } from "@/lib/warnings/logic";
import { AcknowledgeButton } from "./warnings/warning-forms";

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

function StatCard({ label, value, hint, href, tone = "default" }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const valueColor = { default: "text-[#1A1A1A]", good: "text-[#2E9E5B]", warn: "text-[#E8890C]", bad: "text-[#D64545]" }[tone];
  const body = (
    <>
      <p className="text-xs text-[#5B6B7B]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueColor}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[#5B6B7B]">{hint}</p> : null}
    </>
  );
  const className = "block rounded-2xl bg-white p-4 shadow-sm";
  return href ? (
    <Link href={href} className={`${className} transition-colors hover:bg-[#EAF3FC]`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Section({ title, action, children }: { title: string; action?: { href: string; label: string }; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#1A1A1A]">{title}</h2>
        {action ? (
          <Link href={action.href} className="text-sm text-[#1E5FA8] hover:underline">
            {action.label} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
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

  return (
    <div className="space-y-6">
      {/* การ์ดทักทาย + เช็คอิน */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E5FA8] to-[#164a85] p-6 text-white shadow-md">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#D4A017]" aria-hidden />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" aria-hidden />
        <div className="absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-[#D4A017]/10" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">{greeting(now)} · {thaiLongDate(today)}</p>
            <h1 className="mt-1 text-2xl font-semibold">{employee.fullName}</h1>
            <p className="mt-1 text-sm text-white/80">
              {employee.employeeCode} · {employee.deptName}
              <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs">{roleLabel(employee.role)}</span>
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded-full bg-white px-2.5 py-0.5 text-xs font-medium ${TODAY_STATUS_CLASS[myToday.status].split(" ").find((c) => c.startsWith("text-"))}`}>
                {holidayToday ? `วันหยุด: ${holidayToday}` : TODAY_STATUS_LABEL_TH[myToday.status]}
              </span>
              {myToday.checkInAt ? <span className="text-white/80">เข้า {bangkokClock(myToday.checkInAt)}</span> : null}
              {myToday.checkOutAt ? <span className="text-white/80">ออก {bangkokClock(myToday.checkOutAt)}</span> : null}
            </p>
          </div>
          <Link
            href="/attendance"
            className="rounded-2xl bg-white px-6 py-3 text-center font-semibold text-[#1E5FA8] shadow-sm transition-transform hover:scale-[1.02]"
          >
            {nextType === "check_in" ? "เช็คอิน" : "เช็คเอาท์"} →
          </Link>
        </div>
      </div>

      {/* ใบเตือนที่ยังไม่รับทราบ */}
      {myWarnings && myWarnings.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-[#D64545]/30 bg-[#D64545]/5 p-4">
          <p className="font-semibold text-[#D64545]">คุณมีใบเตือน {myWarnings.length} ใบที่ยังไม่ได้รับทราบ</p>
          {myWarnings.map((w) => (
            <div key={w.id} className="flex items-start justify-between gap-3 rounded-xl bg-white p-3 text-sm">
              <div>
                <p className="font-medium text-[#1A1A1A]">{warningKindLabel(w.kind)}</p>
                <p className="text-[#5B6B7B]">{w.reason}</p>
              </div>
              <AcknowledgeButton warningId={w.id} />
            </div>
          ))}
        </div>
      ) : null}

      {/* ของฉัน (ทุกบทบาท) */}
      <Section title="ของฉัน">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="วันลาคงเหลือเดือนนี้"
            value={quota === null ? "-" : `${Math.max(quota - usedLeave, 0)} วัน`}
            hint={quota === null ? undefined : `ใช้ไป ${usedLeave} จาก ${quota} วัน`}
            href="/leave"
            tone={quota !== null && usedLeave >= quota ? "bad" : "good"}
          />
          <StatCard
            label="คำขอรออนุมัติ"
            value={`${(myPendingLeaves ?? 0) + (myPendingOts ?? 0)} รายการ`}
            hint={`ลา ${myPendingLeaves ?? 0} · OT ${myPendingOts ?? 0}`}
            href="/leave"
            tone={(myPendingLeaves ?? 0) + (myPendingOts ?? 0) > 0 ? "warn" : "default"}
          />
          <StatCard label="ขอทำ OT" value="ยื่นคำขอ" hint="ต้องขอก่อนเวลาเลิกงาน" href="/ot" />
          <StatCard
            label="สลิปล่าสุด"
            value={latestPayslip ? `${formatBaht(Number(latestPayslip.net_pay))} ฿` : "-"}
            hint={latestPayslip ? `งวด ${periodLabel(latestPayslip.payroll_runs.period)}` : "ยังไม่มีสลิป"}
            href={latestPayslip ? `/payslip/${latestPayslip.id}` : "/payslip"}
          />
        </div>
      </Section>

      {/* ผู้อนุมัติ */}
      {canApprove ? (
        <Section title="รออนุมัติ" action={{ href: "/approvals", label: "ไปหน้าอนุมัติ" }}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="คุณอนุมัติได้" value={`${decidable.length} รายการ`} tone={decidable.length > 0 ? "warn" : "good"} href="/approvals" />
            <StatCard label="รอทั้งหมดในบริษัท" value={`${pendingAll.length} รายการ`} hint={`ลา ${pendingLeaves.length} · OT ${pendingOts.length}`} />
            {employee.role === "executive" ? (
              <Link
                href="/approvals"
                className="col-span-2 block rounded-2xl border-2 border-[#D4A017] bg-white p-4 shadow-sm transition-colors hover:bg-[#D4A017]/5 sm:col-span-1"
              >
                <p className="text-xs text-[#5B6B7B]">จาก HR/การเงิน ที่ต้องให้คุณอนุมัติเท่านั้น</p>
                <p className="mt-1 text-2xl font-semibold text-[#1A1A1A]">{executiveOnly.length} รายการ</p>
              </Link>
            ) : (
              <StatCard
                label="ต้องรอผู้บริหารอนุมัติ"
                value={`${pendingAll.length - decidable.length} รายการ`}
                hint="คำขอของ 01/HR/ผู้บริหาร หรือของคุณเอง"
              />
            )}
          </div>
        </Section>
      ) : null}

      {/* ทีม / บริษัทวันนี้ */}
      {overview ? (
        <Section
          title={employee.role === "head" ? "ทีมของฉันวันนี้" : "ภาพรวมบริษัทวันนี้"}
          action={{ href: "/team", label: "ดูรายชื่อ" }}
        >
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "มาแล้ว", value: presentCount, color: "text-[#2E9E5B]" },
                { label: "มาสาย", value: lateCount, color: "text-[#E8890C]" },
                { label: "ลา", value: leaveCount, color: "text-[#1E5FA8]" },
                { label: "ยังไม่มา", value: absentCount, color: "text-[#D64545]" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-[#EAF3FC] p-3">
                  <p className="text-xs text-[#5B6B7B]">{item.label}</p>
                  <p className={`text-2xl font-semibold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
            {overview.members.length > 0 ? (
              <div className="mt-3">
                <div className="flex h-2 overflow-hidden rounded-full bg-[#5B6B7B]/10" aria-hidden>
                  <div className="bg-[#2E9E5B]" style={{ width: `${((presentCount - lateCount) / overview.members.length) * 100}%` }} />
                  <div className="bg-[#E8890C]" style={{ width: `${(lateCount / overview.members.length) * 100}%` }} />
                  <div className="bg-[#5BA4E6]" style={{ width: `${(leaveCount / overview.members.length) * 100}%` }} />
                  <div className="bg-[#D64545]" style={{ width: `${(absentCount / overview.members.length) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-[#5B6B7B]">ทั้งหมด {overview.members.length} คน (ไม่รวมคุณ)</p>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* เงินเดือน (00/01/HR) */}
      {canPayroll ? (
        <Section title="เงินเดือน" action={{ href: "/payroll", label: "ไปหน้าเงินเดือน" }}>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={`งวด ${periodLabel(currentPeriod)}`}
              value={!currentRun ? "ยังไม่คำนวณ" : currentRun.status === "finalized" ? "ปิดงวดแล้ว" : "ร่าง"}
              tone={!currentRun ? "default" : currentRun.status === "finalized" ? "good" : "warn"}
              href={`/payroll?period=${currentPeriod}`}
            />
            <StatCard label="รายงาน Excel" value="ดาวน์โหลด" hint="เงินเดือน · เข้างาน · ลา/OT" href="/reports" />
          </div>
        </Section>
      ) : null}

      {/* ทางลัด HR */}
      {can(employee.role, "admin.view") ? (
        <Section title="ทางลัด HR">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="ใบเตือน" value="จัดการ" hint="ออกอัตโนมัติ/ออกเอง" href="/warnings" />
            <StatCard label="ตั้งค่าระบบ" value="แก้ไข" hint="อัตรา · วันหยุด · พิกัด" href="/admin" />
            <StatCard label="พนักงาน" value="จัดการ" hint="ลงทะเบียน/แก้ไข" href="/employees" />
          </div>
        </Section>
      ) : null}
    </div>
  );
}
