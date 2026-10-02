import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_THROTTLE,
  checkLoginThrottle,
  clientIp,
  codeThrottleKey,
  ipThrottleKey,
  loginThrottleMessage,
  readLoginThrottleSettings,
  throttleRules,
} from "../src/lib/auth/login-throttle";

const NOW = new Date("2026-10-04T03:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const SETTINGS = { maxFailuresPerCode: 5, maxFailuresPerIp: 20, lockMinutes: 15 };
const headersOf = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });

describe("readLoginThrottleSettings", () => {
  it("อ่านค่าจาก app_settings", () => {
    expect(
      readLoginThrottleSettings({ "login.max_failures_per_code": "3", "login.max_failures_per_ip": "10", "login.lock_minutes": "30" }),
    ).toEqual({ maxFailuresPerCode: 3, maxFailuresPerIp: 10, lockMinutes: 30 });
  });

  it("ค่าหาย/ผิดรูปแบบ/ไม่ใช่จำนวนเต็มบวก ใช้ค่าตั้งต้น (ไม่ปล่อยให้ลองได้ไม่จำกัด)", () => {
    expect(readLoginThrottleSettings({})).toEqual(DEFAULT_LOGIN_THROTTLE);
    expect(
      readLoginThrottleSettings({ "login.max_failures_per_code": "abc", "login.max_failures_per_ip": "0", "login.lock_minutes": "2.5" }),
    ).toEqual(DEFAULT_LOGIN_THROTTLE);
  });
});

describe("clientIp", () => {
  it("เอาค่าแรกของ x-forwarded-for", () => {
    expect(clientIp(headersOf({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
  });

  it("ไม่มี x-forwarded-for ใช้ x-real-ip", () => {
    expect(clientIp(headersOf({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("ไม่มีเลย หรือยาวผิดปกติ = null", () => {
    expect(clientIp(headersOf({}))).toBeNull();
    expect(clientIp(headersOf({ "x-forwarded-for": "x".repeat(200) }))).toBeNull();
  });
});

describe("throttleRules", () => {
  it("นับทั้งต่อรหัสและต่อ IP", () => {
    expect(throttleRules("69200001", "1.2.3.4", SETTINGS)).toEqual([
      { key: codeThrottleKey("69200001"), maxFailures: 5 },
      { key: ipThrottleKey("1.2.3.4"), maxFailures: 20 },
    ]);
  });

  it("ไม่รู้ IP นับต่อรหัสอย่างเดียว", () => {
    expect(throttleRules("69200001", null, SETTINGS)).toEqual([{ key: "code:69200001", maxFailures: 5 }]);
  });
});

describe("checkLoginThrottle", () => {
  const rules = throttleRules("69200001", "1.2.3.4", SETTINGS);

  it("ผิดยังไม่ครบเกณฑ์ ล็อกอินได้", () => {
    const failures = { "code:69200001": [1, 2, 3, 4].map(minutesAgo) };
    expect(checkLoginThrottle(rules, failures, 15, NOW)).toEqual({ blocked: false });
  });

  it("ผิดครบ 5 ครั้งใน 15 นาที ถูกล็อกจนครั้งเก่าสุดพ้นช่วง", () => {
    const failures = { "code:69200001": [10, 8, 6, 4, 2].map(minutesAgo) };
    // ครั้งเก่าสุด 10 นาทีที่แล้ว จะพ้นช่วง 15 นาทีในอีก 5 นาที
    expect(checkLoginThrottle(rules, failures, 15, NOW)).toEqual({ blocked: true, retryAfterSeconds: 300 });
  });

  it("ครั้งที่เก่ากว่าช่วงเวลาไม่นับ", () => {
    const failures = { "code:69200001": [40, 30, 20, 3, 2].map(minutesAgo) };
    expect(checkLoginThrottle(rules, failures, 15, NOW)).toEqual({ blocked: false });
  });

  it("ผิดเกินเกณฑ์ไปหลายครั้ง ต้องรอจนเหลือน้อยกว่าเกณฑ์", () => {
    const failures = { "code:69200001": [14, 12, 10, 8, 6, 4, 2].map(minutesAgo) };
    // 7 ครั้ง เกณฑ์ 5: ต้องรอให้ 3 ครั้งแรกพ้น (ครั้ง 10 นาทีที่แล้วพ้นในอีก 5 นาที)
    expect(checkLoginThrottle(rules, failures, 15, NOW)).toEqual({ blocked: true, retryAfterSeconds: 300 });
  });

  it("ล็อกเพราะ IP แม้แต่ละรหัสยังผิดไม่ครบ", () => {
    const failures = { "ip:1.2.3.4": Array.from({ length: 20 }, (_, i) => minutesAgo(14 - i * 0.5)) };
    expect(checkLoginThrottle(rules, failures, 15, NOW)).toEqual({ blocked: true, retryAfterSeconds: 60 });
  });

  it("ถูกล็อกทั้ง 2 แบบ ใช้เวลารอที่นานกว่า", () => {
    const failures = {
      "code:69200001": [5, 4, 3, 2, 1].map(minutesAgo),
      "ip:1.2.3.4": Array.from({ length: 20 }, () => minutesAgo(14)),
    };
    expect(checkLoginThrottle(rules, failures, 15, NOW)).toEqual({ blocked: true, retryAfterSeconds: 600 });
  });

  it("กุญแจอื่นที่ไม่เกี่ยวข้องไม่มีผล และวันที่ผิดรูปแบบถูกข้าม", () => {
    const failures = {
      "code:69310001": [5, 4, 3, 2, 1].map(minutesAgo),
      "code:69200001": ["not-a-date", minutesAgo(1)],
    };
    expect(checkLoginThrottle(rules, failures, 15, NOW)).toEqual({ blocked: false });
  });
});

describe("loginThrottleMessage", () => {
  it("ปัดขึ้นเป็นนาที อย่างน้อย 1 นาที", () => {
    expect(loginThrottleMessage(300)).toContain("5 นาที");
    expect(loginThrottleMessage(61)).toContain("2 นาที");
    expect(loginThrottleMessage(10)).toContain("1 นาที");
  });
});
