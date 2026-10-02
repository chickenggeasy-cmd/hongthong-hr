import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { addDays, addMonths, bangkokToday, endOfMonth, startOfMonth } from "@/lib/date";
import { CalendarDays } from "lucide-react";
import { usedLeaveDaysInMonth } from "@/lib/leave/logic";
import { teamLeaveSections } from "@/lib/leave/team";
import { PageHeader } from "@/components/features/page-header";
import { LeaveRequestForm } from "./leave-request-form";
import { MyLeaveList, QuotaCard, TeamLeaveCard } from "./leave-view";

export default async function LeavePage() {
  // ทุกคนที่ล็อกอินยื่นลาได้ จึงไม่ต้อง requirePermission() (layout.tsx กันคนไม่มีบัญชีไว้แล้ว)
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  // อ่านผ่าน client ปกติ เพราะ RLS ให้พนักงานเห็นคำขอของตัวเองอยู่แล้ว
  const supabase = await createClient();
  const today = bangkokToday();

  const [{ data: settingsRows }, { data: requests }, { data: thisMonthRequests }, { data: holidayRows }] = await Promise.all([
    supabase.rpc("leave_settings"),
    supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, days_count, reason, status, exceeds_quota, decision_note")
      .eq("employee_id", employee.id)
      .order("start_date", { ascending: false })
      .limit(30),
    // ดึงแยกเฉพาะคำขอที่คาบเกี่ยวเดือนนี้ เพื่อให้ยอดโควตาถูกเสมอ ไม่ขึ้นกับ limit ของรายการด้านบน
    supabase
      .from("leave_requests")
      .select("start_date, end_date, status")
      .eq("employee_id", employee.id)
      .lte("start_date", endOfMonth(today))
      .gte("end_date", startOfMonth(today)),
    // วันหยุดนักขัตฤกษ์ช่วงที่ยื่นลาได้ (ใช้คำนวณจำนวนวันในฟอร์ม + โควตาเดือนนี้)
    supabase
      .from("holidays")
      .select("holiday_date, name")
      .gte("holiday_date", startOfMonth(addDays(today, -31)))
      .lte("holiday_date", addMonths(today, 14))
      .order("holiday_date"),
  ]);
  const holidays = (holidayRows ?? []).map((row) => row.holiday_date);

  const settings = settingsRows?.[0];
  if (!settings) {
    return (
      <div className="ht-card p-6">
        <p className="text-[#D64545]">ระบบยังไม่ได้ตั้งค่ากติกาการลา กรุณาติดต่อ HR</p>
      </div>
    );
  }

  const usedThisMonth = usedLeaveDaysInMonth(thisMonthRequests ?? [], today, new Set(holidays));
  const monthLabel = new Date(`${today}T00:00:00Z`).toLocaleDateString("th-TH", { month: "long", timeZone: "UTC" });

  // หัวหน้าแผนก: การลาของลูกทีม (RLS ให้หัวหน้าเห็นเฉพาะทีมกลุ่มเดียวกันอยู่แล้ว)
  const isHead = employee.role === "head";
  const { data: teamRows } = isHead
    ? await supabase
        .from("leave_requests")
        .select("id, leave_type, start_date, end_date, days_count, status, employee:employees!leave_requests_employee_id_fkey(full_name)")
        .neq("employee_id", employee.id)
        .in("status", ["pending", "approved"])
        .gte("end_date", today)
        .lte("start_date", addDays(today, 30))
        .order("start_date")
    : { data: null };
  const team = teamLeaveSections(
    (teamRows ?? []).map((r) => ({
      id: r.id,
      employeeName: r.employee?.full_name ?? "-",
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status,
      leaveType: r.leave_type,
      daysCount: r.days_count,
    })),
    today,
  );

  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarDays} sticker="calendar" title="ขอลา" description="ลาป่วย ลากิจ ลาพักร้อน · ติดตามสถานะคำขอได้ที่นี่" />

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          <QuotaCard quota={settings.monthly_quota_days} used={usedThisMonth} monthLabel={monthLabel} />
          <LeaveRequestForm
            today={today}
            holidays={holidays}
            settings={{
              monthlyQuotaDays: settings.monthly_quota_days,
              advanceNoticeMonths: settings.advance_notice_months,
              sickBackdateDays: settings.sick_backdate_days,
            }}
          />
        </div>
        <div className="space-y-6">
          {isHead ? <TeamLeaveCard today={team.today} upcoming={team.upcoming} /> : null}
          <MyLeaveList requests={requests ?? []} />
        </div>
      </div>
    </div>
  );
}
