import { InfoIcon } from "lucide-react";
import { requirePlatformAccess } from "@/server/platform/guards";
import {
  loadPlanOverview,
  loadPriceOverview,
} from "@/server/platform/service";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PriceEditor } from "./price-editor";

export const metadata = { title: "Preise & Pläne" };

export default async function AdminPricingPage() {
  const ctx = await requirePlatformAccess("support");
  const [prices, plans] = await Promise.all([
    loadPriceOverview(),
    loadPlanOverview(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Preise & Pläne"
        description="Plattformpreise zentral verwalten. Die Berechnung erfolgt immer serverseitig aus diesen Werten."
      />

      {ctx.level !== "admin" ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Nur lesender Zugriff</AlertTitle>
          <AlertDescription>
            Ihre Stufe ist „support“. Preisänderungen erfordern die Stufe
            „admin“.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="warning">
          <InfoIcon />
          <AlertTitle>Änderungen wirken für alle Organisationen</AlertTitle>
          <AlertDescription>
            Neue Preise greifen ab der nächsten Berechnung. Bereits ausgestellte
            Rechnungen bleiben unverändert — sie sind revisionsfähig und werden
            nicht rückwirkend angepasst.
          </AlertDescription>
        </Alert>
      )}

      <PriceEditor
        prices={prices}
        plans={plans}
        canManage={ctx.level === "admin"}
      />
    </div>
  );
}
