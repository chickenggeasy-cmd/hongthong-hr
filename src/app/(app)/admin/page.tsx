import { requirePermission } from "@/lib/auth/require-permission";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { bangkokToday, formatThaiDate } from "@/lib/date";
import { SETTING_DEFINITIONS, SETTING_GROUPS } from "@/lib/admin/settings";
import {
  AddHolidayForm,
  DeleteHolidayButton,
  SettingsForm,
} from "./admin-forms";
import { CardHeading } from "@/components/features/card-heading";
import { auditActionLabel, auditDetailsText } from "@/lib/audit/labels";

// เวลาแสดงตามเวลาไทยเสมอ (เซิร์ฟเวอร์อาจอยู่โซนเวลาอื่น)
const AUDIT_TIME = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminPage() {
  await requirePermission("admin.view");

  // app_settings ปิดสิทธิ์ authenticated ทั้งตาราง จึงอ่านด้วย service role (ผ่าน requirePermission แล้ว)
  const service = createServiceClient();
  const supabase = await createClient();
  const today = bangkokToday();
  const [{ data: settingRows }, { data: holidays }, { data: auditRows }] =
    await Promise.all([
      service.from("app_settings").select("key, value"),
      supabase
        .from("holidays")
        .select("holiday_date, name")
        .gte("holiday_date", `${today.slice(0, 4)}-01-01`)
        .order("holiday_date"),
      // RLS ให้ HR/ผู้บริหารอ่าน audit_logs ได้ ใช้ client ปกติ
      supabase
        .from("audit_logs")
        .select(
          "id, action, target, details, created_at, actor:employees!audit_logs_actor_id_fkey(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  // งานเกี่ยวกับพนักงานเก็บ target เป็น id แปลงเป็นชื่อให้อ่านง่าย
  const employeeIds = [
    ...new Set(
      (auditRows ?? [])
        .filter(
          (r) =>
            r.action.startsWith("employee.") || r.action === "warning.issue",
        )
        .map((r) => r.target ?? ""),
    ),
  ].filter((id) => /^[0-9a-f-]{36}$/.test(id));
  const { data: targetEmployees } = employeeIds.length
    ? await supabase
        .from("employees")
        .select("id, full_name, employee_code")
        .in("id", employeeIds)
    : { data: [] };
  const employeeName = new Map(
    (targetEmployees ?? []).map((e) => [
      e.id,
      `${e.full_name} (${e.employee_code})`,
    ]),
  );

  const values = Object.fromEntries(
    (settingRows ?? []).map((row) => [row.key, row.value]),
  );
  // แสดงเฉพาะค่าที่มีอยู่จริงในฐานข้อมูล (กรณียังไม่ได้รัน migration บางไฟล์)
  const groups = SETTING_GROUPS.map((name) => ({
    name,
    items: SETTING_DEFINITIONS.filter(
      (d) => d.group === name && d.key in values,
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        photo="market"
        icon={Settings}
        title="ตั้งค่าระบบ"
        description="แก้กติกาบริษัทได้โดยไม่ต้องแก้โปรแกรม มีผลกับการคำนวณครั้งถัดไปทันที (งวดที่ปิดแล้วไม่ถูกคำนวณใหม่)"
      />

      <SettingsForm groups={groups} values={values} />

      <section className="ht-card p-6">
        <CardHeading sticker="sun" className="mb-2">
          วันหยุดนักขัตฤกษ์
        </CardHeading>
        <p className="mb-4 text-sm text-[#5B6B7B]">
          ไม่นับเป็นวันลา ขอ OT ไม่ได้ และได้รับค่าจ้างตามปกติแม้ไม่ได้มาทำงาน
        </p>
        <AddHolidayForm />
        {!holidays || holidays.length === 0 ? (
          <p className="mt-4 text-sm text-[#5B6B7B]">ยังไม่มีวันหยุดของปีนี้</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#5B6B7B]/10 text-sm">
            {holidays.map((holiday) => (
              <li
                key={holiday.holiday_date}
                className="flex items-center justify-between py-2"
              >
                <span
                  className={
                    holiday.holiday_date < today
                      ? "text-[#5B6B7B]"
                      : "text-[#1A1A1A]"
                  }
                >
                  {formatThaiDate(holiday.holiday_date)} · {holiday.name}
                </span>
                <DeleteHolidayButton date={holiday.holiday_date} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ht-card p-6">
        <CardHeading
          sticker="clipboard"
          description="30 รายการล่าสุด · ใคร ทำอะไร เมื่อไหร่ (แก้ไขย้อนหลังไม่ได้)"
        >
          ประวัติการแก้ไข
        </CardHeading>
        {!auditRows || auditRows.length === 0 ? (
          <p className="text-sm text-[#5B6B7B]">ยังไม่มีประวัติ</p>
        ) : (
          <ul className="divide-y divide-[#5B6B7B]/10 text-sm">
            {auditRows.map((row) => {
              const detailText = auditDetailsText(row.details);
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <span className="shrink-0 tabular-nums text-xs text-[#5B6B7B] sm:w-36">
                    {AUDIT_TIME.format(new Date(row.created_at))}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold text-[#1A1A1A]">
                      {auditActionLabel(row.action)}
                    </span>
                    {row.target ? (
                      <span className="text-[#1A1A1A]">
                        {" "}
                        · {employeeName.get(row.target) ?? row.target}
                      </span>
                    ) : null}
                    <span className="text-[#5B6B7B]">
                      {" "}
                      · โดย {row.actor?.full_name ?? "-"}
                    </span>
                    {detailText ? (
                      <span className="block break-words text-xs text-[#5B6B7B]">
                        {detailText}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
