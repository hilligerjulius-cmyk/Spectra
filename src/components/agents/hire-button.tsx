"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlusIcon, CheckIcon } from "lucide-react";
import { hireAgent, hireDepartment } from "@/server/agents/actions";
import type { DepartmentSlug } from "@/server/agents/catalog/types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function HireAgentButton({
  slug,
  alreadyHired,
  canHire,
  size = "default",
}: {
  slug: string;
  alreadyHired: boolean;
  canHire: boolean;
  size?: "default" | "lg" | "sm";
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (alreadyHired) {
    return (
      <Button variant="secondary" size={size} disabled>
        <CheckIcon /> Im Team
      </Button>
    );
  }

  return (
    <Button
      size={size}
      disabled={pending || !canHire}
      title={
        canHire
          ? undefined
          : "Nur Owner und Admins können Agenten einstellen."
      }
      onClick={() =>
        startTransition(async () => {
          const result = await hireAgent(slug);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else {
            toast.error(result.message);
          }
        })
      }
    >
      {pending ? <Spinner /> : <UserPlusIcon />}
      Agent einstellen
    </Button>
  );
}

export function HireDepartmentButton({
  department,
  canHire,
  remainingCount,
}: {
  department: DepartmentSlug;
  canHire: boolean;
  remainingCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending || !canHire || remainingCount === 0}
      title={
        canHire
          ? undefined
          : "Nur Owner und Admins können Agenten einstellen."
      }
      onClick={() =>
        startTransition(async () => {
          const result = await hireDepartment(department);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else {
            toast.error(result.message);
          }
        })
      }
    >
      {pending ? <Spinner /> : <UserPlusIcon />}
      {remainingCount === 0
        ? "Komplett im Team"
        : `Komplettes Department buchen (${remainingCount} Agenten)`}
    </Button>
  );
}
