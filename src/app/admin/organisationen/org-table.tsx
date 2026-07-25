"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeIcon, ShieldAlertIcon } from "lucide-react";
import {
  forceMockBilling,
  requestSupportAccess,
} from "@/server/platform/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  agentCount: number;
  activeAgentCount: number;
  runCount30d: number;
  planKey: string | null;
  subscriptionStatus: string | null;
}

/**
 * Einblick in eine Organisation ist nur mit protokollierter Begründung
 * möglich. Der Dialog erzwingt die Angabe; die Server-Action schreibt den
 * Eintrag in das Plattform-Protokoll UND in das Audit-Log der Organisation.
 */
function SupportAccessDialog({ org }: { org: OrgRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    setPending(true);
    const result = await requestSupportAccess({
      organizationId: org.id,
      reason,
      scope: "Organisationsdetails",
    });
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      setOpen(false);
      setReason("");
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <EyeIcon />
          Einsicht
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Einsicht in „{org.name}“</DialogTitle>
          <DialogDescription>
            Der Zugriff wird protokolliert und ist auch im Audit-Log dieser
            Organisation sichtbar. Bitte nennen Sie den Anlass.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${org.id}`}>
              Grund (mindestens 10 Zeichen)
            </Label>
            <Textarea
              id={`reason-${org.id}`}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z. B. Supportanfrage #1234: Agentenlauf schlägt fehl, Kundin bittet um Prüfung."
            />
          </div>
          <Button
            className="w-full"
            disabled={pending || reason.trim().length < 10}
            onClick={submit}
          >
            {pending ? <Spinner /> : null}
            Zugriff protokollieren
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MockBillingDialog({ org }: { org: OrgRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    setPending(true);
    const result = await forceMockBilling(org.id, reason);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      setOpen(false);
      setReason("");
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Abrechnung notfalls simulieren
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrechnung auf Simulation umstellen</DialogTitle>
          <DialogDescription>
            Notbehelf bei Ausfall des Zahlungsanbieters. Für „{org.name}“ läuft
            die Abrechnung danach lokal weiter, ohne Zahlungsfluss. Die
            Umstellung erscheint im Audit-Log der Organisation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`mock-${org.id}`}>Grund</Label>
            <Textarea
              id={`mock-${org.id}`}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z. B. Störung beim Zahlungsanbieter, Ticket #4711."
            />
          </div>
          <Button
            className="w-full"
            variant="destructive"
            disabled={pending || reason.trim().length < 10}
            onClick={submit}
          >
            {pending ? <Spinner /> : null}
            Umstellen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OrgTable({
  organizations,
  canManage,
}: {
  organizations: OrgRow[];
  canManage: boolean;
}) {
  if (organizations.length === 0) {
    return (
      <Alert variant="info">
        <ShieldAlertIcon />
        <AlertTitle>Noch keine Organisationen</AlertTitle>
        <AlertDescription>
          Sobald sich die erste Kundin registriert, erscheint sie hier.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organisation</TableHead>
            <TableHead className="text-right">Personen</TableHead>
            <TableHead className="text-right">Agenten</TableHead>
            <TableHead className="text-right">Läufe (30 T.)</TableHead>
            <TableHead>Abo</TableHead>
            <TableHead className="text-right">Aktion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => (
            <TableRow key={org.id}>
              <TableCell>
                <p className="font-medium">{org.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {org.slug} · seit{" "}
                  {new Date(org.createdAt).toLocaleDateString("de-DE")}
                </p>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {org.memberCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {org.activeAgentCount}/{org.agentCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {org.runCount30d}
              </TableCell>
              <TableCell>
                {org.planKey ? (
                  <>
                    <Badge variant="secondary">{org.planKey}</Badge>
                    <Badge
                      variant={
                        org.subscriptionStatus === "active"
                          ? "active"
                          : "warning"
                      }
                      className="ml-1.5"
                    >
                      {org.subscriptionStatus}
                    </Badge>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">kein Abo</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1.5">
                  <SupportAccessDialog org={org} />
                  {canManage ? <MockBillingDialog org={org} /> : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
