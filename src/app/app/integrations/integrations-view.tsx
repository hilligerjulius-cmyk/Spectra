"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ConstructionIcon,
  KeyRoundIcon,
  MailIcon,
  SparklesIcon,
} from "lucide-react";
import {
  connectIntegration,
  disconnectIntegration,
  disableDemoMode,
  enableDemoMode,
} from "@/server/integrations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ConnectorView {
  key: string;
  name: string;
  category: string;
  description: string;
  status: "implemented" | "credentials_required" | "planned";
  available: boolean;
  requiredEnv: string[];
  setupNote: string | null;
  connectionStatus: string | null;
}

interface EmailView {
  id: string;
  direction: string;
  status: string;
  from: string;
  to: string;
  subject: string;
  category: string | null;
  urgency: string | null;
  suspicious: boolean;
  triaged: boolean;
  demo: boolean;
}

const categoryLabels: Record<string, string> = {
  email: "E-Mail",
  calendar: "Kalender",
  crm: "CRM",
  files: "Dateien",
  accounting: "Buchhaltung",
  chat: "Chat",
  generic: "Allgemein",
};

export function IntegrationsView({
  connectors,
  canManage,
  demoActive,
  stats,
  recentEmails,
}: {
  connectors: ConnectorView[];
  canManage: boolean;
  demoActive: boolean;
  stats: {
    inboxCount: number;
    untriagedCount: number;
    outboxCount: number;
    eventCount: number;
  };
  recentEmails: EmailView[];
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [demoPending, setDemoPending] = React.useState(false);

  async function toggle(connector: ConnectorView) {
    setPendingKey(connector.key);
    const result =
      connector.connectionStatus === "connected"
        ? await disconnectIntegration(connector.key)
        : await connectIntegration(connector.key);
    setPendingKey(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function toggleDemo() {
    setDemoPending(true);
    const result = demoActive ? await disableDemoMode() : await enableDemoMode();
    setDemoPending(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  const implemented = connectors.filter((c) => c.status === "implemented");
  const needsCredentials = connectors.filter(
    (c) => c.status === "credentials_required",
  );
  const planned = connectors.filter((c) => c.status === "planned");

  function ConnectorCard({ connector }: { connector: ConnectorView }) {
    const connected = connector.connectionStatus === "connected";
    return (
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{connector.name}</CardTitle>
              <CardDescription>
                {categoryLabels[connector.category] ?? connector.category}
              </CardDescription>
            </div>
            {connected ? (
              <Badge variant="active">
                <CheckCircle2Icon /> Verbunden
              </Badge>
            ) : connector.status === "planned" ? (
              <Badge variant="paused">
                <ConstructionIcon /> Nicht implementiert
              </Badge>
            ) : connector.status === "credentials_required" ? (
              <Badge variant="warning">
                <KeyRoundIcon /> Zugangsdaten nötig
              </Badge>
            ) : (
              <Badge variant="secondary">Verfügbar</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <p className="text-sm text-muted-foreground">{connector.description}</p>
          {connector.requiredEnv.length > 0 && !connector.available ? (
            <p className="rounded-md border border-status-warning/40 bg-status-warning/8 p-2 text-xs">
              Benötigte Environment-Variablen:{" "}
              <span className="font-mono">{connector.requiredEnv.join(", ")}</span>
              {connector.setupNote ? ` — ${connector.setupNote}` : ""}
            </p>
          ) : null}
          {connector.status === "planned" && connector.setupNote ? (
            <p className="text-xs text-muted-foreground">{connector.setupNote}</p>
          ) : null}
          <div className="mt-auto pt-2">
            <Button
              size="sm"
              variant={connected ? "outline" : "default"}
              disabled={
                !canManage || !connector.available || pendingKey === connector.key
              }
              onClick={() => toggle(connector)}
            >
              {pendingKey === connector.key ? <Spinner /> : null}
              {connected ? "Trennen" : "Verbinden"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Alert variant={demoActive ? "warning" : "info"}>
        <SparklesIcon />
        <AlertTitle>
          {demoActive ? "Demo-Modus aktiv" : "Demo-Modus"}
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {demoActive
              ? "Diese Organisation enthält klar gekennzeichnete Demo-Daten (E-Mails, Termine, Deals, Dokumente). Alle Datensätze tragen die Markierung „Demo“ und dürfen nicht mit Produktivdaten verwechselt werden."
              : "Erzeugen Sie realistische, klar gekennzeichnete Beispieldaten eines B2B-Dienstleisters, um alle Agenten sofort ausprobieren zu können — inklusive Postfach, Kalender, offener Angebote und Wissensdokumente."}
          </p>
          <Button
            size="sm"
            variant={demoActive ? "outline" : "default"}
            disabled={!canManage || demoPending}
            onClick={toggleDemo}
          >
            {demoPending ? <Spinner /> : null}
            {demoActive ? "Demo-Daten entfernen" : "Demo-Daten erzeugen"}
          </Button>
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Posteingang", value: stats.inboxCount },
          { label: "Nicht triagiert", value: stats.untriagedCount },
          { label: "Ausgehend", value: stats.outboxCount },
          { label: "Termine", value: stats.eventCount },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="connectors">
        <TabsList>
          <TabsTrigger value="connectors">Connectoren</TabsTrigger>
          <TabsTrigger value="mailbox">Demo-Postfach</TabsTrigger>
        </TabsList>

        <TabsContent value="connectors" className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold">
              Vollständig implementiert
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {implemented.map((c) => (
                <ConnectorCard key={c.key} connector={c} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">
              Implementiert, Zugangsdaten erforderlich
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Der Adapter ist vorhanden; ohne hinterlegte Zugangsdaten kann er
              nicht verbunden werden.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {needsCredentials.map((c) => (
                <ConnectorCard key={c.key} connector={c} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">Noch nicht implementiert</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Diese Connectoren sind vorgesehen, aber bewusst nicht als
              funktionsfähig dargestellt. Bis dahin: CSV-Import oder Webhooks.
            </p>
            <div className="flex flex-wrap gap-2">
              {planned.map((c) => (
                <Badge key={c.key} variant="paused" className="px-3 py-1">
                  <ConstructionIcon /> {c.name}
                </Badge>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="mailbox">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Demo-Postfach ({recentEmails.length} zuletzt)
              </CardTitle>
              <CardDescription>
                Ausgehende Nachrichten verbleiben in der Plattform und werden
                nicht an echte Empfänger versendet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentEmails.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Keine Nachrichten. Erzeugen Sie Demo-Daten, um das Postfach zu
                  füllen.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentEmails.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium">
                          <MailIcon className="size-3.5 shrink-0" />
                          {m.subject}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {m.direction === "inbound"
                            ? `von ${m.from}`
                            : `an ${m.to}`}{" "}
                          · {m.status}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        {m.demo ? <Badge variant="demo">Demo</Badge> : null}
                        {m.suspicious ? (
                          <Badge variant="error">
                            <AlertTriangleIcon /> Verdächtig
                          </Badge>
                        ) : null}
                        {m.category ? (
                          <Badge variant="secondary">{m.category}</Badge>
                        ) : null}
                        {m.urgency ? (
                          <Badge
                            variant={
                              m.urgency === "kritisch"
                                ? "error"
                                : m.urgency === "hoch"
                                  ? "warning"
                                  : "outline"
                            }
                          >
                            {m.urgency}
                          </Badge>
                        ) : null}
                        {m.direction === "inbound" && !m.triaged ? (
                          <Badge variant="outline">nicht triagiert</Badge>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
