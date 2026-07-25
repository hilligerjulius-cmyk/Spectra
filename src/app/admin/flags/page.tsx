import { InfoIcon } from "lucide-react";
import { requirePlatformAccess } from "@/server/platform/guards";
import {
  listFeatureFlags,
  listOrganizations,
} from "@/server/platform/service";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FlagEditor } from "./flag-editor";

export const metadata = { title: "Funktionsschalter" };

export default async function AdminFlagsPage() {
  const ctx = await requirePlatformAccess("support");
  const [flags, organizations] = await Promise.all([
    listFeatureFlags(),
    listOrganizations(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funktionsschalter"
        description="Funktionen plattformweit oder für einzelne Organisationen freigeben."
      />

      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Ein Schalter ersetzt keine Umsetzung</AlertTitle>
        <AlertDescription>
          Schalter geben nur vorhandene Funktionen frei. Wo eine technische
          Voraussetzung fehlt — etwa der Hintergrundprozess für zeitgesteuerte
          Läufe — bleibt der Schalter wirkungslos; das steht in der jeweiligen
          Beschreibung und in TODO.md.
        </AlertDescription>
      </Alert>

      <FlagEditor
        canManage={ctx.level === "admin"}
        knownOrganizations={organizations.map((o) => ({
          id: o.id,
          name: o.name,
        }))}
        flags={flags.map((f) => ({
          key: f.key,
          label: f.label,
          description: f.description,
          enabled: f.enabled,
          organizationIds: f.organizationIds,
          updatedAt: f.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
