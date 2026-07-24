import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Marketplace" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Marketplace"
      description="Digitale Mitarbeiter entdecken und Ihrem Team hinzufügen."
      phase="Phase 4 (Marketplace & Katalog)"
    />
  );
}
