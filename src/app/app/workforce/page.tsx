import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "My Workforce" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="My Workforce"
      description="Alle gebuchten digitalen Mitarbeiter im Überblick."
      phase="Phase 4 (Marketplace & Katalog)"
    />
  );
}
