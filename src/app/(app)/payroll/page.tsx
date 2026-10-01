import { requirePermission } from "@/lib/auth/require-permission";
import { PlaceholderPage } from "@/components/features/placeholder-page";

export default async function PayrollPage() {
  await requirePermission("payroll.view");
  return <PlaceholderPage title="เงินเดือน" />;
}
