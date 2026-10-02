import { History, LogIn, LogOut, MapPin } from "lucide-react";
import { formatThaiDate } from "@/lib/date";
import { EmptyState } from "@/components/features/empty-state";
import type { AttendanceDay } from "@/lib/attendance/logic";

// ชิ้นส่วนหน้าตาของหน้าเช็คอิน (รับข้อมูลที่โหลดแล้ว)

export function TodayTimes({ checkIn, checkOut }: { checkIn: string | null; checkOut: string | null }) {
  const tiles = [
    { label: "เข้างานวันนี้", value: checkIn, icon: LogIn, className: "bg-[#2E9E5B]/10 text-[#2E9E5B]" },
    { label: "เลิกงานวันนี้", value: checkOut, icon: LogOut, className: "bg-[#1E5FA8]/10 text-[#1E5FA8]" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map(({ label, value, icon: Icon, className }) => (
        <div key={label} className="rounded-3xl border border-[#1E5FA8]/5 bg-white p-5 shadow-sm">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${className}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-xs text-[#5B6B7B]">{label}</p>
          <p className={`text-3xl font-bold tabular-nums ${value ? "text-[#1A1A1A]" : "text-[#5B6B7B]/40"}`}>{value ?? "--:--"}</p>
        </div>
      ))}
    </div>
  );
}

export function AttendanceTimeline({ days }: { days: AttendanceDay[] }) {
  return (
    <section className="rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-[#1A1A1A]">
        <History className="h-5 w-5 text-[#1E5FA8]" aria-hidden />
        ประวัติล่าสุด
      </h2>
      {days.length === 0 ? (
        <EmptyState sticker="alarm-clock">ยังไม่มีประวัติ</EmptyState>
      ) : (
        <div className="space-y-5">
          {days.map((day) => (
            <div key={day.date}>
              <p className="mb-2 text-sm font-semibold text-[#1A1A1A]">{formatThaiDate(day.date)}</p>
              <ol className="relative ml-2 space-y-3 border-l-2 border-[#EAF3FC] pl-5">
                {day.entries.map((e) => {
                  const isIn = e.type === "check_in";
                  return (
                    <li key={e.id} className="relative flex items-center justify-between gap-3 text-sm">
                      <span
                        className={`absolute -left-[29px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${isIn ? "bg-[#2E9E5B]" : "bg-[#1E5FA8]"}`}
                        aria-hidden
                      />
                      <span className="text-[#1A1A1A]">
                        <span className="font-semibold tabular-nums">{e.time}</span> · {isIn ? "เช็คอิน" : "เช็คเอาท์"}
                      </span>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          e.within_radius ? "bg-[#2E9E5B]/10 text-[#2E9E5B]" : "bg-[#D64545]/10 text-[#D64545]"
                        }`}
                      >
                        <MapPin className="h-3 w-3" aria-hidden />
                        {Math.round(e.distance_meters)} ม.
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
