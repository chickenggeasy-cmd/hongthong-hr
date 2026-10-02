import { Clock } from "lucide-react";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { bangkokToday } from "@/lib/date";
import { groupLogsByDay, nextAttendanceType, type AttendanceType } from "@/lib/attendance/logic";
import { PageHeader } from "@/components/features/page-header";
import { LiveClock } from "@/components/features/live-clock";
import { CheckInForm } from "./check-in-form";
import { AttendanceTimeline, TodayTimes } from "./attendance-view";

export default async function AttendancePage() {
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  // อ่านผ่าน client ปกติ (ไม่ใช่ service role) เพราะ RLS อนุญาตให้พนักงานเห็นประวัติของตัวเองอยู่แล้ว
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("attendance_logs")
    .select("id, type, recorded_at, within_radius, distance_meters")
    .eq("employee_id", employee.id)
    .order("recorded_at", { ascending: false })
    .limit(20);

  const nextType = nextAttendanceType((logs?.[0]?.type as AttendanceType | undefined) ?? null);
  const days = groupLogsByDay(logs ?? []);
  const todayEntries = days.find((d) => d.date === bangkokToday())?.entries ?? [];
  const checkIn = todayEntries.find((e) => e.type === "check_in")?.time ?? null;
  const checkOut = [...todayEntries].reverse().find((e) => e.type === "check_out")?.time ?? null;

  return (
    <div className="space-y-6">
      <PageHeader icon={Clock} sticker="alarm-clock" title="เช็คอิน / เช็คเอาท์" description="ยืนยันตำแหน่งด้วย GPS · เวลาบันทึกจากเซิร์ฟเวอร์">
        <p className="rounded-2xl bg-[#EAF3FC] px-4 py-2 text-2xl font-bold text-[#1E5FA8]">
          <LiveClock initialIso={new Date().toISOString()} />
        </p>
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <TodayTimes checkIn={checkIn} checkOut={checkOut} />
          <CheckInForm nextType={nextType} />
        </div>
        <AttendanceTimeline days={days} />
      </div>
    </div>
  );
}
