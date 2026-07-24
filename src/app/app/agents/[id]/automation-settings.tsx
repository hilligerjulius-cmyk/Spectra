"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setAutomationLevel } from "@/server/agents/actions";
import { AUTOMATION_LEVELS } from "@/server/agents/catalog/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CapabilityConfig {
  key: string;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  maxLevel: number;
  currentLevel: number;
  requiredTools: string[];
}

export function AutomationSettings({
  instanceId,
  capabilities,
  canConfigure,
}: {
  instanceId: string;
  capabilities: CapabilityConfig[];
  canConfigure: boolean;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  async function onChange(capabilityKey: string, value: string) {
    setPendingKey(capabilityKey);
    const result = await setAutomationLevel(
      instanceId,
      capabilityKey,
      Number(value),
    );
    setPendingKey(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Automatisierungsstufen</CardTitle>
        <CardDescription>
          Stellen Sie für jede Fähigkeit einzeln ein, wie selbstständig der
          Agent arbeitet. Sicherheitsobergrenzen können nicht überschritten
          werden.
          {!canConfigure
            ? " Ihre Rolle erlaubt keine Änderungen (nur Ansicht)."
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {capabilities.map((cap) => (
          <div
            key={cap.key}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{cap.name}</p>
                <Badge
                  variant={
                    cap.riskLevel === "high"
                      ? "error"
                      : cap.riskLevel === "medium"
                        ? "warning"
                        : "active"
                  }
                >
                  {cap.riskLevel === "high"
                    ? "hohes Risiko"
                    : cap.riskLevel === "medium"
                      ? "mittleres Risiko"
                      : "geringes Risiko"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {cap.description}
              </p>
            </div>
            <div className="w-full shrink-0 sm:w-72">
              <Select
                value={String(cap.currentLevel)}
                onValueChange={(v) => onChange(cap.key, v)}
                disabled={!canConfigure || pendingKey === cap.key}
              >
                <SelectTrigger aria-label={`Automatisierungsstufe für ${cap.name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {([0, 1, 2, 3, 4, 5] as const)
                    .filter((level) => level <= cap.maxLevel)
                    .map((level) => (
                      <SelectItem key={level} value={String(level)}>
                        Stufe {level} — {AUTOMATION_LEVELS[level].name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Maximum: Stufe {cap.maxLevel}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
