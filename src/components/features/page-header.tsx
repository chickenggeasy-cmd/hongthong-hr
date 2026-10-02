import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Sticker, type StickerName } from "@/components/brand/sticker";

/** หัวหน้าเพจแบบเดียวกันทุกหน้า (ไอคอน + ชื่อ + คำอธิบาย + ภาพ 3D ลอยได้ + ปุ่ม/ข้อมูลด้านขวา) */
export function PageHeader({
  icon: Icon,
  title,
  description,
  sticker,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  sticker?: StickerName;
  children?: ReactNode;
}) {
  return (
    <div className="ht-rise relative overflow-hidden rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#D4A017] to-[#F0C75E]" aria-hidden />
      {/* แสงฟุ้งด้านขวา ให้ภาพ 3D ดูมีมิติ */}
      <div className="ht-blob absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#5BA4E6]/15 blur-3xl" aria-hidden />
      <div className="absolute -bottom-24 right-32 h-40 w-40 rounded-full bg-[#F0C75E]/15 blur-3xl" aria-hidden />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1E5FA8] to-[#164A85] text-white shadow-md shadow-[#1E5FA8]/20">
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#1A1A1A] sm:text-2xl">{title}</h1>
            {description ? <p className="mt-0.5 text-sm text-[#5B6B7B]">{description}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {children}
          {sticker ? (
            <span className="relative hidden h-20 w-20 shrink-0 sm:block" aria-hidden>
              <span className="absolute inset-2 rounded-full bg-gradient-to-br from-[#EAF3FC] to-[#FFF8E5]" />
              <span className="ht-float-slow relative block">
                <Sticker name={sticker} size={80} priority className="ht-pop" />
              </span>
              <Sticker name="sparkles" size={24} className="ht-float absolute -right-2 -top-1" style={{ animationDelay: "0.8s" }} />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
