"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CopyIcon,
  DownloadIcon,
  KeyRoundIcon,
  UploadIcon,
} from "lucide-react";
import {
  createWebhookSecret,
  exportCsvFile,
  importCsvFile,
} from "@/server/integrations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  IMPORT_TARGETS,
  IMPORT_TARGET_LABELS,
  TARGET_COLUMNS,
  type ImportTarget,
} from "@/lib/csv-targets";

export interface WebhookView {
  url: string;
  secretMasked: string | null;
  toleranceSeconds: number;
  eventCount: number;
  lastEventAt: string | null;
}

export function DataExchange({
  webhook,
  canManage,
  appUrl,
}: {
  webhook: WebhookView | null;
  canManage: boolean;
  appUrl: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [freshSecret, setFreshSecret] = React.useState<string | null>(null);
  const [importTarget, setImportTarget] =
    React.useState<ImportTarget>("tasks");
  const [exportTarget, setExportTarget] = React.useState("tasks");
  const [problems, setProblems] = React.useState<
    { row: number; reason: string }[]
  >([]);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const url = webhook?.url ?? `${appUrl}/api/webhooks/<organisation-id>`;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} kopiert.`);
    } catch {
      toast.error("Kopieren nicht möglich — bitte manuell markieren.");
    }
  }

  async function rotate() {
    setPending("secret");
    const result = await createWebhookSecret();
    setPending(null);
    if (result.ok) {
      setFreshSecret(result.secret ?? null);
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending("import");
    setProblems([]);
    const content = await file.text();
    const result = await importCsvFile(importTarget, content);
    setPending(null);
    if (fileInput.current) fileInput.current.value = "";
    setProblems(result.problems ?? []);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function handleExport() {
    setPending("export");
    const result = await exportCsvFile(
      exportTarget as "tasks" | "deals" | "runs",
    );
    setPending(null);
    if (!result.ok || !result.content) {
      toast.error(result.message);
      return;
    }
    // Download im Browser auslösen — die Datei entsteht erst hier.
    const blob = new Blob([result.content], {
      type: "text/csv;charset=utf-8",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = result.filename ?? "export.csv";
    link.click();
    URL.revokeObjectURL(href);
    toast.success(result.message);
  }

  const columns = TARGET_COLUMNS[importTarget];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook (generisch)</CardTitle>
          <CardDescription>
            Für Systeme ohne fertigen Connector: Ihr System sendet signierte
            Ereignisse, die Plattform legt daraus einen Vorgang an.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Endpunkt</Label>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button
                size="icon"
                variant="outline"
                aria-label="Endpunkt kopieren"
                onClick={() => copy(url, "Endpunkt")}
              >
                <CopyIcon />
              </Button>
            </div>
          </div>

          {webhook ? (
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-muted-foreground">Signaturgeheimnis</p>
                <p className="font-mono text-xs">
                  {webhook.secretMasked ?? "nicht lesbar"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Empfangene Ereignisse</p>
                <p className="tabular-nums">{webhook.eventCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Zuletzt</p>
                <p>
                  {webhook.lastEventAt
                    ? new Date(webhook.lastEventAt).toLocaleString("de-DE")
                    : "—"}
                </p>
              </div>
            </div>
          ) : (
            <Alert variant="info">
              <KeyRoundIcon />
              <AlertTitle>Noch nicht eingerichtet</AlertTitle>
              <AlertDescription>
                Erzeugen Sie ein Signaturgeheimnis, um den Endpunkt zu
                aktivieren. Ohne gültige Signatur werden alle Aufrufe abgelehnt.
              </AlertDescription>
            </Alert>
          )}

          {freshSecret ? (
            <Alert variant="warning">
              <KeyRoundIcon />
              <AlertTitle>Geheimnis jetzt notieren</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Es wird nur dieses eine Mal angezeigt und danach ausschließlich
                  verschlüsselt gespeichert.
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={freshSecret}
                    className="font-mono text-xs"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Geheimnis kopieren"
                    onClick={() => copy(freshSecret, "Geheimnis")}
                  >
                    <CopyIcon />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              So signieren Sie einen Aufruf
            </summary>
            <div className="mt-3 space-y-2 text-muted-foreground">
              <p>
                Bilden Sie HMAC-SHA256 über die Zeichenkette{" "}
                <code className="rounded bg-muted px-1">
                  {"<unix-sekunden>.<rohtext des body>"}
                </code>{" "}
                mit dem Geheimnis als Schlüssel und senden Sie:
              </p>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                {`POST ${url}
Content-Type: application/json
X-Workforce-Timestamp: 1800000000
X-Workforce-Signature: <hex-digest>

{"event":"invoice.received","title":"Rechnung prüfen","priority":"high"}`}
              </pre>
              <p>
                Zeitstempel älter als {webhook?.toleranceSeconds ?? 300} Sekunden
                werden abgelehnt (Schutz vor Wiedereinspielung).
              </p>
            </div>
          </details>

          {canManage ? (
            <Button
              size="sm"
              variant={webhook ? "outline" : "default"}
              disabled={pending === "secret"}
              onClick={rotate}
            >
              {pending === "secret" ? <Spinner /> : <KeyRoundIcon />}
              {webhook
                ? "Neues Geheimnis erzeugen"
                : "Signaturgeheimnis erzeugen"}
            </Button>
          ) : null}
          {webhook && canManage ? (
            <p className="text-xs text-muted-foreground">
              Ein neues Geheimnis macht das bisherige sofort ungültig. Stellen
              Sie sendende Systeme vorher um.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CSV-Import</CardTitle>
            <CardDescription>
              Semikolon, Komma und Tabulator werden erkannt; ein BOM aus Excel
              stört nicht.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="importTarget">Ziel</Label>
              <Select value={importTarget} onValueChange={(v) => setImportTarget(v as ImportTarget)}>
                <SelectTrigger id="importTarget">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_TARGETS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {IMPORT_TARGET_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Pflichtspalten:{" "}
              {columns.required.map((c) => (
                <Badge key={c} variant="outline" className="mr-1">
                  {c}
                </Badge>
              ))}
              {columns.optional.length > 0 ? (
                <>
                  <br />
                  Optional:{" "}
                  {columns.optional.map((c) => (
                    <Badge key={c} variant="secondary" className="mr-1">
                      {c}
                    </Badge>
                  ))}
                </>
              ) : null}
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              size="sm"
              disabled={!canManage || pending === "import"}
              onClick={() => fileInput.current?.click()}
            >
              {pending === "import" ? <Spinner /> : <UploadIcon />}
              CSV-Datei auswählen
            </Button>
            {problems.length > 0 ? (
              <Alert variant="warning">
                <AlertTitle>
                  {problems.length} Zeile(n) mit Auffälligkeiten
                </AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                    {problems.map((p) => (
                      <li key={`${p.row}-${p.reason}`}>
                        Zeile {p.row}: {p.reason}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">CSV-Export</CardTitle>
            <CardDescription>
              Nur Daten Ihrer Organisation, direkt in Excel oder Numbers zu
              öffnen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="exportTarget">Datensatz</Label>
              <Select value={exportTarget} onValueChange={setExportTarget}>
                <SelectTrigger id="exportTarget">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tasks">Aufgaben</SelectItem>
                  <SelectItem value="deals">Deals</SelectItem>
                  <SelectItem value="runs">Agentenläufe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={pending === "export"}
              onClick={handleExport}
            >
              {pending === "export" ? <Spinner /> : <DownloadIcon />}
              Exportieren
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
