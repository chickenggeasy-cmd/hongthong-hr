import type { ReactNode } from "react";
import { Crown, TriangleAlert } from "lucide-react";
import { roleLabel } from "@/lib/permissions";
import { decisionFor, type PendingRequest } from "@/lib/approvals/view";
import { ExceedsQuotaBadge } from "@/components/features/leave-status-badge";
import { DecideRequestForm, DisabledDecision } from "./decide-request-form";

// การ์ดคำขอและกลุ่มคำขอของหน้าอนุมัติ (แยกจาก page.tsx ให้เปิดดูหน้าตาด้วยข้อมูลตัวอย่างได้)

export type Card = PendingRequest & {
  requesterCode: string;
  deptName: string;
  heading: string; // เช่น "ลาป่วย · 2 วัน" / "OT 3 ชั่วโมง"
  dates: string;
  reason: string | null;
};

export function RequestCard({
  card,
  viewer,
  emphasis,
  penalty,
}: {
  card: Card;
  viewer: { id: string; role: string };
  emphasis: "finance" | "people" | "default";
  penalty: number | null;
}) {
  const check = decisionFor(viewer, card);
  const overQuotaForFinance = emphasis === "finance" && card.exceedsQuota;
  return (
    <li
      className={`grid gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:grid-cols-[1fr_15rem] ${
        overQuotaForFinance ? "border-[#D64545]/40" : "border-[#1E5FA8]/5"
      }`}
    >
      <div className="flex gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAF3FC] font-bold text-[#1E5FA8]" aria-hidden>
          {card.requesterName.trim().slice(0, 1)}
        </span>
        <div className="min-w-0 space-y-1">
          {emphasis === "people" ? (
            <>
              <p className="text-base font-bold text-[#1A1A1A]">{card.requesterName}</p>
              <p className="flex flex-wrap gap-1 text-xs">
                <span className="rounded-full bg-[#1E5FA8] px-2 py-0.5 font-medium text-white">
                  {card.deptCode} · {card.deptName}
                </span>
                <span className="rounded-full bg-[#EAF3FC] px-2 py-0.5 text-[#1E5FA8]">{roleLabel(card.requesterRole)}</span>
                <span className="rounded-full bg-[#5B6B7B]/10 px-2 py-0.5 text-[#5B6B7B]">{card.requesterCode}</span>
              </p>
            </>
          ) : (
            <p className="font-semibold text-[#1A1A1A]">
              {card.requesterName}{" "}
              <span className="text-sm font-normal text-[#5B6B7B]">
                {card.requesterCode} · {card.deptName}
              </span>
            </p>
          )}
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-[#1A1A1A]">
            <span className="rounded-md bg-[#F7FAFD] px-1.5 py-0.5 font-medium">{card.heading}</span>
            {card.exceedsQuota && !overQuotaForFinance ? <ExceedsQuotaBadge /> : null}
          </p>
          <p className="text-sm text-[#5B6B7B]">{card.dates}</p>
          {card.reason ? <p className="text-sm text-[#5B6B7B]">เหตุผล: {card.reason}</p> : null}
          {overQuotaForFinance ? (
            <p className="flex items-center gap-1.5 rounded-lg bg-[#D64545]/10 px-2.5 py-1.5 text-sm font-semibold text-[#D64545]">
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
              เกินโควตา — มีผลหักเงิน{penalty !== null ? ` ${penalty.toLocaleString("th-TH")} บาทต่อวันที่เกิน` : ""} ตอนคำนวณเงินเดือน
            </p>
          ) : null}
        </div>
      </div>
      <div className="self-center">
        {check.allowed ? <DecideRequestForm kind={card.kind} requestId={card.id} /> : <DisabledDecision reason={check.reason} />}
      </div>
    </li>
  );
}

export function Group({ title, description, count, gold, children }: { title: string; description?: string; count: number; gold?: boolean; children: ReactNode }) {
  return (
    <section
      className={`rounded-3xl p-5 ${gold ? "border-2 border-[#D4A017] bg-gradient-to-br from-[#FFF8E5] to-white shadow-md shadow-[#D4A017]/10" : "border border-[#1E5FA8]/5 bg-white/60"}`}
    >
      <h2 className="flex items-center gap-2 text-lg font-bold text-[#1A1A1A]">
        {gold ? <Crown className="h-5 w-5 text-[#B8860B]" aria-hidden /> : <span className="h-5 w-1 rounded-full bg-[#D4A017]" aria-hidden />}
        {title}
        <span className={`rounded-full px-2 py-0.5 text-sm ${gold ? "bg-[#D4A017] text-[#1A1A1A]" : "bg-[#E8890C]/10 text-[#9A5A00]"}`}>{count}</span>
      </h2>
      {description ? <p className="mt-1 text-sm text-[#5B6B7B]">{description}</p> : null}
      {count === 0 ? <p className="py-6 text-center text-sm text-[#5B6B7B]">ไม่มีคำขอที่รออนุมัติ</p> : <ul className="mt-3 space-y-3">{children}</ul>}
    </section>
  );
}
