"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckIcon,
  ClockIcon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import { bulkApprove, decideApprovalAction } from "@/server/agents/run-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ApprovalItem {
  id: string;
  agentName: string;
  title: string;
  reasoning: string;
  actionType: string;
  riskLevel: "low" | "medium" | "high";
  payload: Record<string, unknown>;
  affectedData: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  estimatedCostDeciCents: number | null;
  runId: string | null;
}

const riskBadge: Record<ApprovalItem["riskLevel"], { label: string; variant: "active" | "warning" | "error" }> = {
  low: { label: "geringes Risiko", variant: "active" },
  medium: { label: "mittleres Risiko", variant: "warning" },
  high: { label: "hohes Risiko", variant: "error" },
};

export function ApprovalList({
  items,
  canDecide,
  mode,
}: {
  items: ApprovalItem[];
  canDecide: boolean;
  mode: "pending" | "history";
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [editItem, setEditItem] = React.useState<ApprovalItem | null>(null);
  const [editJson, setEditJson] = React.useState("");
  const [bulkPending, setBulkPending] = React.useState(false);

  async function decide(
    item: ApprovalItem,
    decision: "approve" | "reject",
    editedPayloadJson?: string,
  ) {
    setPendingId(item.id);
    const result = await decideApprovalAction(item.id, {
      decision,
      editedPayloadJson,
    });
    setPendingId(null);
    setEditItem(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  // Sammelfreigabe: nur risikoarme, gleichartige Aktionen auswählbar
  const bulkEligible = items.filter((i) => i.riskLevel === "low");
  const selectedItems = items.filter((i) => selected.has(i.id));
  const sameType =
    selectedItems.length > 1 &&
    new Set(selectedItems.map((i) => i.actionType)).size === 1;

  async function runBulkApprove() {
    setBulkPending(true);
    const result = await bulkApprove([...selected]);
    setBulkPending(false);
    setSelected(new Set());
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="space-y-3">
      {mode === "pending" && canDecide && bulkEligible.length > 1 ? (
        <div className="flex items-center justify-between rounded-lg border border-dashed p-3 text-sm">
          <p className="text-muted-foreground">
            Sammelfreigabe: nur für risikoarme, gleichartige Aktionen.
          </p>
          <Button
            size="sm"
            disabled={!sameType || bulkPending}
            onClick={runBulkApprove}
          >
            {bulkPending ? <Spinner /> : <CheckIcon />}
            {selected.size} ausgewählte freigeben
          </Button>
        </div>
      ) : null}

      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {mode === "pending" && canDecide && item.riskLevel === "low" ? (
                  <Checkbox
                    className="mt-1"
                    aria-label="Für Sammelfreigabe auswählen"
                    checked={selected.has(item.id)}
                    onCheckedChange={(checked) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      });
                    }}
                  />
                ) : null}
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {item.agentName} ·{" "}
                    {new Date(item.createdAt).toLocaleString("de-DE")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                <Badge variant={riskBadge[item.riskLevel].variant}>
                  {riskBadge[item.riskLevel].label}
                </Badge>
                {mode === "history" ? (
                  <StatusBadge
                    status={
                      item.status === "approved"
                        ? "completed"
                        : item.status === "rejected"
                          ? "failed"
                          : item.status
                    }
                  />
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Begründung des Agenten
              </p>
              <p className="mt-1 text-sm">{item.reasoning}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Vorgeschlagene Aktion ({item.actionType})
              </p>
              <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(item.payload, null, 2)}
              </pre>
            </div>
            {item.estimatedCostDeciCents ? (
              <p className="text-xs text-muted-foreground">
                Bisherige Laufkosten: {(item.estimatedCostDeciCents / 1000).toFixed(3)} €
              </p>
            ) : null}
            {item.decisionNote ? (
              <p className="text-sm text-muted-foreground">
                Notiz: {item.decisionNote}
              </p>
            ) : null}

            {mode === "pending" ? (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  size="sm"
                  disabled={!canDecide || pendingId === item.id}
                  onClick={() => decide(item, "approve")}
                >
                  {pendingId === item.id ? <Spinner /> : <CheckIcon />}
                  Genehmigen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canDecide || pendingId === item.id}
                  onClick={() => {
                    setEditItem(item);
                    setEditJson(JSON.stringify(item.payload, null, 2));
                  }}
                >
                  <PencilIcon /> Bearbeiten & genehmigen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={!canDecide || pendingId === item.id}
                  onClick={() => decide(item, "reject")}
                >
                  <XIcon /> Ablehnen
                </Button>
                <Button size="sm" variant="ghost" disabled title="Bleibt offen — Sie können jederzeit zurückkehren">
                  <ClockIcon /> Später
                </Button>
                {!canDecide ? (
                  <p className="self-center text-xs text-muted-foreground">
                    Ihre Rolle darf Freigaben nur ansehen.
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}

      <Dialog open={Boolean(editItem)} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Aktion bearbeiten</DialogTitle>
            <DialogDescription>
              Passen Sie die vorbereitete Aktion an. Die bearbeitete Fassung
              wird nach Genehmigung ausgeführt und revisionssicher protokolliert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="editPayload">Aktions-Daten (JSON)</Label>
            <Textarea
              id="editPayload"
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
              rows={12}
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={pendingId === editItem?.id}
              onClick={() => editItem && decide(editItem, "approve", editJson)}
            >
              {pendingId === editItem?.id ? <Spinner /> : <CheckIcon />}
              Bearbeitete Fassung genehmigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
