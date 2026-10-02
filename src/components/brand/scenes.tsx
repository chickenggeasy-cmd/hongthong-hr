import type { CSSProperties } from "react";
import { Sticker, type StickerName } from "./sticker";

// ฉากภาพ 3D ประกอบ (ตกแต่งเท่านั้น โปรแกรมอ่านหน้าจอข้ามทั้งก้อน)
// ทุกชิ้นขยับด้วย transform เท่านั้น (ht-float / ht-pop) จึงลื่นและไม่กินแรงเครื่อง

const ROLE_CHARACTER: Record<string, StickerName> = {
  employee: "worker",
  head: "mechanic",
  hr: "office-woman",
  finance: "office-man",
  executive: "executive",
};

/** ตัวละครประจำบทบาท (ไม่รู้จักบทบาท = พนักงานทั่วไป) */
export function characterForRole(role: string): StickerName {
  return ROLE_CHARACTER[role] ?? "worker";
}

function Piece({
  name,
  size,
  className,
  delay = 0,
  float,
  floatDelay = 0,
}: {
  name: StickerName;
  size: number;
  className: string;
  delay?: number;
  float?: "fast" | "slow";
  floatDelay?: number;
}) {
  const popStyle: CSSProperties = { animationDelay: `${delay}ms` };
  const img = <Sticker name={name} size={size} className="ht-pop" style={popStyle} />;
  return (
    <span className={`absolute block ${className}`}>
      {float ? (
        <span
          className={`block ${float === "fast" ? "ht-float" : "ht-float-slow"}`}
          style={{ animationDelay: `${floatDelay}ms` }}
        >
          {img}
        </span>
      ) : (
        img
      )}
    </span>
  );
}

/** แท่นวงรีที่ตัวละครยืน (แสงนุ่มๆ ใต้ฉาก) */
function Stage({ className }: { className: string }) {
  return (
    <span className={`absolute rounded-[50%] ${className}`} aria-hidden>
      <span className="absolute inset-0 rounded-[50%] bg-white/10 ring-1 ring-white/15" />
      <span className="absolute inset-x-[15%] inset-y-[20%] rounded-[50%] bg-[#5BA4E6]/25 blur-xl" />
    </span>
  );
}

/** ฉากหน้าแรก: ห้างหงส์ทอง + รถส่งของ + ตัวละครตามบทบาท + ของลอยรอบๆ */
export function StoreScene({ role, className = "" }: { role: string; className?: string }) {
  return (
    <div className={`relative h-[250px] w-[360px] ${className}`} aria-hidden>
      <Stage className="bottom-2 left-6 right-2 h-16" />
      <Piece name="store" size={190} className="bottom-8 left-[88px]" />
      <Piece name="truck" size={112} className="bottom-3 left-0" delay={150} />
      <Piece name={characterForRole(role)} size={128} className="-bottom-1 right-0" delay={300} />
      <Piece name="bags" size={54} className="right-24 top-0" delay={450} float="fast" />
      <Piece name="coin" size={40} className="left-12 top-6" delay={550} float="slow" floatDelay={-2000} />
      <Piece name="sparkles" size={34} className="right-6 top-14" delay={650} float="fast" floatDelay={-3000} />
    </div>
  );
}

/** ฉากหน้าล็อกอิน: ห้าง + พนักงานหลายฝ่าย + สินค้าของทุกแผนกลอยรอบๆ */
export function LoginScene({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-[340px] w-[480px] ${className}`} aria-hidden>
      <Stage className="bottom-2 left-4 right-4 h-20" />
      <Piece name="store" size={210} className="bottom-12 left-[135px]" />
      <Piece name="truck" size={120} className="bottom-5 left-0" delay={150} />
      <Piece name="office-woman" size={112} className="bottom-0 left-[110px]" delay={300} />
      <Piece name="worker" size={112} className="bottom-0 right-[92px]" delay={400} />
      <Piece name="executive" size={104} className="bottom-6 right-0" delay={500} />
      {/* สินค้าตัวแทนแต่ละแผนก: อาหารสด อาหารแห้ง เครื่องใช้ในบ้าน เครื่องใช้ไฟฟ้า ช่าง */}
      <Piece name="greens" size={52} className="left-6 top-10" delay={600} float="slow" />
      <Piece name="apple" size={44} className="left-[110px] top-0" delay={680} float="fast" floatDelay={-1500} />
      <Piece name="bread" size={50} className="right-[150px] top-0" delay={760} float="slow" floatDelay={-3000} />
      <Piece name="tv" size={54} className="right-12 top-6" delay={840} float="fast" floatDelay={-2200} />
      <Piece name="couch" size={50} className="-right-2 top-[110px]" delay={920} float="slow" floatDelay={-4000} />
      <Piece name="tools" size={46} className="-left-2 top-[120px]" delay={1000} float="fast" floatDelay={-1000} />
    </div>
  );
}
