import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Approvals" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Approvals"
      description="Freigabeanfragen Ihrer Agenten prüfen und entscheiden."
      phase="Phase 5 (Agent-Runtime)"
    />
  );
}
