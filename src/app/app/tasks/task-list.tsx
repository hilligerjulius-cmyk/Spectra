"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setTaskStatus } from "@/server/agents/run-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  agentName: string | null;
  createdByType: string;
  createdAt: string;
}

const priorityBadge: Record<string, { label: string; variant: "secondary" | "warning" | "error" }> = {
  low: { label: "Niedrig", variant: "secondary" },
  normal: { label: "Normal", variant: "secondary" },
  high: { label: "Hoch", variant: "warning" },
  urgent: { label: "Dringend", variant: "error" },
};

export function TaskList({
  tasks,
  canManage,
}: {
  tasks: TaskView[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"open" | "all" | "done">("open");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const filtered = tasks.filter((t) =>
    filter === "all"
      ? true
      : filter === "done"
        ? t.status === "done"
        : t.status !== "done" && t.status !== "cancelled",
  );

  async function toggleDone(t: TaskView, done: boolean) {
    setPendingId(t.id);
    const result = await setTaskStatus(t.id, done ? "done" : "open");
    setPendingId(null);
    if (result.ok) router.refresh();
    else toast.error(result.message);
  }

  return (
    <div className="space-y-4">
      <div className="w-48">
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger aria-label="Aufgaben filtern">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Offene Aufgaben</SelectItem>
            <SelectItem value="done">Erledigte</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map((t) => {
          const overdue =
            t.dueAt && t.status !== "done" && new Date(t.dueAt) < new Date();
          return (
            <Card key={t.id} className="flex items-start gap-3 p-4">
              <Checkbox
                className="mt-1"
                aria-label={`Aufgabe "${t.title}" als erledigt markieren`}
                checked={t.status === "done"}
                disabled={!canManage || pendingId === t.id}
                onCheckedChange={(checked) => toggleDone(t, Boolean(checked))}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-medium",
                    t.status === "done" && "text-muted-foreground line-through",
                  )}
                >
                  {t.title}
                </p>
                {t.description ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {t.description}
                  </p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {t.agentName ? (
                    <Badge variant="secondary">von {t.agentName}</Badge>
                  ) : null}
                  <Badge variant={priorityBadge[t.priority]?.variant ?? "secondary"}>
                    {priorityBadge[t.priority]?.label ?? t.priority}
                  </Badge>
                  {t.dueAt ? (
                    <span className={cn(overdue && "font-medium text-status-error")}>
                      Fällig: {new Date(t.dueAt).toLocaleDateString("de-DE")}
                      {overdue ? " (überfällig)" : ""}
                    </span>
                  ) : null}
                </div>
              </div>
              <StatusBadge
                status={
                  t.status === "open"
                    ? "pending"
                    : t.status === "done"
                      ? "completed"
                      : t.status
                }
              />
            </Card>
          );
        })}
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine Aufgaben in dieser Ansicht.
          </p>
        ) : null}
      </div>
    </div>
  );
}
