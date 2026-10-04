import { AVATAR_SIZE, centerSquare } from "./photo";

// เตรียมรูปโปรไฟล์ในเบราว์เซอร์ก่อนส่ง: ตัดเป็นสี่เหลี่ยมจัตุรัส ย่อเหลือ 384px เป็น JPEG (ปกติ 20–60 KB)
// รูปจากกล้องมือถือใหญ่หลาย MB จึงต้องย่อก่อน เซิร์ฟเวอร์รับไม่เกิน 1 MB

export async function cropAvatar(file: File): Promise<File | null> {
  try {
    // imageOrientation: หมุนตามข้อมูล EXIF ไม่งั้นรูปจากมือถืออาจตะแคง
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { sx, sy, size } = centerSquare(bitmap.width, bitmap.height);
    const out = Math.min(AVATAR_SIZE, size);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const context = canvas.getContext("2d");
    if (!context || size === 0) return null;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, sx, sy, size, size, 0, 0, out, out);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return blob ? new File([blob], "avatar.jpg", { type: "image/jpeg" }) : null;
  } catch {
    return null; // ไฟล์ไม่ใช่รูป หรือเบราว์เซอร์อ่านไม่ได้ (เช่น HEIC บางเครื่อง)
  }
}
