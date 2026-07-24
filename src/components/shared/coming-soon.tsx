import { ConstructionIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Klar gekennzeichneter Platzhalter für Bereiche, die in einer späteren
 * Implementierungsphase gebaut werden (Spec-Regel: jede Funktion ist entweder
 * funktionsfähig oder eindeutig als "noch nicht implementiert" markiert).
 */
export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={<ConstructionIcon />}
        title="Noch nicht implementiert"
        description={`Dieser Bereich ist geplant und wird in ${phase} umgesetzt. Es handelt sich nicht um eine Attrappe — bis dahin ist die Funktion bewusst deaktiviert.`}
      />
    </div>
  );
}
