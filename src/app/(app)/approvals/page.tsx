import { requirePermission } from "@/lib/auth/require-permission";
import { PlaceholderPage } from "@/components/features/placeholder-page";

export default async function ApprovalsPage() {
  await requirePermission("approvals.view");
  return <PlaceholderPage title="อนุมัติลา/OT" />;
}
