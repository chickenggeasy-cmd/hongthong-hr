import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { DotPattern } from "@/components/brand/illustrations";

/**
 * หัวเพจแบบเดียวกันทุกหน้า: แบนเนอร์น้ำเงินไล่เฉด + ไอคอน + ชื่อหน้า + คำอธิบาย
 * children = ตัวเลขสรุปด้านขวา (ใช้คลาส ht-stat ให้เป็นการ์ดขาวบนแบนเนอร์)
 */
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
    <section className="ht-rise relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#1E5FA8] via-[#174D8C] to-[#0F2D52] text-white shadow-[0_24px_48px_-24px_rgb(15_45_82/0.65)]">
      <DotPattern className="absolute inset-0 h-full w-full text-white/[0.06]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F0C75E]/80 to-transparent" aria-hidden />
      <div className="ht-blob pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#5BA4E6]/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-28 left-1/4 h-56 w-56 rounded-full bg-[#D4A017]/15 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.12] ring-1 ring-white/20 sm:h-14 sm:w-14">
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">{title}</h1>
            {description ? <p className="mt-1 text-sm leading-relaxed text-white/75">{description}</p> : null}
          </div>
        </div>

        {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </section>
  );
}
