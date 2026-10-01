"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createServiceClient } from "@/lib/supabase/service";
import { nextAttendanceType, type AttendanceType } from "@/lib/attendance/logic";

export type CheckInState = {
  error: string | null;
  success: boolean;
  resultType?: AttendanceType;
  distanceMeters?: number;
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const GENERIC_ERROR = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

export async function checkInOrOut(_prevState: CheckInState, formData: FormData): Promise<CheckInState> {
  // ตรวจตัวตนด้วย client ปกติ (อ้างอิงคุกกี้ผู้ใช้) ห้ามเชื่อ employee id จากฟอร์ม
  const employee = await getCurrentEmployee();
  if (!employee) {
    return { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", success: false };
  }

  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  const photo = formData.get("photo");

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { error: "ไม่พบพิกัดตำแหน่งที่ถูกต้อง กรุณาอนุญาตการเข้าถึงตำแหน่งแล้วลองใหม่", success: false };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { error: "ไม่พบพิกัดตำแหน่งที่ถูกต้อง กรุณาอนุญาตการเข้าถึงตำแหน่งแล้วลองใหม่", success: false };
  }
  // รูปไม่บังคับ (เจ้าของโปรเจกต์ตัดสินใจ 2 ต.ค. 2569) แต่ถ้าส่งมาต้องเป็นรูปที่ถูกต้อง
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto && photo.size > MAX_PHOTO_BYTES) {
    return { error: "ไฟล์รูปใหญ่เกินไป (ไม่เกิน 5MB)", success: false };
  }
  if (hasPhoto && !ALLOWED_MIME_TYPES.has(photo.type)) {
    return { error: "รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WEBP", success: false };
  }

  // ต้องใช้ service role เพราะ app_settings ไม่เปิดให้ authenticated อ่าน
  // และ attendance_logs ไม่เปิดให้ authenticated เขียน (ดู migration attendance_checkin)
  const supabase = createServiceClient();

  const { data: settingsRows, error: settingsError } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["company.latitude", "company.longitude", "attendance.radius_meters"]);

  if (settingsError || !settingsRows || settingsRows.length < 3) {
    return { error: "ระบบยังไม่ได้ตั้งค่าตำแหน่งบริษัท กรุณาติดต่อ HR", success: false };
  }
  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
  const companyLatitude = Number(settings["company.latitude"]);
  const companyLongitude = Number(settings["company.longitude"]);
  const radiusMeters = Number(settings["attendance.radius_meters"]);

  const { data: distanceMeters, error: distanceError } = await supabase.rpc("distance_meters", {
    lat1: latitude,
    lng1: longitude,
    lat2: companyLatitude,
    lng2: companyLongitude,
  });
  if (distanceError || distanceMeters === null) {
    return { error: GENERIC_ERROR, success: false };
  }
  const withinRadius = distanceMeters <= radiusMeters;

  // ตัดสินว่าครั้งนี้ควรเป็นเช็คอินหรือเช็คเอาท์จากประวัติล่าสุดจริงในฐานข้อมูล
  // (คำนวณใหม่ตรงนี้เสมอ ไม่เชื่อค่าที่ฝั่งเว็บส่งมา กันกดสลับมั่ว/แก้ฟอร์มเอง)
  const { data: lastLog } = await supabase
    .from("attendance_logs")
    .select("type")
    .eq("employee_id", employee.id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const type = nextAttendanceType((lastLog?.type as AttendanceType | undefined) ?? null);

  if (!withinRadius) {
    const action = type === "check_in" ? "เช็คอิน" : "เช็คเอาท์";
    return {
      error: `คุณอยู่ห่างจากบริษัท ${Math.round(distanceMeters)} เมตร เกินระยะที่กำหนด (${radiusMeters} เมตร) ${action}ไม่สำเร็จ`,
      success: false,
    };
  }

  let photoPath: string | null = null;
  if (hasPhoto) {
    const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    photoPath = `${employee.id}/${Date.now()}-${type}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("attendance-photos")
      .upload(photoPath, photo, { contentType: photo.type });
    if (uploadError) {
      return { error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่", success: false };
    }
  }

  const { error: insertError } = await supabase.from("attendance_logs").insert({
    employee_id: employee.id,
    type,
    latitude,
    longitude,
    distance_meters: distanceMeters,
    within_radius: withinRadius,
    photo_path: photoPath,
  });
  if (insertError) {
    if (photoPath) await supabase.storage.from("attendance-photos").remove([photoPath]); // กันไฟล์ค้างถ้าบันทึกแถวไม่สำเร็จ
    return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่", success: false };
  }

  revalidatePath("/attendance");
  return { error: null, success: true, resultType: type, distanceMeters };
}