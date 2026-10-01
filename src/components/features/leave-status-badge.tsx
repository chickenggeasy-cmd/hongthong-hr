import { leaveStatusLabel } from "@/lib/leave/logic";

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-[#E8890C]/10 text-[#E8890C]",
  approved: "bg-[#2E9E5B]/10 text-[#2E9E5B]",
  rejected: "bg-[#D64545]/10 text-[#D64545]",
};

export function LeaveStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status] ?? "bg-[#5B6B7B]/10 text-[#5B6B7B]"}`}
    >
      {leaveStatusLabel(status)}
    </span>
  );
}

export function ExceedsQuotaBadge() {
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-[#D64545]/10 px-2 py-0.5 text-xs font-medium text-[#D64545]">
      เกินโควตา
    </span>
  );
}
