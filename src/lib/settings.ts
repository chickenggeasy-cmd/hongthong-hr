// ค่ากติกาจากตาราง app_settings (อ่านผ่าน public_settings() หรือ service role) เก็บเป็นข้อความทั้งหมด
// ตัวช่วยในไฟล์นี้แปลงเป็นชนิดข้อมูลที่ใช้คำนวณ และคืน null ถ้าค่าหาย/ผิดรูปแบบ (ให้หน้าเว็บแจ้ง HR แทนการคำนวณผิด)

export type SettingsRecord = Readonly<Record<string, string>>;

export function toSettingsRecord(rows: readonly { key: string; value: string }[] | null | undefined): SettingsRecord {
  return Object.fromEntries((rows ?? []).map((row) => [row.key, row.value]));
}

export function numberSetting(settings: SettingsRecord, key: string): number | null {
  const raw = settings[key];
  if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** เวลา HH:MM (24 ชั่วโมง) */
export function timeSetting(settings: SettingsRecord, key: string): string | null {
  const raw = settings[key]?.trim().slice(0, 5);
  return raw && TIME_PATTERN.test(raw) ? raw : null;
}

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}
