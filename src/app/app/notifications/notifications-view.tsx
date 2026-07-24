"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { markNotificationRead } from "@/server/notifications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

const typeVariant: Record<
  string,
  "default" | "secondary" | "warning" | "error" | "approval" | "active"
> = {
  approval_required: "approval",
  agent_failed: "error",
  risk_detected: "warning",
  task_overdue: "warning",
  cost_limit: "warning",
  integration_disconnected: "warning",
  workflow_completed: "active",
  uncertain_classification: "secondary",
  info: "secondary",
};

export function NotificationsView({
  items,
  typeLabels,
  unreadCount,
}: {
  items: NotificationItem[];
  typeLabels: Record<string, string>;
  unreadCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function run(key: string, id?: string) {
    setPending(key);
    const result = await markNotificationRead(id);
    setPending(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BellIcon />}
        title="Keine Meldungen"
        description="Hier erscheinen wartende Freigaben, fehlgeschlagene Läufe und erkannte Risiken. Welche Anlässe Sie erreichen, stellen Sie unter Settings ein."
        action={
          <Button variant="outline" asChild>
            <Link href="/app/settings">Zu den Einstellungen</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {unreadCount} ungelesene Meldung(en)
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={pending === "all"}
            onClick={() => run("all")}
          >
            {pending === "all" ? <Spinner /> : <CheckCheckIcon />}
            Alle als gelesen markieren
          </Button>
        </div>
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Card className={item.read ? "opacity-70" : "border-primary/30"}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={typeVariant[item.type] ?? "secondary"}>
                      {typeLabels[item.type] ?? item.type}
                    </Badge>
                    {!item.read ? (
                      <span className="size-1.5 rounded-full bg-primary" />
                    ) : null}
                  </div>
                  <p className="font-medium">{item.title}</p>
                  {item.body ? (
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("de-DE")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  {item.href ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={item.href}>Öffnen</Link>
                    </Button>
                  ) : null}
                  {!item.read ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending === item.id}
                      onClick={() => run(item.id, item.id)}
                    >
                      {pending === item.id ? <Spinner /> : null}
                      Gelesen
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
