import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { bangkokToday, endOfMonth, formatThaiDate, startOfMonth } from "@/lib/date";
import { leaveTypeLabel, usedLeaveDaysInMonth } from "@/lib/leave/logic";
import { ExceedsQuotaBadge, LeaveStatusBadge } from "@/components/features/leave-status-badge";
import { LeaveRequestForm } from "./leave-request-form";

export default async function LeavePage() {
  // ทุกคนที่ล็อกอินยื่นลาได้ จึงไม่ต้อง requirePermission() (layout.tsx กันคนไม่มีบัญชีไว้แล้ว)
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  // อ่านผ่าน client ปกติ เพราะ RLS ให้พนักงานเห็นคำขอของตัวเองอยู่แล้ว
  const supabase = await createClient();
  const today = bangkokToday();

  const [{ data: settingsRows }, { data: requests }, { data: thisMonthRequests }] = await Promise.all([
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
  ]);

  const settings = settingsRows?.[0];
  if (!settings) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-[#D64545]">ระบบยังไม่ได้ตั้งค่ากติกาการลา กรุณาติดต่อ HR</p>
      </div>
    );
  }

  const usedThisMonth = usedLeaveDaysInMonth(thisMonthRequests ?? [], today);
  const remaining = Math.max(settings.monthly_quota_days - usedThisMonth, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5B6B7B]">วันลาเดือนนี้ (รวมคำขอที่รออนุมัติ)</p>
        <p className="mt-1 text-[#1A1A1A]">
          ใช้ไป <span className="text-xl font-semibold">{usedThisMonth}</span> จาก {settings.monthly_quota_days} วัน ·
          เหลือ{" "}
          <span className={`text-xl font-semibold ${remaining === 0 ? "text-[#D64545]" : "text-[#2E9E5B]"}`}>
            {remaining}
          </span>{" "}
          วัน
        </p>
        <p className="mt-1 text-xs text-[#5B6B7B]">โควตารวมทุกประเภทการลา ยกยอดไปเดือนถัดไปไม่ได้</p>
      </div>

      <LeaveRequestForm
        today={today}
        settings={{
          monthlyQuotaDays: settings.monthly_quota_days,
          advanceNoticeMonths: settings.advance_notice_months,
          sickBackdateDays: settings.sick_backdate_days,
        }}
      />

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-[#1A1A1A]">คำขอลาของฉัน</h2>
        {!requests || requests.length === 0 ? (
          <p className="text-sm text-[#5B6B7B]">ยังไม่มีคำขอลา</p>
        ) : (
          <ul className="divide-y divide-[#5B6B7B]/10 text-sm">
            {requests.map((request) => (
              <li key={request.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[#1A1A1A]">
                    {leaveTypeLabel(request.leave_type)} · {request.days_count} วัน
                  </span>
                  <span className="flex gap-1">
                    {request.exceeds_quota ? <ExceedsQuotaBadge /> : null}
                    <LeaveStatusBadge status={request.status} />
                  </span>
                </div>
                <p className="text-[#5B6B7B]">
                  {formatThaiDate(request.start_date)}
                  {request.end_date !== request.start_date ? ` – ${formatThaiDate(request.end_date)}` : ""}
                </p>
                {request.reason ? <p className="text-[#5B6B7B]">เหตุผล: {request.reason}</p> : null}
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
