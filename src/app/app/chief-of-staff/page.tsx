import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Chief of Staff" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Chief of Staff"
      description="Ihre zentrale Koordinationsinstanz: Prioritäten, Delegation, Briefings."
      phase="Phase 6 (Vertical Slice)"
    />
  );
}
