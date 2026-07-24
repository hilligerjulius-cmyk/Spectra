import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/guards";
import { CreateOrganizationForm } from "./create-organization-form";
import { Logo } from "@/components/shared/logo";

export const metadata = { title: "Organisation einrichten" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.session.activeOrganizationId) redirect("/app");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-md">
        <CreateOrganizationForm userName={session.user.name} />
      </div>
    </div>
  );
}
