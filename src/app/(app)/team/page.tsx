import { requirePermission } from "@/lib/auth/require-permission";
import { PlaceholderPage } from "@/components/features/placeholder-page";

export default async function TeamPage() {
  await requirePermission("team.view");
  return <PlaceholderPage title="ทีมของฉัน" />;
}
