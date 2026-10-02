import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CheckCheck,
  Crown,
  FileSpreadsheet,
  Hourglass,
  ReceiptText,
  Settings,
  Timer,
  TriangleAlert,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { DotPattern, WarehouseScene } from "@/components/brand/illustrations";
import { LiveClock } from "@/components/features/live-clock";
import { roleLabel } from "@/lib/permissions";
import { formatBaht, periodLabel } from "@/lib/payroll/logic";
import { TODAY_STATUS_LABEL_TH, type TodayStatus } from "@/lib/team/logic";
import { warningKindLabel } from "@/lib/warnings/logic";
import { AcknowledgeButton } from "./warnings/warning-forms";

// หน้าตาแดชบอร์ดหน้าแรก (รับข้อมูลที่โหลดเสร็จแล้วจาก page.tsx ไม่ยิงฐานข้อมูลเอง)

export type DashboardData = {
  nowIso: string;
  dateLabel: string;
  greeting: string;
  employee: { fullName: string; employeeCode: string; deptName: string; role: string };
  todayStatus: TodayStatus;
  holidayToday: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nextAction: "เช็คอิน" | "เช็คเอาท์";
  leave: { quota: number | null; used: number };
  myPending: { leaves: number; ots: number };
  latestPayslip: { id: string; netPay: number; period: string } | null;
  warnings: { id: string; kind: string; reason: string }[];
  approvals: { decidable: number; total: number; leaves: number; ots: number; executiveOnly: number | null } | null;
  overview: { title: string; total: number; present: number; late: number; leave: number; absent: number } | null;
  payroll: { period: string; status: "none" | "draft" | "finalized" } | null;
  showHrShortcuts: boolean;
};

const STATUS_PILL: Record<TodayStatus, string> = {
  working: "bg-[#2E9E5B] text-white",
  late: "bg-[#E8890C] text-white",
  checked_out: "bg-white text-[#1E5FA8]",
  on_leave: "bg-[#5BA4E6] text-white",
  not_yet: "bg-white/15 text-white",
  absent: "bg-[#D64545] text-white",
  day_off: "bg-white/15 text-white",
};

function SectionTitle({ children, href, linkLabel }: { children: ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold text-[#1A1A1A]">
        <span className="h-5 w-1 rounded-full bg-[#D4A017]" aria-hidden />
        {children}
      </h2>
      {href ? (
        <Link href={href} className="group flex items-center gap-1 text-sm font-medium text-[#1E5FA8]">
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function KpiTile({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
  href,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-[#1E5FA8]/5 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#1E5FA8]/10"
    >
      <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-xs text-[#5B6B7B]">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-[#1A1A1A]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[#5B6B7B]">{hint}</p> : null}
      <ArrowRight
        className="absolute right-4 top-4 h-4 w-4 text-[#5B6B7B]/0 transition-all group-hover:text-[#1E5FA8]"
        aria-hidden
      />
    </Link>
  );
}

function ShortcutTile({ icon: Icon, label, hint, href }: { icon: LucideIcon; label: string; hint: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-[#1E5FA8]/5 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D4A017]/40 hover:shadow-lg hover:shadow-[#1E5FA8]/10"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E5FA8] to-[#164A85] text-white shadow-sm transition-transform group-hover:scale-105">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-[#1A1A1A]">{label}</span>
        <span className="block truncate text-xs text-[#5B6B7B]">{hint}</span>
      </span>
    </Link>
  );
}

// ลำดับสีผ่านการตรวจสำหรับผู้ที่ตาบอดสีแล้ว (เขียว→ฟ้า→ส้ม→แดง) มีตัวเลข+ข้อความกำกับทุกส่วนเสมอ
const ATTENDANCE_SEGMENTS = [
  { key: "present", label: "มาตรงเวลา", color: "#2E9E5B" },
  { key: "leave", label: "ลา", color: "#1E5FA8" },
  { key: "late", label: "มาสาย", color: "#E8890C" },
  { key: "absent", label: "ยังไม่มา", color: "#D64545" },
] as const;

function AttendanceCard({ overview }: { overview: NonNullable<DashboardData["overview"]> }) {
  const counts = {
    present: overview.present - overview.late,
    leave: overview.leave,
    late: overview.late,
    absent: overview.absent,
  };
  const arrived = overview.present;
  const rate = overview.total > 0 ? Math.round((arrived / overview.total) * 100) : 0;

  return (
    <section className="rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#5B6B7B]">มาทำงานแล้ววันนี้</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-[#1A1A1A]">
            {arrived}
            <span className="text-lg font-medium text-[#5B6B7B]"> / {overview.total} คน</span>
          </p>
        </div>
        <p className="rounded-full bg-[#EAF3FC] px-3 py-1 text-sm font-semibold text-[#1E5FA8]">อัตราการมาทำงาน {rate}%</p>
      </div>

      {overview.total > 0 ? (
        <div className="mt-5 flex h-3 gap-[2px] overflow-hidden rounded-full bg-[#5B6B7B]/10" role="img" aria-label="สัดส่วนสถานะการมาทำงานวันนี้">
          {ATTENDANCE_SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${counts[s.key]} คน`}
              className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(counts[s.key] / overview.total) * 100}%`, backgroundColor: s.color }}
            />
          ))}
        </div>
      ) : null}

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ATTENDANCE_SEGMENTS.map((s) => (
          <li key={s.key} className="rounded-2xl bg-[#F7FAFD] p-3">
            <p className="flex items-center gap-2 text-xs text-[#5B6B7B]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-[#1A1A1A]">
              {counts[s.key]} <span className="text-sm font-normal text-[#5B6B7B]">คน</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DashboardView({ data }: { data: DashboardData }) {
  const { employee } = data;
  const remainingLeave = data.leave.quota === null ? null : Math.max(data.leave.quota - data.leave.used, 0);
  const pendingMine = data.myPending.leaves + data.myPending.ots;

  return (
    <div className="space-y-8">
      {/* ---------- แบนเนอร์ทักทาย ---------- */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1E5FA8] via-[#18528F] to-[#0F3B6E] text-white shadow-xl shadow-[#1E5FA8]/20 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <DotPattern className="absolute inset-0 h-full w-full text-white/[0.07]" />
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#D4A017] via-[#F0C75E] to-[#D4A017]" aria-hidden />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#5BA4E6]/20 blur-3xl" aria-hidden />
        <div className="relative grid items-center gap-4 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm text-white/75">
              {data.greeting} · {data.dateLabel}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{employee.fullName}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/80">
              <span>
                {employee.employeeCode} · {employee.deptName}
              </span>
              <span className="rounded-full bg-[#D4A017] px-2.5 py-0.5 text-xs font-semibold text-[#1A1A1A]">
                {roleLabel(employee.role)}
              </span>
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="rounded-2xl bg-white/10 px-4 py-2 ring-1 ring-white/15 backdrop-blur">
                <p className="text-[11px] uppercase tracking-wider text-white/60">เวลาขณะนี้</p>
                <p className="text-2xl font-bold">
                  <LiveClock initialIso={data.nowIso} />
                </p>
              </div>
              <div className="space-y-1">
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_PILL[data.todayStatus]}`}>
                  {data.holidayToday ? `วันหยุด: ${data.holidayToday}` : TODAY_STATUS_LABEL_TH[data.todayStatus]}
                </span>
                <p className="text-sm text-white/75">
                  {data.checkIn ? `เข้างาน ${data.checkIn}` : "ยังไม่เช็คอินวันนี้"}
                  {data.checkOut ? ` · ออก ${data.checkOut}` : ""}
                </p>
              </div>
            </div>

            <Link
              href="/attendance"
              className="group mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-[#1E5FA8] shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              {data.nextAction}เลย
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>
          <WarehouseScene className="hidden w-[360px] max-w-full drop-shadow-xl md:block" />
        </div>
      </section>

      {/* ---------- ใบเตือนที่ยังไม่รับทราบ ---------- */}
      {data.warnings.length > 0 ? (
        <section className="rounded-3xl border border-[#D64545]/25 bg-gradient-to-br from-[#D64545]/[0.06] to-white p-5">
          <p className="flex items-center gap-2 font-bold text-[#D64545]">
            <TriangleAlert className="h-5 w-5" aria-hidden />
            คุณมีใบเตือน {data.warnings.length} ใบที่ยังไม่ได้รับทราบ
          </p>
          <ul className="mt-3 space-y-2">
            {data.warnings.map((w) => (
              <li key={w.id} className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3 text-sm shadow-sm">
                <div>
                  <p className="font-semibold text-[#1A1A1A]">{warningKindLabel(w.kind)}</p>
                  <p className="text-[#5B6B7B]">{w.reason}</p>
                </div>
                <AcknowledgeButton warningId={w.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------- ของฉัน ---------- */}
      <section>
        <SectionTitle>ของฉัน</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            icon={CalendarCheck}
            iconClass="bg-[#2E9E5B]/10 text-[#2E9E5B]"
            label="วันลาคงเหลือเดือนนี้"
            value={remainingLeave === null ? "-" : `${remainingLeave} วัน`}
            hint={data.leave.quota === null ? undefined : `ใช้ไป ${data.leave.used} จาก ${data.leave.quota} วัน`}
            href="/leave"
          />
          <KpiTile
            icon={Hourglass}
            iconClass="bg-[#E8890C]/10 text-[#E8890C]"
            label="คำขอรออนุมัติ"
            value={`${pendingMine} รายการ`}
            hint={`ลา ${data.myPending.leaves} · OT ${data.myPending.ots}`}
            href="/leave"
          />
          <KpiTile icon={Timer} iconClass="bg-[#1E5FA8]/10 text-[#1E5FA8]" label="ขอทำ OT" value="ยื่นคำขอ" hint="ต้องขอก่อนเวลาเลิกงาน" href="/ot" />
          <KpiTile
            icon={ReceiptText}
            iconClass="bg-[#D4A017]/15 text-[#9A7410]"
            label="สลิปล่าสุด"
            value={data.latestPayslip ? `${formatBaht(data.latestPayslip.netPay)} ฿` : "-"}
            hint={data.latestPayslip ? `งวด ${periodLabel(data.latestPayslip.period)}` : "ยังไม่มีสลิป"}
            href={data.latestPayslip ? `/payslip/${data.latestPayslip.id}` : "/payslip"}
          />
        </div>
      </section>

      {/* ---------- ภาพรวมวันนี้ + งานรออนุมัติ ---------- */}
      {data.overview || data.approvals ? (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          {data.overview ? (
            <div>
              <SectionTitle href="/team" linkLabel="ดูรายชื่อ">
                {data.overview.title}
              </SectionTitle>
              <AttendanceCard overview={data.overview} />
            </div>
          ) : null}
          {data.approvals ? (
            <div>
              <SectionTitle href="/approvals" linkLabel="ไปหน้าอนุมัติ">
                งานรออนุมัติ
              </SectionTitle>
              <div className="space-y-3">
                <Link
                  href="/approvals"
                  className="group block rounded-3xl bg-gradient-to-br from-[#1A1A1A] to-[#2B3440] p-6 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <p className="flex items-center gap-2 text-sm text-white/70">
                    <CheckCheck className="h-4 w-4" aria-hidden />
                    คุณอนุมัติได้ตอนนี้
                  </p>
                  <p className="mt-1 text-5xl font-bold">{data.approvals.decidable}</p>
                  <p className="mt-1 text-sm text-white/70">
                    จากที่รอทั้งบริษัท {data.approvals.total} รายการ (ลา {data.approvals.leaves} · OT {data.approvals.ots})
                  </p>
                </Link>
                {data.approvals.executiveOnly !== null ? (
                  <Link
                    href="/approvals"
                    className="flex items-center gap-3 rounded-3xl border-2 border-[#D4A017] bg-gradient-to-br from-[#FFF8E5] to-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D4A017] text-white">
                      <Crown className="h-5 w-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm text-[#5B6B7B]">จาก HR/การเงิน ที่ต้องให้คุณอนุมัติเท่านั้น</span>
                      <span className="block text-2xl font-bold text-[#1A1A1A]">{data.approvals.executiveOnly} รายการ</span>
                    </span>
                  </Link>
                ) : (
                  <p className="rounded-2xl bg-white p-4 text-sm text-[#5B6B7B] shadow-sm">
                    รอผู้บริหารอนุมัติ {data.approvals.total - data.approvals.decidable} รายการ (คำขอของ 01/HR/ผู้บริหาร หรือของคุณเอง)
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ---------- เงินเดือน + ทางลัด HR ---------- */}
      {data.payroll || data.showHrShortcuts ? (
        <section>
          <SectionTitle>เครื่องมือบริหาร</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.payroll ? (
              <Link
                href={`/payroll?period=${data.payroll.period}`}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#D4A017] to-[#B8860B] p-4 text-[#1A1A1A] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg sm:col-span-2 lg:col-span-1"
              >
                <Wallet className="absolute -bottom-3 -right-3 h-24 w-24 text-white/20" aria-hidden />
                <p className="text-sm font-medium">เงินเดือนงวด {periodLabel(data.payroll.period)}</p>
                <p className="mt-1 text-2xl font-bold">
                  {data.payroll.status === "none" ? "ยังไม่คำนวณ" : data.payroll.status === "finalized" ? "ปิดงวดแล้ว ✓" : "ฉบับร่าง"}
                </p>
                <p className="mt-1 text-sm">ไปหน้าเงินเดือน →</p>
              </Link>
            ) : null}
            {data.payroll ? <ShortcutTile icon={FileSpreadsheet} label="รายงาน Excel" hint="เงินเดือน · เข้างาน · ลา/OT" href="/reports" /> : null}
            {data.showHrShortcuts ? (
              <>
                <ShortcutTile icon={UserPlus} label="พนักงาน" hint="ลงทะเบียนพนักงานใหม่" href="/employees" />
                <ShortcutTile icon={Users} label="ทีมทั้งบริษัท" hint="สถานะการมาทำงานรายคน" href="/team" />
                <ShortcutTile icon={TriangleAlert} label="ใบเตือน" hint="ออกอัตโนมัติ / ออกเอง" href="/warnings" />
                <ShortcutTile icon={Settings} label="ตั้งค่าระบบ" hint="อัตราค่าจ้าง · วันหยุด · พิกัด" href="/admin" />
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className="flex items-center justify-center gap-2 pb-2 text-xs text-[#5B6B7B]">
        <span className="h-1 w-6 rounded-full bg-[#D4A017]" aria-hidden />
        หงส์ทอง Cash &amp; Carry · ของดี ราคาส่ง เพื่อธุรกิจของคุณ
        <span className="h-1 w-6 rounded-full bg-[#D4A017]" aria-hidden />
      </footer>
    </div>
  );
}
