"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SaveIcon } from "lucide-react";
import { setFeatureFlag } from "@/server/platform/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface FlagRow {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  organizationIds: string[];
  updatedAt: string;
}

export function FlagEditor({
  flags,
  knownOrganizations,
  canManage,
}: {
  flags: FlagRow[];
  knownOrganizations: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [state, setState] = React.useState<
    Record<string, { enabled: boolean; orgs: string }>
  >(() =>
    Object.fromEntries(
      flags.map((f) => [
        f.key,
        { enabled: f.enabled, orgs: f.organizationIds.join("\n") },
      ]),
    ),
  );

  const orgNames = new Map(knownOrganizations.map((o) => [o.id, o.name]));

  async function save(flag: FlagRow) {
    const current = state[flag.key]!;
    const ids = current.orgs
      .split(/[\n,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const unknown = ids.filter((id) => !orgNames.has(id));
    if (unknown.length > 0) {
      toast.error(
        `Unbekannte Organisations-ID(s): ${unknown.slice(0, 3).join(", ")}`,
      );
      return;
    }
    setPending(flag.key);
    const result = await setFeatureFlag({
      key: flag.key,
      enabled: current.enabled,
      organizationIds: ids,
    });
    setPending(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {flags.map((flag) => {
        const current = state[flag.key]!;
        return (
          <Card key={flag.key}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{flag.label}</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {flag.key}
                  </CardDescription>
                </div>
                <Switch
                  aria-label={`${flag.label} aktivieren`}
                  checked={current.enabled}
                  disabled={!canManage}
                  onCheckedChange={(v) =>
                    setState((s) => ({
                      ...s,
                      [flag.key]: { ...current, enabled: v },
                    }))
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {flag.description}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor={`orgs-${flag.key}`}>
                  Nur für diese Organisations-IDs (leer = alle)
                </Label>
                <Textarea
                  id={`orgs-${flag.key}`}
                  rows={2}
                  className="font-mono text-xs"
                  value={current.orgs}
                  disabled={!canManage}
                  placeholder="Eine ID pro Zeile — leer bedeutet: für alle aktiv"
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      [flag.key]: { ...current, orgs: e.target.value },
                    }))
                  }
                />
                {flag.organizationIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {flag.organizationIds.map((id) => (
                      <Badge key={id} variant="secondary">
                        {orgNames.get(id) ?? id}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Zuletzt geändert:{" "}
                {new Date(flag.updatedAt).toLocaleString("de-DE")}
              </p>
              {canManage ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending === flag.key}
                  onClick={() => save(flag)}
                >
                  {pending === flag.key ? <Spinner /> : <SaveIcon />}
                  Speichern
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
