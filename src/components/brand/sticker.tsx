import Image from "next/image";
import type { CSSProperties } from "react";

// ภาพ 3D จาก Fluent Emoji ของ Microsoft (MIT) เก็บไว้ใน public/illustrations/3d/ (ดู LICENSE.txt ในโฟลเดอร์นั้น)
// เพิ่มภาพใหม่: ดาวน์โหลด PNG จาก github.com/microsoft/fluentui-emoji แปลงเป็น .webp แล้วเพิ่มชื่อในรายการนี้
export const STICKERS = [
  "alarm-clock",
  "apple",
  "bags",
  "basket",
  "beach",
  "bell",
  "bread",
  "briefcase",
  "bulb",
  "calendar",
  "camera",
  "cards",
  "cart",
  "chart",
  "chart-up",
  "check",
  "clipboard",
  "coffee",
  "coin",
  "couch",
  "crown",
  "executive",
  "gear",
  "greens",
  "hourglass",
  "key",
  "lock",
  "lock-key",
  "mechanic",
  "money-bag",
  "money-wings",
  "moon",
  "night",
  "office",
  "office-man",
  "office-woman",
  "package",
  "party",
  "people",
  "phone",
  "pin",
  "plug",
  "receipt",
  "rocket",
  "shield",
  "sick",
  "sparkles",
  "star",
  "stopwatch",
  "store",
  "sun",
  "tools",
  "trophy",
  "truck",
  "tv",
  "warning",
  "wave",
  "worker",
] as const;

export type StickerName = (typeof STICKERS)[number];

/** ภาพ 3D ประกอบ (ตกแต่งเท่านั้น จึงไม่มีคำอธิบายภาพให้โปรแกรมอ่านหน้าจอ) */
export function Sticker({
  name,
  size = 64,
  className = "",
  style,
  priority = false,
}: {
  name: StickerName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
}) {
  return (
    <Image
      src={`/illustrations/3d/${name}.webp`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority={priority}
      draggable={false}
      className={`select-none drop-shadow-[0_10px_14px_rgba(15,59,110,0.25)] ${className}`}
      style={style}
    />
  );
}
