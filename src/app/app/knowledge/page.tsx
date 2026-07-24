import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Knowledge" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Knowledge"
      description="Wissensdokumente hochladen und quellenbasiert abfragen."
      phase="Phase 6 (Vertical Slice)"
    />
  );
}
