"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpenIcon,
  FileTextIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import {
  askKnowledge,
  deleteKnowledgeDocument,
  uploadKnowledgeDocument,
  type KnowledgeAnswer,
} from "@/server/knowledge/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
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

export interface DocumentView {
  id: string;
  title: string;
  filename: string;
  status: string;
  chunkCount: number;
  sizeBytes: number;
  accessScope: string;
  embeddingProvider: string;
  error: string | null;
  createdAt: string;
}

const confidenceLabels: Record<string, { label: string; variant: "active" | "warning" | "error" }> = {
  belegt: { label: "Durch Quellen belegt", variant: "active" },
  teilweise_belegt: { label: "Teilweise belegt", variant: "warning" },
  nicht_belegt: { label: "Kein Beleg gefunden", variant: "error" },
};

export function KnowledgeWorkspace({
  documents,
  canUpload,
  canManage,
}: {
  documents: DocumentView[];
  canUpload: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<KnowledgeAnswer | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setUploading(true);
    const result = await uploadKnowledgeDocument(formData);
    setUploading(false);
    if (result.ok) {
      toast.success(result.message);
      formRef.current?.reset();
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function onAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAsking(true);
    setAnswer(null);
    const result = await askKnowledge(question);
    setAsking(false);
    if (result.ok) setAnswer(result);
    else toast.error(result.message);
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    const result = await deleteKnowledgeDocument(id);
    setDeletingId(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wissensfrage stellen</CardTitle>
            <CardDescription>
              Der Company-Memory-Agent antwortet ausschließlich auf Basis
              freigegebener Dokumente und nennt seine Quellen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={onAsk} className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="z. B. Welche Kündigungsfrist gilt für Kunden?"
                aria-label="Wissensfrage"
              />
              <Button type="submit" disabled={asking || question.trim().length < 3}>
                {asking ? <Spinner /> : <SearchIcon />}
                Fragen
              </Button>
            </form>

            {answer ? (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  {answer.confidence ? (
                    <Badge
                      variant={
                        confidenceLabels[answer.confidence]?.variant ?? "secondary"
                      }
                    >
                      {confidenceLabels[answer.confidence]?.label ?? answer.confidence}
                    </Badge>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm">{answer.answer}</p>
                {answer.sources && answer.sources.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Quellen
                    </p>
                    <ul className="mt-1 space-y-1">
                      {answer.sources.map((s) => (
                        <li
                          key={s.chunkId}
                          className="flex items-center gap-1.5 text-sm text-muted-foreground"
                        >
                          <FileTextIcon className="size-3.5" />
                          {s.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Keine Quellen — die Antwort ist bewusst als unbelegt
                    gekennzeichnet.
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Dokumente ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <EmptyState
                icon={<BookOpenIcon />}
                title="Noch keine Dokumente"
                description="Laden Sie Verträge, Richtlinien oder Handbücher hoch. Sie werden extrahiert, in Abschnitte zerlegt und für die quellenbasierte Suche indexiert."
              />
            ) : (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {doc.filename} · {(doc.sizeBytes / 1024).toFixed(0)} KB ·{" "}
                        {doc.chunkCount} Abschnitte · Embeddings:{" "}
                        {doc.embeddingProvider}
                      </p>
                      {doc.error ? (
                        <p className="mt-1 text-xs text-status-error">{doc.error}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {doc.accessScope === "restricted" ? (
                        <Badge variant="approval">Eingeschränkt</Badge>
                      ) : null}
                      <StatusBadge
                        status={
                          doc.status === "ready"
                            ? "completed"
                            : doc.status === "failed"
                              ? "failed"
                              : "running"
                        }
                      />
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${doc.title} löschen`}
                          disabled={deletingId === doc.id}
                          onClick={() => onDelete(doc.id)}
                        >
                          {deletingId === doc.id ? <Spinner /> : <Trash2Icon />}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Dokument hochladen</CardTitle>
          <CardDescription>
            PDF, DOCX, TXT oder Markdown, max. 10 MB. Inhalte werden als Daten
            behandelt — Anweisungen in Dokumenten werden von Agenten nicht
            befolgt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={onUpload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Datei</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".pdf,.docx,.txt,.md"
                required
                disabled={!canUpload}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Titel (optional)</Label>
              <Input
                id="title"
                name="title"
                placeholder="Wird sonst aus dem Dateinamen übernommen"
                disabled={!canUpload}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessScope">Zugriff</Label>
              <Select name="accessScope" defaultValue="organization">
                <SelectTrigger id="accessScope" disabled={!canUpload}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">
                    Gesamte Organisation
                  </SelectItem>
                  <SelectItem value="restricted">
                    Nur Owner und Admins
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Eingeschränkte Dokumente fließen nicht in Antworten für andere
                Rollen ein.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={!canUpload || uploading}>
              {uploading ? <Spinner /> : <UploadIcon />}
              Hochladen und indexieren
            </Button>
            {!canUpload ? (
              <p className="text-xs text-muted-foreground">
                Ihre Rolle darf keine Dokumente hochladen.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
