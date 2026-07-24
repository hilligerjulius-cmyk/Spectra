"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export interface OrgSummary {
  id: string;
  name: string;
}

export function OrgSwitcher({
  activeOrg,
  organizations,
}: {
  activeOrg: OrgSummary;
  organizations: OrgSummary[];
}) {
  const router = useRouter();

  async function switchOrg(orgId: string) {
    if (orgId === activeOrg.id) return;
    await authClient.organization.setActive({ organizationId: orgId });
    router.push("/app");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-3"
          aria-label="Organisation wechseln"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
              {activeOrg.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-sm font-medium">
              {activeOrg.name}
            </span>
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Organisationen</DropdownMenuLabel>
        {organizations.map((org) => (
          <DropdownMenuItem key={org.id} onSelect={() => switchOrg(org.id)}>
            <span className="truncate">{org.name}</span>
            {org.id === activeOrg.id ? (
              <CheckIcon className="ml-auto size-4" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => router.push("/onboarding/neue-organisation")}
        >
          <PlusIcon />
          Neue Organisation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
