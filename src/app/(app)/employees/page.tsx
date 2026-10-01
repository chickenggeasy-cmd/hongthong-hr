import { requirePermission } from "@/lib/auth/require-permission";
import { PlaceholderPage } from "@/components/features/placeholder-page";

export default async function EmployeesPage() {
  await requirePermission("employees.manage");
  return <PlaceholderPage title="จัดการพนักงาน" />;
}
