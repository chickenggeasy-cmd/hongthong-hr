import { fitWithin } from "./logic";

// ย่อรูปเช็คอินในเบราว์เซอร์ก่อนส่ง (รูปจากกล้องมือถือมัก 3–8 MB แต่เซิร์ฟเวอร์อย่าง Vercel รับได้ไม่เกิน ~4.5 MB ต่อครั้ง)
// ผลลัพธ์: JPEG ด้านยาวไม่เกิน 1280px ปกติเหลือ 150–400 KB ถ้าย่อไม่ได้ (เบราว์เซอร์เก่า) ส่งไฟล์เดิม

const MAX_SIDE = 1280;
const QUALITY = 0.82;

export async function compressPhoto(file: File): Promise<File> {
  try {
    // imageOrientation: หมุนรูปตามข้อมูล EXIF ของกล้อง (ไม่งั้นรูปจากมือถืออาจตะแคง)
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const size = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context || size.width === 0) return file;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
