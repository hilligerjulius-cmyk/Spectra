"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcwIcon, SaveIcon } from "lucide-react";
import {
  clearPriceOverride,
  setPriceOverride,
  updatePlan,
} from "@/server/platform/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface PriceRow {
  scope: "tier" | "department" | "agent";
  targetKey: string;
  label: string;
  defaultCents: number;
  overrideCents: number | null;
}

export interface PlanRow {
  key: string;
  name: string;
  monthlyPriceCents: number;
  yearlyPricePerMonthCents: number;
  includedAgentSeats: number;
  includedRuns: number;
  active: boolean;
  differsFromSeed: boolean;
}

function euro(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function PriceEditor({
  prices,
  plans,
  canManage,
}: {
  prices: PriceRow[];
  plans: PlanRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  // Eingaben in Euro, damit im UI keine Cent-Rechnung nötig ist.
  const [priceInputs, setPriceInputs] = React.useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        prices.map((p) => [
          `${p.scope}:${p.targetKey}`,
          euro(p.overrideCents ?? p.defaultCents),
        ]),
      ),
  );
  const [planInputs, setPlanInputs] = React.useState<
    Record<string, { monthly: string; yearly: string; seats: string; runs: string; active: boolean }>
  >(() =>
    Object.fromEntries(
      plans.map((p) => [
        p.key,
        {
          monthly: euro(p.monthlyPriceCents),
          yearly: euro(p.yearlyPricePerMonthCents),
          seats: String(p.includedAgentSeats),
          runs: String(p.includedRuns),
          active: p.active,
        },
      ]),
    ),
  );

  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; message: string }>,
  ) {
    setPending(key);
    const result = await action();
    setPending(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  function toCents(value: string): number | null {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Plattform-Pläne</h2>
          <p className="text-sm text-muted-foreground">
            Änderungen gelten ab der nächsten Berechnung für alle
            Organisationen. Bestehende Abos behalten ihren Plan-Schlüssel.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead className="w-28">Monat (€)</TableHead>
                <TableHead className="w-28">Jahr/Mon. (€)</TableHead>
                <TableHead className="w-24">Plätze</TableHead>
                <TableHead className="w-28">Läufe</TableHead>
                <TableHead className="w-20">Aktiv</TableHead>
                {canManage ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => {
                const input = planInputs[plan.key]!;
                return (
                  <TableRow key={plan.key}>
                    <TableCell>
                      <p className="font-medium">{plan.name}</p>
                      {plan.differsFromSeed ? (
                        <Badge variant="warning" className="mt-1">
                          vom Auslieferungspreis abweichend
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Monatspreis ${plan.name}`}
                        className="h-8"
                        value={input.monthly}
                        disabled={!canManage}
                        onChange={(e) =>
                          setPlanInputs((s) => ({
                            ...s,
                            [plan.key]: { ...input, monthly: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Jahrespreis pro Monat ${plan.name}`}
                        className="h-8"
                        value={input.yearly}
                        disabled={!canManage}
                        onChange={(e) =>
                          setPlanInputs((s) => ({
                            ...s,
                            [plan.key]: { ...input, yearly: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Enthaltene Plätze ${plan.name}`}
                        className="h-8"
                        value={input.seats}
                        disabled={!canManage}
                        onChange={(e) =>
                          setPlanInputs((s) => ({
                            ...s,
                            [plan.key]: { ...input, seats: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Enthaltene Läufe ${plan.name}`}
                        className="h-8"
                        value={input.runs}
                        disabled={!canManage}
                        onChange={(e) =>
                          setPlanInputs((s) => ({
                            ...s,
                            [plan.key]: { ...input, runs: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        aria-label={`Plan ${plan.name} aktiv`}
                        checked={input.active}
                        disabled={!canManage}
                        onCheckedChange={(v) =>
                          setPlanInputs((s) => ({
                            ...s,
                            [plan.key]: { ...input, active: v },
                          }))
                        }
                      />
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending === `plan-${plan.key}`}
                          onClick={() => {
                            const monthly = toCents(input.monthly);
                            const yearly = toCents(input.yearly);
                            const seats = Number.parseInt(input.seats, 10);
                            const runs = Number.parseInt(input.runs, 10);
                            if (
                              monthly === null ||
                              yearly === null ||
                              !Number.isFinite(seats) ||
                              !Number.isFinite(runs)
                            ) {
                              toast.error("Bitte gültige Zahlen eingeben.");
                              return;
                            }
                            void run(`plan-${plan.key}`, () =>
                              updatePlan({
                                key: plan.key,
                                monthlyPriceCents: monthly,
                                yearlyPricePerMonthCents: yearly,
                                includedAgentSeats: seats,
                                includedRuns: runs,
                                active: input.active,
                              }),
                            );
                          }}
                        >
                          {pending === `plan-${plan.key}` ? (
                            <Spinner />
                          ) : (
                            <SaveIcon />
                          )}
                          Speichern
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">
            Agentenpreise und Department-Pakete
          </h2>
          <p className="text-sm text-muted-foreground">
            Ohne Eintrag gilt der Katalogpreis. Ein Override ersetzt ihn für
            alle Organisationen.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead className="text-right">Katalogpreis</TableHead>
                <TableHead className="w-32">Override (€)</TableHead>
                {canManage ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((price) => {
                const key = `${price.scope}:${price.targetKey}`;
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <p className="font-medium">{price.label}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {key}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {euro(price.defaultCents)} €
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Override ${price.label}`}
                        className="h-8"
                        value={priceInputs[key] ?? ""}
                        disabled={!canManage}
                        onChange={(e) =>
                          setPriceInputs((s) => ({ ...s, [key]: e.target.value }))
                        }
                      />
                      {price.overrideCents !== null ? (
                        <Badge variant="warning" className="mt-1">
                          Override aktiv
                        </Badge>
                      ) : null}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending === key}
                            onClick={() => {
                              const cents = toCents(priceInputs[key] ?? "");
                              if (cents === null) {
                                toast.error("Bitte einen gültigen Betrag eingeben.");
                                return;
                              }
                              void run(key, () =>
                                setPriceOverride({
                                  scope: price.scope,
                                  targetKey: price.targetKey,
                                  monthlyPriceCents: cents,
                                }),
                              );
                            }}
                          >
                            {pending === key ? <Spinner /> : <SaveIcon />}
                          </Button>
                          {price.overrideCents !== null ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Katalogpreis wiederherstellen"
                              disabled={pending === `clear-${key}`}
                              onClick={() =>
                                run(`clear-${key}`, () =>
                                  clearPriceOverride(
                                    price.scope,
                                    price.targetKey,
                                  ),
                                )
                              }
                            >
                              {pending === `clear-${key}` ? (
                                <Spinner />
                              ) : (
                                <RotateCcwIcon />
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
