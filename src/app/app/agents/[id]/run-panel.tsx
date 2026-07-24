"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FlaskConicalIcon, PlayIcon } from "lucide-react";
import { startManualRun, startSandboxTest } from "@/server/agents/run-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
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

export function RunPanel({
  instanceId,
  status,
  sandboxPassed,
  capabilities,
  canTest,
  canRun,
}: {
  instanceId: string;
  status: string;
  sandboxPassed: boolean;
  capabilities: { key: string; name: string }[];
  canTest: boolean;
  canRun: boolean;
}) {
  const router = useRouter();
  const [sandboxPending, setSandboxPending] = React.useState(false);
  const [runPending, setRunPending] = React.useState(false);
  const [capability, setCapability] = React.useState(capabilities[0]?.key ?? "");
  const [inputText, setInputText] = React.useState("");

  async function runSandbox() {
    setSandboxPending(true);
    const result = await startSandboxTest(instanceId);
    setSandboxPending(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function runManual() {
    setRunPending(true);
    const result = await startManualRun(instanceId, capability, inputText);
    setRunPending(false);
    if (result.ok) {
      toast.success(result.message);
      setInputText("");
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sandbox-Testlauf</CardTitle>
          <CardDescription>
            Führt die erste Fähigkeit mit kuratierten Demo-Daten und dem
            deterministischen Test-Provider aus — ohne Zugriff auf echte
            Systeme. {sandboxPassed ? "Bereits bestanden ✓" : "Voraussetzung für die Aktivierung."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={runSandbox}
            disabled={!canTest || sandboxPending}
            variant={sandboxPassed ? "outline" : "default"}
          >
            {sandboxPending ? <Spinner /> : <FlaskConicalIcon />}
            {sandboxPassed ? "Testlauf erneut ausführen" : "Testlauf starten"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aufgabe zuweisen (manueller Lauf)</CardTitle>
          <CardDescription>
            Übergeben Sie dem Agenten Text (z. B. eine E-Mail, ein Protokoll
            oder Vorgangsdaten). Der Lauf respektiert die eingestellten
            Automatisierungsstufen — risikoreiche Aktionen landen im Approval
            Center.
            {status === "sandbox"
              ? " Der Agent ist im Sandbox-Modus: Ergebnisse werden als [SANDBOX] markiert."
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="capability">Fähigkeit</Label>
            <Select value={capability} onValueChange={setCapability}>
              <SelectTrigger id="capability" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {capabilities.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="runInput">Eingabedaten</Label>
            <Textarea
              id="runInput"
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="z. B. E-Mail-Text, Meeting-Protokoll oder Vorgangsbeschreibung einfügen…"
            />
          </div>
          <Button
            onClick={runManual}
            disabled={!canRun || runPending || !inputText.trim() || !capability}
          >
            {runPending ? <Spinner /> : <PlayIcon />}
            Lauf starten
          </Button>
          {!canRun ? (
            <p className="text-xs text-muted-foreground">
              Ihre Rolle darf keine Läufe starten.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
