import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Integrations" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Integrations"
      description="Systeme verbinden: E-Mail, Kalender, Webhooks, CSV."
      phase="Phase 6 und 9 (Integrationen)"
    />
  );
}
