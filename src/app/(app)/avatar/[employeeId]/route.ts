import { getCurrentEmployee } from "@/lib/auth/current-user";
import { createServiceClient } from "@/lib/supabase/service";
import { avatarUrl } from "@/lib/profile/photo";

// ส่งรูปโปรไฟล์ให้เบราว์เซอร์ (bucket avatars เป็นแบบส่วนตัว เปิดตรงจาก Supabase ไม่ได้)
// ต้องล็อกอินก่อน พนักงานที่ล็อกอินแล้วเห็นรูปของเพื่อนร่วมงานได้ (เหมือนรายชื่อพนักงานในบริษัท)
// ลิงก์มี ?v=<ชื่อไฟล์> เบราว์เซอร์จึงเก็บแคชได้นาน เปลี่ยนรูปแล้วลิงก์เปลี่ยนเอง

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTENT_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(request: Request, ctx: RouteContext<"/avatar/[employeeId]">) {
  const notFound = () => new Response("ไม่พบรูป", { status: 404 });
  if (!(await getCurrentEmployee())) return notFound();

  const { employeeId } = await ctx.params;
  if (!ID_PATTERN.test(employeeId)) return notFound();

  // ใช้ service role หลังตรวจว่าล็อกอินแล้ว: อ่านแค่ path รูปของ id ที่ตรวจรูปแบบแล้ว
  const service = createServiceClient();
  const { data: row } = await service.from("employees").select("photo_path").eq("id", employeeId).maybeSingle();
  if (!row?.photo_path) return notFound();

  const { data: file } = await service.storage.from("avatars").download(row.photo_path);
  if (!file) return notFound();

  const current = avatarUrl(employeeId, row.photo_path);
  const requested = new URL(request.url);
  const isCurrent = current === `${requested.pathname}${requested.search}`;
  const extension = row.photo_path.split(".").pop() ?? "jpg";

  return new Response(file, {
    headers: {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      // ลิงก์ตรงกับรูปปัจจุบัน = ไฟล์นี้ไม่มีวันเปลี่ยน เก็บแคชได้ 1 ปี (เฉพาะเครื่องผู้ใช้ ไม่ใช่แคชกลาง)
      "Cache-Control": isCurrent ? "private, max-age=31536000, immutable" : "private, no-cache",
    },
  });
}
