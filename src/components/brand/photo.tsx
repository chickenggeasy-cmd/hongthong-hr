import Image from "next/image";

// รูปถ่ายจริงจาก Unsplash (ดู public/photos/CREDITS.md) ใช้เป็นพื้นหลังบนแบนเนอร์สีน้ำเงินเท่านั้น
// ปรับเป็นโทนน้ำเงินของแบรนด์ทุกรูป (ขาวดำ + ผสมกับพื้นน้ำเงิน) รูปจากหลายที่จึงดูเป็นชุดเดียวกัน

export type PhotoName =
  | "aisle"
  | "aisle2"
  | "boxes"
  | "cart"
  | "cashier"
  | "desk"
  | "handshake"
  | "logistics"
  | "market"
  | "office"
  | "produce"
  | "store"
  | "team"
  | "warehouse";

/**
 * รูปโทนน้ำเงินวางเป็นชั้นพื้นหลัง (ตกแต่ง โปรแกรมอ่านหน้าจอข้าม)
 * fade = ด้านที่ค่อยๆ จางหายเข้ากับแบนเนอร์ ("left" = รูปอยู่ขวา จางไปทางซ้าย, "none" = เต็มพื้นที่)
 */
export function BrandPhoto({
  name,
  className = "",
  fade = "left",
  strength = 0.5,
  priority = false,
  sizes = "(min-width: 1024px) 60vw, 100vw",
}: {
  name: PhotoName;
  className?: string;
  fade?: "left" | "bottom" | "none";
  strength?: number;
  priority?: boolean;
  sizes?: string;
}) {
  const mask =
    fade === "left"
      ? "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 35%, #000 70%)"
      : fade === "bottom"
        ? "linear-gradient(to bottom, #000 30%, transparent 100%)"
        : undefined;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute overflow-hidden ${className}`}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    >
      <Image
        src={`/photos/${name}.webp`}
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover grayscale mix-blend-luminosity"
        style={{ opacity: strength }}
      />
    </div>
  );
}
