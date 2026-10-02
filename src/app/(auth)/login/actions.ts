"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  deriveLoginPassword,
  employeeEmail,
  isValidEmployeeCode,
  isValidThaiNationalId,
  normalizeNationalId,
} from "@/lib/auth/national-id";
import {
  checkLoginThrottle,
  clientIp,
  codeThrottleKey,
  loginThrottleMessage,
  readLoginThrottleSettings,
  throttleRules,
} from "@/lib/auth/login-throttle";
import { toSettingsRecord } from "@/lib/settings";

export type LoginState = { error: string | null };

// ข้อความ error เดียวกันทุกกรณี (รูปแบบผิด / ไม่พบรหัสพนักงาน / เลขบัตรไม่ตรง)
// เพื่อไม่ให้เดารหัสพนักงานที่มีอยู่จริงได้จากข้อความ error ที่ต่างกัน
const INVALID_MESSAGE = "รหัสพนักงานหรือเลขบัตรประชาชนไม่ถูกต้อง";

// เก็บประวัติล็อกอินผิดไว้ 1 วัน (เท่ากับช่วงล็อกยาวสุดที่หน้าตั้งค่ายอมให้ตั้ง = 1,440 นาที)
const KEEP_FAILURES_MS = 24 * 60 * 60 * 1000;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  const nationalId = normalizeNationalId(String(formData.get("nationalId") ?? ""));

  if (!isValidEmployeeCode(employeeCode) || !isValidThaiNationalId(nationalId)) {
    return { error: INVALID_MESSAGE };
  }

  // ---------- จำกัดจำนวนครั้งล็อกอินผิด ----------
  // ข้อยกเว้นของกฎ "ตรวจตัวตนก่อนใช้ service role": ตอนล็อกอินยังไม่มีผู้ใช้ให้ตรวจ
  // ใช้ service role กับตาราง login_failures เท่านั้น และกุญแจมาจากรหัสที่ตรวจรูปแบบแล้ว + IP จาก header ของเซิร์ฟเวอร์
  const service = createServiceClient();
  const ip = clientIp(await headers());
  const { data: settingRows } = await service.from("app_settings").select("key, value").like("key", "login.%");
  const throttle = readLoginThrottleSettings(toSettingsRecord(settingRows));
  const rules = throttleRules(employeeCode, ip, throttle);
  const now = new Date();

  const { data: failures, error: throttleError } = await service
    .from("login_failures")
    .select("throttle_key, failed_at")
    .in(
      "throttle_key",
      rules.map((r) => r.key),
    )
    .gt("failed_at", new Date(now.getTime() - throttle.lockMinutes * 60_000).toISOString())
    .limit(1000);

  if (throttleError) {
    // อ่านตารางไม่ได้ (เช่น ยังไม่ได้ db push) ให้ล็อกอินต่อได้ ไม่ล็อกทุกคนออกจากระบบ แต่บันทึกไว้ให้ผู้ดูแลเห็น
    console.error("login throttle check failed:", throttleError.message);
  } else {
    const byKey: Record<string, string[]> = {};
    for (const row of failures ?? []) (byKey[row.throttle_key] ??= []).push(row.failed_at);
    const decision = checkLoginThrottle(rules, byKey, throttle.lockMinutes, now);
    if (decision.blocked) {
      return { error: loginThrottleMessage(decision.retryAfterSeconds) };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: employeeEmail(employeeCode),
    password: deriveLoginPassword(employeeCode, nationalId),
  });

  if (error) {
    await service.from("login_failures").insert(rules.map((r) => ({ throttle_key: r.key })));
    await service
      .from("login_failures")
      .delete()
      .lt("failed_at", new Date(now.getTime() - KEEP_FAILURES_MS).toISOString());
    return { error: INVALID_MESSAGE };
  }

  // ล็อกอินสำเร็จ: ล้างประวัติผิดของรหัสนี้ (ไม่ล้างของ IP เพราะคนที่มีบัญชีจริง 1 บัญชีจะใช้ล้างตัวนับ IP ไม่ได้)
  await service.from("login_failures").delete().eq("throttle_key", codeThrottleKey(employeeCode));

  redirect("/");
}
