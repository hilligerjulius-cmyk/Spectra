import type { Metadata } from "next";
import { ConfiguratorWizard } from "./wizard";

export const metadata: Metadata = {
  title: "Team-Konfigurator",
  description:
    "Stellen Sie in wenigen Minuten Ihr digitales Team zusammen — mit Empfehlung, Preis und Implementierungsplan.",
};

export default function KonfiguratorPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Stellen Sie Ihr digitales Team zusammen
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Beantworten Sie ein paar Fragen zu Ihrem Unternehmen. Sie erhalten
          eine Empfehlung mit Begründung je Agent, benötigten Integrationen und
          transparentem Monatspreis.
        </p>
      </div>
      <ConfiguratorWizard />
    </div>
  );
}
