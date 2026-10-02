import { numberSetting, type SettingsRecord } from "../settings";

// กติกาจำกัดจำนวนครั้งล็อกอินผิด (logic ล้วน ไม่แตะฐานข้อมูล มีเทสต์ใน tests/login-throttle.test.ts)
//
// นับ 2 แบบพร้อมกัน:
//  - ต่อรหัสพนักงาน: กันการเดาเลขบัตรของคนใดคนหนึ่งทีละเลข
//  - ต่อ IP: กันการไล่ลองหลายรหัสจากเครื่องเดียว
// ผิดครบเกณฑ์ภายใน "lockMinutes" นาทีล่าสุด = ล็อก จนกว่าครั้งที่ผิดเก่าสุดจะพ้นช่วงเวลา
// นับเฉพาะครั้งที่ผิด ไม่สนว่ารหัสพนักงานมีอยู่จริงหรือไม่ จึงเดาไม่ได้ว่ารหัสไหนมีจริงจากการถูกล็อก

export type LoginThrottleSettings = {
  maxFailuresPerCode: number;
  maxFailuresPerIp: number;
  lockMinutes: number;
};

// ค่าตั้งต้นเผื่อยังไม่ได้รัน migration (ค่าจริงอยู่ในตาราง app_settings แก้ได้ที่หน้าตั้งค่า)
// ไม่ปล่อยให้ล็อกอินได้ไม่จำกัดเมื่อค่าหาย และไม่ล็อกทุกคนออกจากระบบ
export const DEFAULT_LOGIN_THROTTLE: LoginThrottleSettings = {
  maxFailuresPerCode: 5,
  maxFailuresPerIp: 20,
  lockMinutes: 15,
};

export function readLoginThrottleSettings(settings: SettingsRecord): LoginThrottleSettings {
  const pick = (key: string, fallback: number) => {
    const value = numberSetting(settings, key);
    return value !== null && Number.isInteger(value) && value >= 1 ? value : fallback;
  };
  return {
    maxFailuresPerCode: pick("login.max_failures_per_code", DEFAULT_LOGIN_THROTTLE.maxFailuresPerCode),
    maxFailuresPerIp: pick("login.max_failures_per_ip", DEFAULT_LOGIN_THROTTLE.maxFailuresPerIp),
    lockMinutes: pick("login.lock_minutes", DEFAULT_LOGIN_THROTTLE.lockMinutes),
  };
}

export function codeThrottleKey(employeeCode: string): string {
  return `code:${employeeCode}`;
}

export function ipThrottleKey(ip: string): string {
  return `ip:${ip}`;
}

const MAX_IP_LENGTH = 64;

/**
 * IP ของผู้ใช้จาก header ที่ proxy/โฮสต์ใส่มา (Vercel ใส่ x-forwarded-for ให้เสมอ)
 * เอาค่าแรกของ x-forwarded-for (เครื่องต้นทาง) ถ้าไม่มีใช้ x-real-ip ไม่มีทั้งคู่ = null (นับต่อรหัสอย่างเดียว)
 * หมายเหตุ: ถ้าเปิดเว็บตรงๆ โดยไม่ผ่าน proxy ที่เชื่อถือได้ ผู้ใช้ปลอม header นี้ได้ การนับต่อรหัสพนักงานจึงยังจำเป็น
 */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim();
  if (!ip || ip.length > MAX_IP_LENGTH) return null;
  return ip;
}

export type ThrottleRule = { key: string; maxFailures: number };

/** กุญแจที่ใช้นับสำหรับการล็อกอินครั้งนี้ (รหัสพนักงานที่รูปแบบไม่ถูกต้องไม่นับต่อรหัส) */
export function throttleRules(
  employeeCode: string | null,
  ip: string | null,
  settings: LoginThrottleSettings,
): ThrottleRule[] {
  const rules: ThrottleRule[] = [];
  if (employeeCode) rules.push({ key: codeThrottleKey(employeeCode), maxFailures: settings.maxFailuresPerCode });
  if (ip) rules.push({ key: ipThrottleKey(ip), maxFailures: settings.maxFailuresPerIp });
  return rules;
}

export type ThrottleDecision = { blocked: false } | { blocked: true; retryAfterSeconds: number };

/**
 * ตัดสินว่าตอนนี้ต้องล็อกหรือไม่
 * failures = ครั้งที่ผิดของแต่ละกุญแจ (เวลา ISO) ส่งมาเฉพาะช่วงล่าสุดหรือทั้งหมดก็ได้ ฟังก์ชันกรองช่วงเวลาเอง
 */
export function checkLoginThrottle(
  rules: readonly ThrottleRule[],
  failures: Readonly<Record<string, readonly string[]>>,
  lockMinutes: number,
  now: Date,
): ThrottleDecision {
  const windowMs = lockMinutes * 60_000;
  const nowMs = now.getTime();
  let retryAfterMs = 0;

  for (const rule of rules) {
    const recent = (failures[rule.key] ?? [])
      .map((iso) => new Date(iso).getTime())
      .filter((t) => Number.isFinite(t) && t > nowMs - windowMs && t <= nowMs)
      .sort((a, b) => a - b);
    if (recent.length < rule.maxFailures) continue;
    // ต้องรอให้ครั้งที่ผิดเก่าๆ พ้นช่วง จนเหลือน้อยกว่าเกณฑ์ (ครั้งที่ index = จำนวน − เกณฑ์ คือตัวที่ต้องรอ)
    const unlockAt = recent[recent.length - rule.maxFailures] + windowMs;
    retryAfterMs = Math.max(retryAfterMs, unlockAt - nowMs);
  }

  return retryAfterMs > 0 ? { blocked: true, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) } : { blocked: false };
}

/** ข้อความเดียวกันไม่ว่าจะถูกล็อกเพราะรหัสหรือเพราะ IP (ไม่บอกรายละเอียดที่ช่วยคนเดา) */
export function loginThrottleMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอประมาณ ${minutes} นาทีแล้วลองใหม่`;
}
