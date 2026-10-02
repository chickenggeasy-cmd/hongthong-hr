import { Sticker, type StickerName } from "@/components/brand/sticker";

/** กล่อง "ยังไม่มีข้อมูล" แบบเดียวกันทุกหน้า (ภาพ 3D ลอย + ข้อความ) */
export function EmptyState({ sticker, children }: { sticker: StickerName; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-[#5B6B7B]">
      <span className="ht-float-slow block opacity-90">
        <Sticker name={sticker} size={64} className="ht-pop" />
      </span>
      {children}
    </div>
  );
}
