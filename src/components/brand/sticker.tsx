import type { CSSProperties } from "react";
import {
  AlarmClock,
  Apple,
  BadgeCheck,
  Banknote,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  ChartColumn,
  ClipboardList,
  Coffee,
  Coins,
  Croissant,
  Crown,
  Hand,
  HardHat,
  Hourglass,
  IdCard,
  KeyRound,
  Leaf,
  Lightbulb,
  Lock,
  LockKeyhole,
  MapPin,
  Moon,
  MoonStar,
  Package,
  PartyPopper,
  Plug,
  ReceiptText,
  Rocket,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Sofa,
  Sparkles,
  Star,
  Store,
  Sun,
  Thermometer,
  Timer,
  TreePalm,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Truck,
  Tv,
  UserRound,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

// ไอคอนในกรอบสี่เหลี่ยมมุมมน (ใช้แทนภาพประกอบทั้งเว็บ) — ไอคอนเส้นจาก lucide-react ชุดเดียวกับเมนู
// สีบอกความหมาย: น้ำเงิน = ทั่วไป · ทอง = เงิน/ผู้บริหาร · เขียว = สำเร็จ/ลาพักร้อน · ส้ม = รอ/เตือน · แดง = ป่วย/ผิดพลาด

type Tone = "blue" | "gold" | "green" | "orange" | "red" | "navy";

const ICONS = {
  "alarm-clock": [AlarmClock, "blue"],
  apple: [Apple, "red"],
  bags: [ShoppingBag, "blue"],
  basket: [ShoppingBasket, "blue"],
  beach: [TreePalm, "green"],
  bell: [Bell, "orange"],
  bread: [Croissant, "gold"],
  briefcase: [Briefcase, "blue"],
  bulb: [Lightbulb, "gold"],
  calendar: [CalendarDays, "blue"],
  camera: [Camera, "blue"],
  cards: [IdCard, "blue"],
  cart: [ShoppingCart, "blue"],
  chart: [ChartColumn, "blue"],
  "chart-up": [TrendingUp, "green"],
  check: [BadgeCheck, "green"],
  clipboard: [ClipboardList, "blue"],
  coffee: [Coffee, "gold"],
  coin: [Coins, "gold"],
  couch: [Sofa, "blue"],
  crown: [Crown, "gold"],
  executive: [Briefcase, "navy"],
  gear: [Settings, "navy"],
  greens: [Leaf, "green"],
  hourglass: [Hourglass, "orange"],
  key: [KeyRound, "gold"],
  lock: [Lock, "navy"],
  "lock-key": [LockKeyhole, "navy"],
  mechanic: [Wrench, "blue"],
  "money-bag": [Wallet, "gold"],
  "money-wings": [Banknote, "green"],
  moon: [Moon, "navy"],
  night: [MoonStar, "navy"],
  office: [Building2, "blue"],
  "office-man": [UserRound, "blue"],
  "office-woman": [UserRound, "blue"],
  package: [Package, "gold"],
  party: [PartyPopper, "green"],
  people: [Users, "blue"],
  phone: [Smartphone, "blue"],
  pin: [MapPin, "blue"],
  plug: [Plug, "blue"],
  receipt: [ReceiptText, "blue"],
  rocket: [Rocket, "blue"],
  shield: [ShieldCheck, "green"],
  sick: [Thermometer, "red"],
  sparkles: [Sparkles, "gold"],
  star: [Star, "gold"],
  stopwatch: [Timer, "blue"],
  store: [Store, "blue"],
  sun: [Sun, "gold"],
  tools: [Wrench, "blue"],
  trophy: [Trophy, "gold"],
  truck: [Truck, "blue"],
  tv: [Tv, "blue"],
  warning: [TriangleAlert, "orange"],
  wave: [Hand, "gold"],
  worker: [HardHat, "gold"],
} as const satisfies Record<string, readonly [LucideIcon, Tone]>;

export type StickerName = keyof typeof ICONS;

const TONE_CLASS: Record<Tone, string> = {
  blue: "from-[#F2F8FE] to-[#DCEAF9] text-[#1E5FA8] ring-[#1E5FA8]/10",
  navy: "from-[#EEF2F8] to-[#D9E2EE] text-[#0F2D52] ring-[#0F2D52]/10",
  gold: "from-[#FFF9E8] to-[#F9E9BA] text-[#8A6A0E] ring-[#D4A017]/20",
  green: "from-[#F0FAF4] to-[#D4F0DF] text-[#1E7A45] ring-[#2E9E5B]/15",
  orange: "from-[#FFF6EC] to-[#FCE3C4] text-[#B5650A] ring-[#E8890C]/20",
  red: "from-[#FDF2F2] to-[#F8D7D7] text-[#B83434] ring-[#D64545]/15",
};

/** ไอคอนในกรอบสี (ตกแต่ง โปรแกรมอ่านหน้าจอข้าม) size = ขนาดกรอบเป็น px */
export function Sticker({
  name,
  size = 48,
  className = "",
  style,
}: {
  name: StickerName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** ไม่ได้ใช้แล้ว (เหลือไว้ให้โค้ดเดิมเรียกได้) */
  priority?: boolean;
}) {
  const [Icon, tone] = ICONS[name];
  const iconSize = Math.round(size * 0.48);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br ring-1 ring-inset shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_6px_16px_-10px_rgb(15_45_82/0.45)] ${TONE_CLASS[tone]} ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), ...style }}
    >
      <Icon style={{ width: iconSize, height: iconSize }} strokeWidth={1.75} />
    </span>
  );
}
