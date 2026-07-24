import { Badge } from "@/components/ui/badge";

/**
 * Vereinheitlichte Status-Anzeige für Agenten, Runs und Freigaben.
 */
export type EntityStatus =
  | "active"
  | "paused"
  | "draft"
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "disabled";

const statusConfig: Record<
  EntityStatus,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  active: { label: "Aktiv", variant: "active" },
  paused: { label: "Pausiert", variant: "paused" },
  draft: { label: "Entwurf", variant: "secondary" },
  pending: { label: "Ausstehend", variant: "secondary" },
  running: { label: "Läuft", variant: "approval" },
  waiting_approval: { label: "Wartet auf Freigabe", variant: "approval" },
  completed: { label: "Abgeschlossen", variant: "active" },
  failed: { label: "Fehlgeschlagen", variant: "error" },
  cancelled: { label: "Abgebrochen", variant: "paused" },
  disabled: { label: "Deaktiviert", variant: "paused" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: EntityStatus | string;
  className?: string;
}) {
  const config = statusConfig[status as EntityStatus] ?? {
    label: status,
    variant: "secondary" as const,
  };
  return (
    <Badge variant={config.variant} className={className}>
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-current"
      />
      {config.label}
    </Badge>
  );
}
