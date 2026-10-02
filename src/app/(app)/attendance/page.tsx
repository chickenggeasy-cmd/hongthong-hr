import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { nextAttendanceType, type AttendanceType } from "@/lib/attendance/logic";
import { CheckInForm } from "./check-in-form";

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
    .limit(10);

  const nextType = nextAttendanceType((logs?.[0]?.type as AttendanceType | undefined) ?? null);

  return (
    <div className="space-y-6">
      <CheckInForm nextType={nextType} />

      <div className="rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-[#1A1A1A]">ประวัติล่าสุด</h2>
        {!logs || logs.length === 0 ? (
          <p className="text-sm text-[#5B6B7B]">ยังไม่มีประวัติ</p>
        ) : (
          <ul className="divide-y divide-[#5B6B7B]/10 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between py-2">
                <span className="text-[#1A1A1A]">
                  {log.type === "check_in" ? "เช็คอิน" : "เช็คเอาท์"} ·{" "}
                  {new Date(log.recorded_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <span className={log.within_radius ? "text-[#2E9E5B]" : "text-[#D64545]"}>
                  {Math.round(log.distance_meters)} ม.
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}