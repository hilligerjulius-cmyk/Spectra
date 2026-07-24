import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Settings" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Settings"
      description="Organisation, Datenschutz und Freigaberegeln."
      phase="Phase 7 (Billing & Onboarding)"
    />
  );
}
