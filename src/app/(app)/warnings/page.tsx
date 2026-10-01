import { requirePermission } from "@/lib/auth/require-permission";
import { PlaceholderPage } from "@/components/features/placeholder-page";

export default async function WarningsPage() {
  await requirePermission("employees.manage");
  return <PlaceholderPage title="ใบเตือน" />;
}
