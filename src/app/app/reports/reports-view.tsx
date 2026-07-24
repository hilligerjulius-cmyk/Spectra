"use client";

import * as React from "react";
import Link from "next/link";
import { InfoIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ReportView {
  periodDays: number;
  stats: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    waitingRuns: number;
    cancelledRuns: number;
    successRate: number;
    totalCostDeciCents: number;
    averageDurationMs: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
  };
  agents: {
    instanceId: string;
    displayName: string;
    roleTitle: string;
    runs: number;
    completed: number;
    failed: number;
    successRate: number;
    costDeciCents: number;
    averageDurationMs: number;
    estimatedMinutesSaved: number;
    lastRunAt: string | null;
  }[];
  approvals: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    approvalRate: number;
    medianDecisionMinutes: number | null;
  };
  tasks: {
    total: number;
    open: number;
    done: number;
    overdue: number;
    byAgent: number;
  };
  dailyRuns: { date: string; completed: number; failed: number }[];
  estimatedMinutesSaved: number;
  costsAreZeroBecauseScripted: boolean;
  aiProviderIsReal: boolean;
}

function euro(deciCents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(deciCents / 1000);
}

function duration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function hoursMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  return `${Math.floor(minutes / 60)} Std. ${minutes % 60} Min.`;
}

export function ReportsView({
  report,
  periodDays,
}: {
  report: ReportView;
  periodDays: number;
}) {
  const hasData = report.stats.totalRuns > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((days) => (
          <Button
            key={days}
            size="sm"
            variant={days === periodDays ? "default" : "outline"}
            asChild
          >
            <Link href={`/app/reports?tage=${days}`}>Letzte {days} Tage</Link>
          </Button>
        ))}
      </div>

      {!hasData ? (
        <EmptyState
          icon={<InfoIcon />}
          title="Noch keine Läufe im gewählten Zeitraum"
          description="Berichte entstehen ausschließlich aus tatsächlichen Agentenläufen. Es werden keine Beispielzahlen angezeigt. Sandbox-Testläufe zählen bewusst nicht mit, da sie Tests messen und nicht geleistete Arbeit."
          action={
            <Button asChild>
              <Link href="/app/workforce">Zur Belegschaft</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Läufe</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {report.stats.totalRuns}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                {report.stats.completedRuns} abgeschlossen ·{" "}
                {report.stats.failedRuns} fehlgeschlagen ·{" "}
                {report.stats.waitingRuns} wartend
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Erfolgsquote</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {report.stats.successRate} %
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Anteil abgeschlossener an beendeten Läufen
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>KI-Kosten</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {euro(report.stats.totalCostDeciCents)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                {report.stats.totalPromptTokens +
                  report.stats.totalCompletionTokens}{" "}
                Token verarbeitet
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Mittlere Laufzeit</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {duration(report.stats.averageDurationMs)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                über alle Läufe des Zeitraums
              </CardContent>
            </Card>
          </div>

          {report.costsAreZeroBecauseScripted ? (
            <Alert variant="info">
              <InfoIcon />
              <AlertTitle>KI-Kosten sind 0,00 € — das ist korrekt</AlertTitle>
              <AlertDescription>
                Ohne hinterlegten Anthropic-Schlüssel läuft die Plattform mit
                dem deterministischen, regelbasierten Provider. Es entstehen
                tatsächlich keine Modellkosten. Sobald ein Schlüssel hinterlegt
                ist, erscheinen hier echte Kosten je Lauf.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Läufe im Zeitverlauf</CardTitle>
              <CardDescription>
                Abgeschlossene und fehlgeschlagene Läufe je Tag
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.dailyRuns}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => d.slice(5)}
                      className="text-xs"
                      stroke="currentColor"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      className="text-xs"
                      stroke="currentColor"
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "0.5rem",
                        fontSize: "0.8rem",
                      }}
                      labelFormatter={(label) =>
                        typeof label === "string"
                          ? new Date(label).toLocaleDateString("de-DE")
                          : label
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      name="Abgeschlossen"
                      stroke="var(--color-status-active)"
                      fill="var(--color-status-active)"
                      fillOpacity={0.15}
                    />
                    <Area
                      type="monotone"
                      dataKey="failed"
                      name="Fehlgeschlagen"
                      stroke="var(--color-status-error)"
                      fill="var(--color-status-error)"
                      fillOpacity={0.15}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Freigaben</CardTitle>
                <CardDescription>
                  Wie schnell und wie oft wurde entschieden?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Angefragt</span>
                  <span className="tabular-nums">
                    {report.approvals.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Genehmigt</span>
                  <span className="tabular-nums">
                    {report.approvals.approved}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Abgelehnt</span>
                  <span className="tabular-nums">
                    {report.approvals.rejected}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Noch offen</span>
                  <span className="tabular-nums">
                    {report.approvals.pending}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Zustimmungsquote</span>
                  <span className="tabular-nums">
                    {report.approvals.total > 0
                      ? `${report.approvals.approvalRate} %`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Median-Entscheidungsdauer
                  </span>
                  <span className="tabular-nums">
                    {report.approvals.medianDecisionMinutes !== null
                      ? hoursMinutes(report.approvals.medianDecisionMinutes)
                      : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aufgaben</CardTitle>
                <CardDescription>
                  Aktueller Bestand — nicht auf den Zeitraum begrenzt
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Insgesamt</span>
                  <span className="tabular-nums">{report.tasks.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Offen</span>
                  <span className="tabular-nums">{report.tasks.open}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Erledigt</span>
                  <span className="tabular-nums">{report.tasks.done}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Überfällig</span>
                  <span className="tabular-nums text-status-error">
                    {report.tasks.overdue}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">
                    Von Agenten angelegt
                  </span>
                  <span className="tabular-nums">{report.tasks.byAgent}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leistung je Agent</CardTitle>
              <CardDescription>
                Nur Agenten mit tatsächlichen Läufen im Zeitraum
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Läufe</TableHead>
                      <TableHead className="text-right">Erfolgsquote</TableHead>
                      <TableHead className="text-right">Ø Dauer</TableHead>
                      <TableHead className="text-right">Kosten</TableHead>
                      <TableHead className="text-right">
                        Zeitersparnis (Schätzung)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.agents.map((a) => (
                      <TableRow key={a.instanceId}>
                        <TableCell>
                          <Link
                            href={`/app/agents/${a.instanceId}`}
                            className="font-medium hover:underline"
                          >
                            {a.displayName}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {a.roleTitle}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.runs}
                          {a.failed > 0 ? (
                            <Badge variant="error" className="ml-1.5">
                              {a.failed} Fehler
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.successRate} %
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {duration(a.averageDurationMs)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {euro(a.costDeciCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          ~{hoursMinutes(a.estimatedMinutesSaved)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <InfoIcon />
            <AlertTitle>Woher die Zahlen stammen</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>
                  Läufe, Erfolgsquote, Dauer, Kosten und Token sind{" "}
                  <strong>gemessen</strong> — sie stammen unverändert aus den
                  protokollierten Agentenläufen dieser Organisation.
                </li>
                <li>
                  Die Zeitersparnis (insgesamt ~
                  {hoursMinutes(report.estimatedMinutesSaved)}) ist{" "}
                  <strong>geschätzt</strong>: je abgeschlossenem Lauf wird ein
                  fester, bewusst konservativer Minutenwert je Fähigkeitstyp
                  angesetzt. Das ist eine Annahme, keine Messung, und eignet
                  sich nicht als Abrechnungsgrundlage.
                </li>
                <li>
                  Sandbox-Testläufe sind ausgeschlossen. Sie messen Tests, nicht
                  geleistete Arbeit.
                </li>
              </ul>
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
