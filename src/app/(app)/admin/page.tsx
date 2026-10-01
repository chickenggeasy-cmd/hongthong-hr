import { requirePermission } from "@/lib/auth/require-permission";
import { PlaceholderPage } from "@/components/features/placeholder-page";

export default async function AdminPage() {
  await requirePermission("admin.view");
  return <PlaceholderPage title="ตั้งค่าระบบ" />;
}
