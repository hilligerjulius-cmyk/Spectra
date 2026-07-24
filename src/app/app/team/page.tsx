import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Team" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Team"
      description="Mitglieder einladen und Rollen verwalten."
      phase="Phase 7 (Billing & Onboarding)"
    />
  );
}
