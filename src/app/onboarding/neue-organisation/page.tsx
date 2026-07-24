import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/guards";
import { CreateOrganizationForm } from "../create-organization-form";
import { Logo } from "@/components/shared/logo";

export const metadata = { title: "Neue Organisation" };

export default async function NewOrganizationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

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
