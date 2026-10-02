import type { ReactNode } from "react";
import { Sticker, type StickerName } from "@/components/brand/sticker";

/** หัวข้อการ์ดแบบเดียวกันทั้งเว็บ: ภาพ 3D ในกรอบฟ้าอ่อน + ชื่อหัวข้อ (+ คำอธิบายสั้น) */
export function CardHeading({
  sticker,
  children,
  description,
  className = "mb-4",
}: {
  sticker: StickerName;
  children: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EAF3FC] to-[#FFF8E5]">
        <Sticker name={sticker} size={30} />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-bold leading-tight text-[#0F2D52]">{children}</h2>
        {description ? <p className="mt-0.5 text-sm text-[#5B6B7B]">{description}</p> : null}
      </div>
    </div>
  );
}
