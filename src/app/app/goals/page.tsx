import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Goals" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Goals"
      description="Ziele und KPIs Ihrer digitalen Mitarbeiter."
      phase="Phase 8 (Departments & Reports)"
    />
  );
}
