import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Reports" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Reports"
      description="Zeitersparnis, Kosten, Erfolgs- und Freigabequoten."
      phase="Phase 8 (Departments & Reports)"
    />
  );
}
