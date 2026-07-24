"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PauseIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";
import {
  removeAgent,
  renameAgent,
  setAgentStatus,
} from "@/server/agents/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AgentSettings({
  instanceId,
  displayName,
  status,
  sandboxPassed,
  canConfigure,
  canActivate,
}: {
  instanceId: string;
  displayName: string;
  status: string;
  sandboxPassed: boolean;
  canConfigure: boolean;
  canActivate: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(displayName);
  const [pending, startTransition] = React.useTransition();
  const [removeOpen, setRemoveOpen] = React.useState(false);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name</CardTitle>
          <CardDescription>
            Geben Sie Ihrem digitalen Mitarbeiter einen eigenen Namen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex max-w-sm items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameAgent(instanceId, name));
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="agentName">Anzeigename</Label>
              <Input
                id="agentName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canConfigure}
                minLength={2}
                maxLength={60}
              />
            </div>
            <Button
              type="submit"
              disabled={!canConfigure || pending || name === displayName}
            >
              Speichern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
          <CardDescription>
            {status === "sandbox" && !sandboxPassed
              ? "Aktivierung ist erst nach einem bestandenen Sandbox-Testlauf möglich."
              : "Pausierte Agenten führen keine neuen Läufe aus."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {status === "active" ? (
            <Button
              variant="outline"
              disabled={!canActivate || pending}
              onClick={() => run(() => setAgentStatus(instanceId, "paused"))}
            >
              {pending ? <Spinner /> : <PauseIcon />} Pausieren
            </Button>
          ) : (
            <Button
              disabled={
                !canActivate || pending || (status === "sandbox" && !sandboxPassed)
              }
              title={
                status === "sandbox" && !sandboxPassed
                  ? "Sandbox-Testlauf erforderlich"
                  : undefined
              }
              onClick={() => run(() => setAgentStatus(instanceId, "active"))}
            >
              {pending ? <Spinner /> : <PlayIcon />} Aktivieren
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Agent entfernen</CardTitle>
          <CardDescription>
            Entfernt den Agenten aus Ihrem Team. Das Aktivitätsprotokoll bleibt
            aus Revisionsgründen erhalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={!canActivate}>
                <Trash2Icon /> Entfernen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{displayName} wirklich entfernen?</DialogTitle>
                <DialogDescription>
                  Der Agent wird deaktiviert und aus Ihrem Team entfernt. Diese
                  Aktion können Sie rückgängig machen, indem Sie den Agenten im
                  Marketplace erneut einstellen — die Konfiguration geht dabei
                  jedoch verloren.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRemoveOpen(false)}>
                  Abbrechen
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await removeAgent(instanceId);
                      if (result.ok) {
                        toast.success(result.message);
                        router.push("/app/workforce");
                        router.refresh();
                      } else {
                        toast.error(result.message);
                        setRemoveOpen(false);
                      }
                    })
                  }
                >
                  {pending ? <Spinner /> : null}
                  Endgültig entfernen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
