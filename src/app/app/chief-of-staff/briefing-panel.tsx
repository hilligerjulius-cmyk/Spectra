"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListOrderedIcon, RadarIcon, SparklesIcon } from "lucide-react";
import { startManualRun } from "@/server/agents/run-actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const ACTIONS = [
  {
    key: "daily-briefing",
    label: "Tagesbriefing erstellen",
    icon: SparklesIcon,
    goal: "Tagesbriefing aus den aktuellen Aufgaben und Ereignissen erstellen.",
  },
  {
    key: "prioritize",
    label: "Aufgaben priorisieren",
    icon: ListOrderedIcon,
    goal: "Offene Aufgaben nach Fälligkeit und Priorität ordnen.",
  },
  {
    key: "risk-watch",
    label: "Risiken prüfen",
    icon: RadarIcon,
    goal: "Überfällige Vorgänge und Auffälligkeiten prüfen.",
  },
] as const;

export function BriefingPanel({
  instanceId,
  availableCapabilities,
  canRun,
}: {
  instanceId: string;
  availableCapabilities: string[];
  canRun: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function run(capabilityKey: string, goal: string) {
    setPending(capabilityKey);
    const result = await startManualRun(instanceId, capabilityKey, goal);
    setPending(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  const usable = ACTIONS.filter((a) => availableCapabilities.includes(a.key));

  return (
    <div className="flex flex-wrap gap-2">
      {usable.map((action) => (
        <Button
          key={action.key}
          size="sm"
          variant="outline"
          disabled={!canRun || pending !== null}
          onClick={() => run(action.key, action.goal)}
        >
          {pending === action.key ? <Spinner /> : <action.icon />}
          {action.label}
        </Button>
      ))}
      {!canRun ? (
        <p className="self-center text-sm text-muted-foreground">
          Ihre Rolle darf keine Läufe starten.
        </p>
      ) : null}
    </div>
  );
}
