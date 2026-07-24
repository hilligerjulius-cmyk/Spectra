import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Tasks" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Tasks"
      description="Aufgaben, die Agenten erstellt oder übernommen haben."
      phase="Phase 6 (Vertical Slice)"
    />
  );
}
