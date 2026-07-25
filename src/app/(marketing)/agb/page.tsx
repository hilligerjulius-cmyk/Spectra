import {
  LegalReviewNotice,
  PageIntro,
  Placeholder,
} from "@/components/shared/marketing";

export const metadata = {
  title: "AGB",
  description:
    "Entwurf Allgemeiner Geschäftsbedingungen für die Nutzung der Plattform — juristisch zu prüfen.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-16">
      <PageIntro
        title="Allgemeine Geschäftsbedingungen"
        lead="Bedingungen für die Nutzung der Plattform WORKFORCE OS."
      />

      <LegalReviewNotice document="die Geschäftsbedingungen, Haftungsregelungen und Kündigungsfristen" />

      <div className="space-y-8 text-sm">
        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">§ 1 Geltungsbereich</h2>
          <p className="text-muted-foreground">
            Diese Bedingungen gelten für die Bereitstellung der Software
            WORKFORCE OS als Dienst über das Internet durch{" "}
            <Placeholder>Anbieter</Placeholder> gegenüber Unternehmerinnen und
            Unternehmern im Sinne des § 14 BGB. Für Verbraucherinnen und
            Verbraucher ist das Angebot nicht bestimmt.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">§ 2 Leistungsgegenstand</h2>
          <p className="text-muted-foreground">
            Der Anbieter stellt eine mandantenfähige Plattform bereit, mit der
            Kundinnen konfigurierbare, KI-gestützte Softwareagenten für
            wiederkehrende Aufgaben einsetzen können. Der Leistungsumfang
            richtet sich nach dem gewählten Plan und den gebuchten Agenten.
          </p>
          <p className="text-muted-foreground">
            <strong>Ausdrücklich nicht Gegenstand</strong> des Vertrags sind:
            eine eigenständige Führung des Unternehmens der Kundin, rechtliche,
            steuerliche, medizinische oder sonstige erlaubnispflichtige
            Beratung sowie die Gewähr für die inhaltliche Richtigkeit
            KI-erzeugter Ergebnisse. Ergebnisse sind Vorbereitungen für
            Entscheidungen der Kundin.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">
            § 3 Mitwirkung und Verantwortung der Kundin
          </h2>
          <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
            <li>
              Die Kundin entscheidet, welche Datenquellen sie verbindet und
              welche Automatisierungsstufe sie je Fähigkeit einstellt.
            </li>
            <li>
              Die Kundin stellt sicher, dass sie zur Verarbeitung der von ihr
              eingebrachten Daten berechtigt ist und die erforderlichen
              Rechtsgrundlagen vorliegen.
            </li>
            <li>
              Freigabepflichtige Aktionen prüft die Kundin vor der Freigabe. Die
              Verantwortung für freigegebene Aktionen liegt bei der Kundin.
            </li>
            <li>
              Zugangsdaten sind vertraulich zu behandeln; Verdacht auf Missbrauch
              ist unverzüglich mitzuteilen.
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">§ 4 Vergütung</h2>
          <p className="text-muted-foreground">
            Es gelten die zum Zeitpunkt der Buchung angegebenen Preise. Alle
            Preise sind Nettopreise zzgl. gesetzlicher Umsatzsteuer. Die
            Abrechnung erfolgt{" "}
            <Placeholder>monatlich oder jährlich im Voraus</Placeholder>.
            Enthaltene Kontingente sind plangebunden; bei Erreichen der Grenze
            werden neue Agentenläufe abgelehnt, bis der Plan angepasst wird oder
            die nächste Abrechnungsperiode beginnt.
          </p>
          <p className="text-muted-foreground">
            Preisanpassungen werden mit einer Frist von{" "}
            <Placeholder>Frist</Placeholder> angekündigt. Bereits ausgestellte
            Rechnungen bleiben unverändert.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">
            § 5 Laufzeit und Kündigung
          </h2>
          <p className="text-muted-foreground">
            Der Vertrag beginnt mit der Bereitstellung des Zugangs. Die
            Testphase beträgt 14 Tage und erfordert kein Zahlungsmittel. Danach
            läuft der Vertrag{" "}
            <Placeholder>Laufzeit und Verlängerung</Placeholder> und ist zum
            Ende der jeweiligen Abrechnungsperiode kündbar. Nach Vertragsende
            werden keine Agentenläufe mehr ausgeführt; zur Löschung der Daten
            gilt <Placeholder>Frist und Verfahren</Placeholder>.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">§ 6 Verfügbarkeit</h2>
          <p className="text-muted-foreground">
            Eine bestimmte Verfügbarkeit wird nur zugesagt, soweit sie
            ausdrücklich vereinbart ist:{" "}
            <Placeholder>Verfügbarkeitszusage oder Verweis auf SLA</Placeholder>.
            Wartungsfenster werden nach Möglichkeit angekündigt. Ohne
            ausdrückliche Vereinbarung besteht keine Zusage einer bestimmten
            Verfügbarkeit.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">§ 7 Haftung</h2>
          <p className="text-muted-foreground">
            Die Haftungsregelung ist der Kern dieses Vertrags und muss
            zwingend juristisch geprüft werden — insbesondere die Grenzen der
            Haftungsbeschränkung nach § 309 BGB und die Behandlung von
            Schäden aus KI-erzeugten Ergebnissen:{" "}
            <Placeholder>Haftungsregelung</Placeholder>.
          </p>
          <p className="text-muted-foreground">
            Unberührt bleibt die Haftung für Vorsatz und grobe Fahrlässigkeit,
            für Schäden aus der Verletzung des Lebens, des Körpers oder der
            Gesundheit sowie nach dem Produkthaftungsgesetz.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">§ 8 Datenschutz</h2>
          <p className="text-muted-foreground">
            Soweit der Anbieter personenbezogene Daten im Auftrag der Kundin
            verarbeitet, schließen die Parteien einen Vertrag nach Art. 28 DSGVO.
            Einzelheiten der Verarbeitung im Produkt sind in der
            Datenschutzerklärung und unter „Datenschutz im Produkt“
            beschrieben.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">
            § 9 Nutzungsrechte und Inhalte
          </h2>
          <p className="text-muted-foreground">
            Die Kundin erhält für die Vertragslaufzeit ein einfaches, nicht
            übertragbares Recht zur Nutzung der Plattform. Rechte an den von der
            Kundin eingebrachten Daten und an den erzeugten Ergebnissen bleiben
            bei der Kundin. Die Regelung zu Rechten an KI-erzeugten Inhalten ist
            zu prüfen: <Placeholder>Regelung</Placeholder>.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">
            § 10 Schlussbestimmungen
          </h2>
          <p className="text-muted-foreground">
            Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist{" "}
            <Placeholder>Ort</Placeholder>, soweit gesetzlich zulässig. Sollte
            eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen
            Bestimmungen unberührt.
          </p>
          <p className="text-muted-foreground">
            Stand: <Placeholder>Datum</Placeholder>
          </p>
        </section>
      </div>
    </div>
  );
}
