"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createServiceClient } from "@/lib/supabase/service";
import { AVATAR_MAX_BYTES, avatarPath, avatarUrl, detectImageType } from "@/lib/profile/photo";

// เปลี่ยน/ลบรูปโปรไฟล์ของตัวเอง
// ใช้ service role (bucket avatars ปิดสิทธิ์ทุกคน) หลังตรวจตัวตนด้วย getCurrentEmployee() แล้ว
// และใช้ id จากการล็อกอินเท่านั้น ไม่รับ id จากฟอร์ม จึงแก้รูปของคนอื่นไม่ได้

export type ProfilePhotoState = { error: string | null; success: boolean; photoUrl: string | null };

const BUCKET = "avatars";
const GENERIC_ERROR = "บันทึกรูปไม่สำเร็จ กรุณาลองใหม่";

export async function updateProfilePhoto(_prev: ProfilePhotoState, formData: FormData): Promise<ProfilePhotoState> {
  const employee = await getCurrentEmployee();
  if (!employee) return { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", success: false, photoUrl: null };
  const current = avatarUrl(employee.id, employee.photoPath);

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { error: "กรุณาเลือกรูปก่อน", success: false, photoUrl: current };
  if (photo.size > AVATAR_MAX_BYTES) return { error: "รูปใหญ่เกินไป (ไม่เกิน 1 MB)", success: false, photoUrl: current };

  // ตรวจชนิดจากเนื้อไฟล์จริง ไม่เชื่อชนิดที่เบราว์เซอร์ส่งมา
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { error: "รองรับเฉพาะรูป JPG, PNG หรือ WebP", success: false, photoUrl: current };

  const service = createServiceClient();
  const path = avatarPath(employee.id, type, randomUUID().replace(/-/g, ""));
  const { error: uploadError } = await service.storage.from(BUCKET).upload(path, bytes, { contentType: type });
  if (uploadError) return { error: GENERIC_ERROR, success: false, photoUrl: current };

  const { error: updateError } = await service.from("employees").update({ photo_path: path }).eq("id", employee.id);
  if (updateError) {
    await service.storage.from(BUCKET).remove([path]); // กันไฟล์ค้าง
    return { error: GENERIC_ERROR, success: false, photoUrl: current };
  }
  if (employee.photoPath) await service.storage.from(BUCKET).remove([employee.photoPath]); // ลบรูปเก่า ไม่ให้ค้างในที่เก็บ

  revalidatePath("/", "layout");
  return { error: null, success: true, photoUrl: avatarUrl(employee.id, path) };
}

export async function removeProfilePhoto(): Promise<ProfilePhotoState> {
  const employee = await getCurrentEmployee();
  if (!employee) return { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", success: false, photoUrl: null };
  if (!employee.photoPath) return { error: null, success: true, photoUrl: null };

  const service = createServiceClient();
  const { error } = await service.from("employees").update({ photo_path: null }).eq("id", employee.id);
  if (error) return { error: GENERIC_ERROR, success: false, photoUrl: avatarUrl(employee.id, employee.photoPath) };
  await service.storage.from(BUCKET).remove([employee.photoPath]);

  revalidatePath("/", "layout");
  return { error: null, success: true, photoUrl: null };
}
