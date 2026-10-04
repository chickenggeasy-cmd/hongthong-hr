// กติการูปโปรไฟล์ (มีเทสต์ใน tests/profile-photo.test.ts)
// เบราว์เซอร์ครอปเป็นสี่เหลี่ยมจัตุรัสและย่อก่อนส่ง (crop-avatar.ts) เซิร์ฟเวอร์ตรวจซ้ำที่นี่

/** ขนาดรูปที่เก็บ (px) แสดงจริงไม่เกิน ~80px บนจอความละเอียดสูง จึงพอ */
export const AVATAR_SIZE = 384;
/** ขนาดไฟล์สูงสุดที่รับ (ตรงกับ file_size_limit ของ bucket avatars) */
export const AVATAR_MAX_BYTES = 1024 * 1024;

export type AvatarType = "image/jpeg" | "image/png" | "image/webp";

const EXTENSIONS: Record<AvatarType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * ดูชนิดรูปจาก "ไบต์แรกของไฟล์" ไม่เชื่อนามสกุล/ชนิดที่เบราว์เซอร์บอก (ปลอมได้)
 * คืน null ถ้าไม่ใช่ JPEG/PNG/WebP
 */
export function detectImageType(bytes: Uint8Array): AvatarType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** path ใน bucket: <employee_id>/<ชื่อสุ่ม>.<นามสกุล> (ตรงกับ constraint employees_photo_path_check) */
export function avatarPath(employeeId: string, type: AvatarType, randomId: string): string {
  return `${employeeId}/${randomId.replace(/[^A-Za-z0-9_-]/g, "")}.${EXTENSIONS[type]}`;
}

/** ลิงก์รูปที่หน้าเว็บใช้ ใส่ ?v= เป็นชื่อไฟล์ เปลี่ยนรูปแล้วเบราว์เซอร์โหลดรูปใหม่เอง (รูปเดิมเก็บแคชได้นาน) */
export function avatarUrl(employeeId: string, photoPath: string | null): string | null {
  if (!photoPath) return null;
  const version = photoPath.split("/").pop()?.split(".")[0] ?? "";
  return `/avatar/${employeeId}?v=${encodeURIComponent(version)}`;
}

/** ตัวอักษรแรกของชื่อ ใช้แทนรูปเมื่อยังไม่ได้ตั้ง (ข้ามสระ/วรรณยุกต์ไทยที่ขึ้นต้นไม่ได้) */
export function initialOf(name: string): string {
  const trimmed = name.trim();
  const match = trimmed.match(/[A-Za-z0-9ก-ฮ]/);
  return (match ? match[0] : trimmed.slice(0, 1)).toUpperCase();
}

/** ตัดรูปเป็นสี่เหลี่ยมจัตุรัสตรงกลาง (รูปแนวตั้งเลื่อนขึ้นนิดหน่อย เพราะหน้าคนมักอยู่ส่วนบน) */
export function centerSquare(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height);
  const sx = Math.round((width - size) / 2);
  const sy = height > width ? Math.round((height - size) * 0.35) : Math.round((height - size) / 2);
  return { sx, sy, size };
}
