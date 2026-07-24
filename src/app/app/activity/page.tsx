import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Activity" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Activity"
      description="Nachvollziehbare Timeline aller Agentenaktivitäten."
      phase="Phase 5 (Agent-Runtime)"
    />
  );
}
