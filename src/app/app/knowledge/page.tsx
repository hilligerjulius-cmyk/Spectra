import { InfoIcon } from "lucide-react";
import { requireOrg } from "@/server/auth/guards";
import { roleHasPermission } from "@/server/auth/permissions";
import { listDocuments } from "@/server/knowledge/service";
import { getEmbeddingProvider } from "@/server/ai/embeddings";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KnowledgeWorkspace, type DocumentView } from "./knowledge-workspace";

export const metadata = { title: "Knowledge" };

export default async function KnowledgePage() {
  const ctx = await requireOrg();
  const canUpload = roleHasPermission(ctx.role, "knowledge", "upload");
  const canManage = roleHasPermission(ctx.role, "knowledge", "manage");
  const provider = getEmbeddingProvider();

  const docs = await listDocuments(ctx.organizationId);
  const data: DocumentView[] = docs.map((d) => ({
    id: d.id,
    title: d.title,
    filename: d.filename,
    status: d.status,
    chunkCount: d.chunkCount,
    sizeBytes: d.sizeBytes,
    accessScope: d.accessScope,
    embeddingProvider: d.embeddingProvider,
    error: d.error,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge"
        description="Dokumente hochladen und quellenbasiert abfragen. Antworten nennen immer ihre Belege — ohne Beleg wird nichts behauptet."
      />

      {!provider.isReal ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Lokale Embeddings aktiv</AlertTitle>
          <AlertDescription>
            Ohne <code className="font-mono text-xs">VOYAGE_API_KEY</code> werden
            deterministische lokale Embeddings verwendet. Die Suche funktioniert
            vollständig, die semantische Trefferqualität ist jedoch geringer als
            mit einem echten Embedding-Modell.
          </AlertDescription>
        </Alert>
      ) : null}

      <KnowledgeWorkspace
        documents={data}
        canUpload={canUpload}
        canManage={canManage}
      />
    </div>
  );
}
