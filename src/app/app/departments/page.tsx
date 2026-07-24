import { requireOrg } from "@/server/auth/guards";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = { title: "Departments" };

export default async function Page() {
  await requireOrg();
  return (
    <ComingSoon
      title="Departments"
      description="Ihre digitalen Abteilungen und deren Agenten."
      phase="Phase 4 (Marketplace & Katalog)"
    />
  );
}
