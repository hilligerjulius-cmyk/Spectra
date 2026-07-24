"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

export interface RunStepView {
  index: number;
  phase: string;
  title: string;
  status: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface RunView {
  id: string;
  agentName: string;
  goal: string;
  capabilityKey: string;
  status: string;
  summary: string | null;
  sandbox: boolean;
  trigger: string;
  costDeciCents: number;
  durationMs: number | null;
  model: string | null;
  createdAt: string;
  steps: RunStepView[];
}

const phaseLabels: Record<string, string> = {
  plan: "Planung",
  retrieve: "Datenabruf",
  reason: "Analyse",
  draft: "Entwurf",
  validate: "Prüfung",
  request_approval: "Freigabe angefordert",
  execute: "Ausführung",
  verify: "Verifikation",
  report: "Ergebnis",
};

const triggerLabels: Record<string, string> = {
  manual: "Manuell",
  schedule: "Zeitplan",
  event: "Ereignis",
  delegation: "Delegation",
  sandbox_test: "Sandbox-Test",
};

export function RunTimeline({ runs }: { runs: RunView[] }) {
  const [open, setOpen] = React.useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => {
        const expanded = open.has(run.id);
        return (
          <Card key={run.id} className="overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(run.id)}
              aria-expanded={expanded}
              className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 cursor-pointer"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{run.goal}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {run.agentName} · {triggerLabels[run.trigger] ?? run.trigger} ·{" "}
                  {new Date(run.createdAt).toLocaleString("de-DE")}
                </p>
                {run.summary ? (
                  <p className="mt-1.5 line-clamp-2 text-sm">{run.summary}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex gap-1.5">
                  {run.sandbox ? <Badge variant="warning">Sandbox</Badge> : null}
                  <StatusBadge status={run.status} />
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {run.steps.length} Schritte
                  {run.durationMs != null ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ""}
                  {run.costDeciCents > 0
                    ? ` · ${(run.costDeciCents / 1000).toFixed(3)} €`
                    : ""}
                </p>
                <ChevronDownIcon
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </div>
            </button>

            {expanded ? (
              <div className="border-t bg-muted/20 px-4 py-3">
                <ol className="relative space-y-0 border-l border-border pl-5">
                  {run.steps.map((step) => (
                    <li key={step.index} className="relative pb-4 last:pb-1">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -left-[26px] top-1 size-2.5 rounded-full border-2 border-background",
                          step.status === "error"
                            ? "bg-status-error"
                            : step.status === "blocked"
                              ? "bg-status-warning"
                              : step.phase === "request_approval"
                                ? "bg-status-approval"
                                : "bg-primary",
                        )}
                      />
                      <p className="text-sm font-medium">
                        <span className="mr-2 text-xs uppercase tracking-wide text-muted-foreground">
                          {phaseLabels[step.phase] ?? step.phase}
                        </span>
                        {step.title}
                      </p>
                      {step.detail && Object.keys(step.detail).length > 0 ? (
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 text-xs text-muted-foreground">
                          {JSON.stringify(step.detail, null, 2)}
                        </pre>
                      ) : null}
                    </li>
                  ))}
                </ol>
                {run.model ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Modell: {run.model}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
