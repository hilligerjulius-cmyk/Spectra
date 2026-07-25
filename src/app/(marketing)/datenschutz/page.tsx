import Link from "next/link";
import {
  LegalReviewNotice,
  PageIntro,
  Placeholder,
} from "@/components/shared/marketing";

export const metadata = {
  title: "Datenschutzerklärung",
  description:
    "Entwurf einer Datenschutzerklärung nach DSGVO — juristisch zu prüfen.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-16">
      <PageIntro
        title="Datenschutzerklärung"
        lead="Information über die Verarbeitung personenbezogener Daten nach Art. 13 und 14 DSGVO."
      />

      <LegalReviewNotice document="die Datenschutzerklärung und das Verzeichnis der Unterauftragsverarbeiter" />

      <div className="space-y-8 text-sm">
        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">1. Verantwortlicher</h2>
          <p>
            Verantwortlich für die Datenverarbeitung ist:
            <br />
            <Placeholder>Firmenname, Anschrift, Kontakt</Placeholder>
          </p>
          <p className="text-muted-foreground">
            Datenschutzbeauftragte Person:{" "}
            <Placeholder>Name und Kontakt, falls benannt</Placeholder>. Ob eine
            Benennung verpflichtend ist, richtet sich nach Art. 37 DSGVO und § 38
            BDSG und muss geprüft werden.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">
            2. Verarbeitung bei Nutzung der Website
          </h2>
          <p className="text-muted-foreground">
            Beim Aufruf der Website werden technisch notwendige Daten
            verarbeitet (IP-Adresse, Zeitpunkt, angeforderte Ressource,
            übermittelter Browsertyp). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f
            DSGVO; das berechtigte Interesse liegt im sicheren und stabilen
            Betrieb. Speicherdauer:{" "}
            <Placeholder>Aufbewahrungsfrist der Serverprotokolle</Placeholder>.
          </p>
          <p className="text-muted-foreground">
            Die Website setzt für den Betrieb ein technisch notwendiges
            Sitzungs-Cookie zur Anmeldung sowie eine Speicherung der gewählten
            Farbdarstellung ein. Ein Tracking zu Werbezwecken findet nicht
            statt.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">
            3. Verarbeitung bei Nutzung der Anwendung
          </h2>
          <p className="text-muted-foreground">
            Für die Nutzung der Plattform verarbeiten wir Konto- und
            Organisationsdaten (Name, E-Mail-Adresse, Rolle) sowie die Inhalte,
            die Sie über verbundene Datenquellen bereitstellen.
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          </p>
          <p className="text-muted-foreground">
            Soweit Sie die Plattform zur Verarbeitung personenbezogener Daten
            Ihrer eigenen Kundinnen, Beschäftigten oder Kontakte einsetzen, sind
            Sie insoweit Verantwortlicher und wir Auftragsverarbeiter. Hierfür
            ist ein Vertrag nach Art. 28 DSGVO erforderlich:{" "}
            <Placeholder>Verweis auf den Auftragsverarbeitungsvertrag</Placeholder>
            .
          </p>
          <p className="text-muted-foreground">
            Welche Datenarten zu welchem Zweck und wie lange verarbeitet werden,
            ist im Detail unter{" "}
            <Link
              href="/datenschutz-produkt"
              className="text-primary hover:underline"
            >
              Datenschutz im Produkt
            </Link>{" "}
            beschrieben.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">
            4. Empfänger und Unterauftragsverarbeiter
          </h2>
          <p className="text-muted-foreground">
            Eine Weitergabe erfolgt nur an Dienste, die für den Betrieb
            erforderlich sind und die der Betreiber aktiviert hat. Die
            tatsächlich eingesetzten Dienste sind hier vollständig zu benennen,
            jeweils mit Zweck, Sitz und Rechtsgrundlage der Übermittlung:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
            <li>
              Hosting und Datenbank:{" "}
              <Placeholder>Anbieter, Ort der Verarbeitung</Placeholder>
            </li>
            <li>
              Sprachmodell:{" "}
              <Placeholder>Anbieter, sofern aktiviert</Placeholder> — ohne
              hinterlegten Schlüssel findet keine Übermittlung statt.
            </li>
            <li>
              Embeddings:{" "}
              <Placeholder>Anbieter, sofern aktiviert</Placeholder>
            </li>
            <li>
              Zahlungsabwicklung:{" "}
              <Placeholder>Anbieter, sofern aktiviert</Placeholder>
            </li>
            <li>
              E-Mail-Versand:{" "}
              <Placeholder>Anbieter, sofern aktiviert</Placeholder>
            </li>
          </ul>
          <p className="text-muted-foreground">
            Bei Übermittlungen in Drittländer sind die Garantien nach Art. 44 ff.
            DSGVO anzugeben:{" "}
            <Placeholder>
              Angemessenheitsbeschluss oder Standardvertragsklauseln
            </Placeholder>
            .
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">5. Ihre Rechte</h2>
          <p className="text-muted-foreground">
            Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16),
            Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18),
            Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO).
            Sofern eine Verarbeitung auf einer Einwilligung beruht, können Sie
            diese jederzeit mit Wirkung für die Zukunft widerrufen.
          </p>
          <p className="text-muted-foreground">
            Zudem steht Ihnen ein Beschwerderecht bei einer
            Datenschutzaufsichtsbehörde zu. Zuständig ist:{" "}
            <Placeholder>Zuständige Aufsichtsbehörde</Placeholder>.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">
            6. Automatisierte Entscheidungen
          </h2>
          <p className="text-muted-foreground">
            Eine ausschließlich automatisierte Entscheidung im Sinne des Art. 22
            DSGVO findet nicht statt. Die Plattform bereitet Aktionen vor;
            Aktionen mit rechtlicher Wirkung oder erheblicher Beeinträchtigung
            erfordern eine Entscheidung durch einen Menschen. Ob im konkreten
            Einsatz dennoch ein Anwendungsfall des Art. 22 DSGVO vorliegt, ist
            im Einzelfall zu prüfen.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">7. Speicherdauer</h2>
          <p className="text-muted-foreground">
            Daten werden gelöscht, sobald der Zweck entfällt und keine
            gesetzliche Aufbewahrungspflicht entgegensteht. Für Audit-Einträge
            und Rechnungen gelten eigene Fristen:{" "}
            <Placeholder>Aufbewahrungsfristen je Datenart</Placeholder>.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">8. Stand</h2>
          <p className="text-muted-foreground">
            Stand dieser Erklärung: <Placeholder>Datum</Placeholder>. Wir passen
            sie an, wenn sich die Verarbeitung ändert.
          </p>
        </section>
      </div>
    </div>
  );
}
