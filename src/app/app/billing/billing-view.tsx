"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  CheckIcon,
  FileTextIcon,
  InfoIcon,
  TicketIcon,
} from "lucide-react";
import {
  cancelPlan,
  clearCoupon,
  createInvoiceForCurrentPeriod,
  redeemCoupon,
  resumePlan,
  selectPlan,
} from "@/server/billing/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface PlanView {
  key: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPricePerMonthCents: number;
  includedAgentSeats: number;
  includedRuns: number;
  includedAiCostDeciCents: number;
  maxTeamMembers: number | null;
  features: string[];
  setupFeeCents: number;
  yearlySavingsPercent: number;
}

export interface InvoiceView {
  id: string;
  number: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  provider: string;
  lineItems: { label: string; amountCents: number }[];
}

export interface BillingSummaryView {
  planKey: string;
  planName: string;
  billingInterval: "monthly" | "yearly";
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  platformFeeCents: number;
  agentLines: { key: string; label: string; monthlyCents: number }[];
  bundleLines: { key: string; label: string; monthlyCents: number }[];
  includedAgentSeats: number;
  billableAgentCount: number;
  volumeDiscountCents: number;
  volumeDiscountPercent: number;
  couponCode: string | null;
  couponPercent: number;
  couponDiscountCents: number;
  totalMonthlyCents: number;
  usage: {
    runs: { used: number; included: number };
    aiCostDeciCents: { used: number; included: number };
  };
  limitReached: boolean;
  limitWarning: boolean;
}

export interface ProviderInfo {
  key: string;
  displayName: string;
  isReal: boolean;
  statusNote: string;
}

function euro(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const statusLabels: Record<string, string> = {
  trialing: "Testphase",
  active: "Aktiv",
  past_due: "Zahlung überfällig",
  canceled: "Gekündigt",
};

export function BillingView({
  summary,
  plans,
  invoices,
  provider,
  canManage,
}: {
  summary: BillingSummaryView;
  plans: PlanView[];
  invoices: InvoiceView[];
  provider: ProviderInfo;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [yearly, setYearly] = React.useState(
    summary.billingInterval === "yearly",
  );
  const [couponInput, setCouponInput] = React.useState("");

  async function run(
    key: string,
    action: () => Promise<{
      ok: boolean;
      message: string;
      redirectUrl?: string | null;
    }>,
  ) {
    setPending(key);
    const result = await action();
    setPending(null);
    if (result.ok) {
      toast.success(result.message);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  const runsPercent =
    summary.usage.runs.included > 0
      ? Math.min(
          100,
          Math.round(
            (summary.usage.runs.used / summary.usage.runs.included) * 100,
          ),
        )
      : 0;
  const costPercent =
    summary.usage.aiCostDeciCents.included > 0
      ? Math.min(
          100,
          Math.round(
            (summary.usage.aiCostDeciCents.used /
              summary.usage.aiCostDeciCents.included) *
              100,
          ),
        )
      : 0;

  return (
    <div className="space-y-6">
      {!provider.isReal ? (
        <Alert variant="warning">
          <InfoIcon />
          <AlertTitle>Simulierte Abrechnung</AlertTitle>
          <AlertDescription>{provider.statusNote}</AlertDescription>
        </Alert>
      ) : null}

      {summary.limitReached ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Kontingent ausgeschöpft</AlertTitle>
          <AlertDescription>
            Neue Agentenläufe werden abgelehnt, bis der Plan gewechselt wird oder
            die nächste Abrechnungsperiode beginnt. Sandbox-Testläufe bleiben
            möglich.
          </AlertDescription>
        </Alert>
      ) : summary.limitWarning ? (
        <Alert variant="warning">
          <AlertTriangleIcon />
          <AlertTitle>Über 80 % des Kontingents verbraucht</AlertTitle>
          <AlertDescription>
            Bei Erreichen der Grenze stoppen die Agenten automatisch. Prüfen Sie
            rechtzeitig einen Planwechsel.
          </AlertDescription>
        </Alert>
      ) : null}

      {summary.cancelAtPeriodEnd ? (
        <Alert variant="warning">
          <AlertTriangleIcon />
          <AlertTitle>Kündigung vorgemerkt</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Der Zugang endet am {formatDate(summary.currentPeriodEnd)}. Danach
              werden keine Agentenläufe mehr ausgeführt.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={!canManage || pending === "resume"}
              onClick={() => run("resume", resumePlan)}
            >
              {pending === "resume" ? <Spinner /> : null}
              Kündigung zurücknehmen
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  Aktueller Plan: {summary.planName}
                </CardTitle>
                <CardDescription>
                  {summary.billingInterval === "yearly"
                    ? "Jahreszahlung"
                    : "Monatliche Zahlung"}{" "}
                  · Periode bis {formatDate(summary.currentPeriodEnd)}
                </CardDescription>
              </div>
              <Badge
                variant={
                  summary.status === "active"
                    ? "active"
                    : summary.status === "trialing"
                      ? "secondary"
                      : "warning"
                }
              >
                {statusLabels[summary.status] ?? summary.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.status === "trialing" && summary.trialEndsAt ? (
              <p className="rounded-md border border-border bg-muted/40 p-2 text-sm">
                Testphase ohne Zahlungsmittel bis{" "}
                {formatDate(summary.trialEndsAt)}.
              </p>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead className="text-right">Monatlich</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Plattformgebühr {summary.planName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(summary.platformFeeCents)}
                  </TableCell>
                </TableRow>
                {summary.agentLines.map((l) => (
                  <TableRow key={l.key}>
                    <TableCell className="text-muted-foreground">
                      {l.label}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {euro(l.monthlyCents)}
                    </TableCell>
                  </TableRow>
                ))}
                {summary.bundleLines.map((l) => (
                  <TableRow key={l.key}>
                    <TableCell className="text-muted-foreground">
                      {l.label}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {euro(l.monthlyCents)}
                    </TableCell>
                  </TableRow>
                ))}
                {summary.includedAgentSeats > 0 ? (
                  <TableRow>
                    <TableCell className="text-status-active">
                      {Math.min(
                        summary.includedAgentSeats,
                        summary.agentLines.length,
                      )}{" "}
                      im Plan enthaltene Agenten-Plätze
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-status-active">
                      im Preis enthalten
                    </TableCell>
                  </TableRow>
                ) : null}
                {summary.volumeDiscountCents > 0 ? (
                  <TableRow>
                    <TableCell className="text-status-active">
                      Mengenrabatt ({summary.volumeDiscountPercent} %)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-status-active">
                      −{euro(summary.volumeDiscountCents)}
                    </TableCell>
                  </TableRow>
                ) : null}
                {summary.couponCode ? (
                  <TableRow>
                    <TableCell className="text-status-active">
                      Gutschein {summary.couponCode} ({summary.couponPercent} %)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-status-active">
                      −{euro(summary.couponDiscountCents)}
                    </TableCell>
                  </TableRow>
                ) : null}
                <TableRow>
                  <TableCell className="font-semibold">
                    Summe pro Monat (netto)
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {euro(summary.totalMonthlyCents)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              Alle Beträge netto zzgl. gesetzlicher Umsatzsteuer. Die Berechnung
              erfolgt ausschließlich serverseitig aus dem gebuchten Plan und den
              aktiven Agenten.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Verbrauch</CardTitle>
              <CardDescription>Laufende Abrechnungsperiode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>Agentenläufe</span>
                  <span className="tabular-nums text-muted-foreground">
                    {summary.usage.runs.used} / {summary.usage.runs.included}
                  </span>
                </div>
                <Progress value={runsPercent} />
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>KI-Kosten</span>
                  <span className="tabular-nums text-muted-foreground">
                    {euro(Math.round(summary.usage.aiCostDeciCents.used / 10))} /{" "}
                    {euro(
                      Math.round(summary.usage.aiCostDeciCents.included / 10),
                    )}
                  </span>
                </div>
                <Progress value={costPercent} />
              </div>
              <p className="text-xs text-muted-foreground">
                Sandbox-Testläufe zählen nicht gegen das Kontingent.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Gutschein</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.couponCode ? (
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="active">
                    <TicketIcon /> {summary.couponCode}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!canManage || pending === "coupon-clear"}
                    onClick={() => run("coupon-clear", clearCoupon)}
                  >
                    Entfernen
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="coupon">Code eingeben</Label>
                  <div className="flex gap-2">
                    <Input
                      id="coupon"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="z. B. START20"
                      disabled={!canManage}
                    />
                    <Button
                      size="sm"
                      disabled={
                        !canManage ||
                        couponInput.trim().length === 0 ||
                        pending === "coupon"
                      }
                      onClick={() =>
                        run("coupon", () => redeemCoupon(couponInput))
                      }
                    >
                      {pending === "coupon" ? <Spinner /> : null}
                      Einlösen
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Pläne</TabsTrigger>
          <TabsTrigger value="invoices">Rechnungen</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="yearly"
              checked={yearly}
              onCheckedChange={setYearly}
              disabled={!canManage}
            />
            <Label htmlFor="yearly" className="cursor-pointer">
              Jährliche Zahlung (günstiger)
            </Label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p) => {
              const current = p.key === summary.planKey;
              const price = yearly
                ? p.yearlyPricePerMonthCents
                : p.monthlyPriceCents;
              return (
                <Card
                  key={p.key}
                  className={current ? "border-primary shadow-sm" : undefined}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      {current ? <Badge variant="active">Aktuell</Badge> : null}
                    </div>
                    <CardDescription>{p.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div>
                      <p className="text-2xl font-semibold tabular-nums">
                        {euro(price)}
                        <span className="text-sm font-normal text-muted-foreground">
                          {" "}
                          / Monat
                        </span>
                      </p>
                      {yearly && p.yearlySavingsPercent > 0 ? (
                        <p className="text-xs text-status-active">
                          {p.yearlySavingsPercent} % gegenüber monatlicher
                          Zahlung
                        </p>
                      ) : null}
                      {p.setupFeeCents > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          zzgl. einmalig {euro(p.setupFeeCents)} Einrichtung
                        </p>
                      ) : null}
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {p.features.map((f) => (
                        <li key={f} className="flex gap-2">
                          <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-status-active" />
                          <span className="text-muted-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="mt-auto"
                      variant={current ? "outline" : "default"}
                      disabled={
                        !canManage ||
                        pending === `plan-${p.key}` ||
                        (current &&
                          yearly === (summary.billingInterval === "yearly"))
                      }
                      onClick={() =>
                        run(`plan-${p.key}`, () =>
                          selectPlan(p.key, yearly ? "yearly" : "monthly"),
                        )
                      }
                    >
                      {pending === `plan-${p.key}` ? <Spinner /> : null}
                      {current ? "Intervall wechseln" : "Plan wählen"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {canManage && !summary.cancelAtPeriodEnd ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={pending === "cancel"}
              onClick={() => run("cancel", cancelPlan)}
            >
              {pending === "cancel" ? <Spinner /> : null}
              Abonnement zum Periodenende kündigen
            </Button>
          ) : null}
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Rechnungen</CardTitle>
                  <CardDescription>
                    {provider.isReal
                      ? "Über Stripe ausgestellte Rechnungen."
                      : "Simulierte Rechnungen — es wurde kein Betrag abgebucht."}
                  </CardDescription>
                </div>
                {canManage ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending === "invoice"}
                    onClick={() =>
                      run("invoice", createInvoiceForCurrentPeriod)
                    }
                  >
                    {pending === "invoice" ? <Spinner /> : null}
                    <FileTextIcon />
                    Rechnung für laufende Periode erstellen
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Noch keine Rechnungen vorhanden.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nummer</TableHead>
                      <TableHead>Zeitraum</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">
                          {inv.number}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(inv.periodStart)} –{" "}
                          {formatDate(inv.periodEnd)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              inv.status === "paid" ? "active" : "secondary"
                            }
                          >
                            {inv.status === "paid"
                              ? "Bezahlt"
                              : inv.status === "open"
                                ? "Offen"
                                : inv.status}
                          </Badge>
                          {inv.provider === "mock" ? (
                            <Badge variant="demo" className="ml-1.5">
                              Simuliert
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {euro(inv.totalCents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
