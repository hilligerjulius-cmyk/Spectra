"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { acceptInvitation } from "@/server/team/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function AcceptForm({
  invitationId,
  organizationId,
}: {
  invitationId: string;
  organizationId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function accept() {
    setPending(true);
    const result = await acceptInvitation(invitationId);
    if (!result.ok) {
      setPending(false);
      toast.error(result.message);
      return;
    }
    // Direkt in die neue Organisation wechseln, damit der Zugang sofort wirkt.
    await authClient.organization.setActive({ organizationId });
    setPending(false);
    toast.success("Einladung angenommen.");
    router.push("/app");
    router.refresh();
  }

  return (
    <Button className="w-full" disabled={pending} onClick={accept}>
      {pending ? <Spinner /> : null}
      Einladung annehmen
    </Button>
  );
}
