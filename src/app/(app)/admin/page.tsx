import { requirePermission } from "@/lib/auth/require-permission";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { bangkokToday, formatThaiDate } from "@/lib/date";
import { SETTING_DEFINITIONS, SETTING_GROUPS } from "@/lib/admin/settings";
import { AddHolidayForm, DeleteHolidayButton, SettingsForm } from "./admin-forms";

export default async function AdminPage() {
  await requirePermission("admin.view");

  // app_settings ปิดสิทธิ์ authenticated ทั้งตาราง จึงอ่านด้วย service role (ผ่าน requirePermission แล้ว)
  const service = createServiceClient();
  const supabase = await createClient();
  const today = bangkokToday();
  const [{ data: settingRows }, { data: holidays }] = await Promise.all([
    service.from("app_settings").select("key, value"),
    supabase
      .from("holidays")
      .select("holiday_date, name")
      .gte("holiday_date", `${today.slice(0, 4)}-01-01`)
      .order("holiday_date"),
  ]);

  const values = Object.fromEntries((settingRows ?? []).map((row) => [row.key, row.value]));
  // แสดงเฉพาะค่าที่มีอยู่จริงในฐานข้อมูล (กรณียังไม่ได้รัน migration บางไฟล์)
  const groups = SETTING_GROUPS.map((name) => ({
    name,
    items: SETTING_DEFINITIONS.filter((d) => d.group === name && d.key in values),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        sticker="gear"
        title="ตั้งค่าระบบ"
        description="แก้กติกาบริษัทได้โดยไม่ต้องแก้โปรแกรม มีผลกับการคำนวณครั้งถัดไปทันที (งวดที่ปิดแล้วไม่ถูกคำนวณใหม่)"
      />

      <SettingsForm groups={groups} values={values} />

      <section className="rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-semibold text-[#1A1A1A]">วันหยุดนักขัตฤกษ์</h2>
        <p className="mb-4 text-sm text-[#5B6B7B]">
          ไม่นับเป็นวันลา ขอ OT ไม่ได้ และได้รับค่าจ้างตามปกติแม้ไม่ได้มาทำงาน
        </p>
        <AddHolidayForm />
        {!holidays || holidays.length === 0 ? (
          <p className="mt-4 text-sm text-[#5B6B7B]">ยังไม่มีวันหยุดของปีนี้</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#5B6B7B]/10 text-sm">
            {holidays.map((holiday) => (
              <li key={holiday.holiday_date} className="flex items-center justify-between py-2">
                <span className={holiday.holiday_date < today ? "text-[#5B6B7B]" : "text-[#1A1A1A]"}>
                  {formatThaiDate(holiday.holiday_date)} · {holiday.name}
                </span>
                <DeleteHolidayButton date={holiday.holiday_date} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
