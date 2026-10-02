import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** หัวหน้าเพจแบบเดียวกันทุกหน้า (ไอคอน + ชื่อ + คำอธิบาย + ปุ่ม/ข้อมูลด้านขวา) */
export function PageHeader({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#D4A017] to-[#F0C75E]" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1E5FA8] to-[#164A85] text-white shadow-md shadow-[#1E5FA8]/20">
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#1A1A1A]">{title}</h1>
            {description ? <p className="mt-0.5 text-sm text-[#5B6B7B]">{description}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
