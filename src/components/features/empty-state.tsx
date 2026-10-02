import { Sticker, type StickerName } from "@/components/brand/sticker";

/** กล่อง "ยังไม่มีข้อมูล" แบบเดียวกันทุกหน้า (ไอคอน + ข้อความ) */
export function EmptyState({ sticker, children }: { sticker: StickerName; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-[#5B6B7B]">
      <Sticker name={sticker} size={56} className="ht-pop mb-1" />
      {children}
    </div>
  );
}
