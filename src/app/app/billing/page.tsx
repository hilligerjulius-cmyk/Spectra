import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Billing" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Billing"
      description="Pläne, Agenten-Add-ons und Rechnungen."
      phase="Phase 7 (Billing & Onboarding)"
    />
  );
}
