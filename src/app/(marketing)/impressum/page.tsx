import {
  LegalReviewNotice,
  PageIntro,
  Placeholder,
} from "@/components/shared/marketing";

export const metadata = {
  title: "Impressum",
  description: "Angaben gemäß § 5 DDG (Entwurf, juristisch zu prüfen).",
};

export default function ImprintPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-16">
      <PageIntro
        title="Impressum"
        lead="Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG) und § 18 Medienstaatsvertrag."
      />

      <LegalReviewNotice document="das Impressum und die Angaben zur Rechtsform" />

      <div className="space-y-8 text-sm">
        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">Anbieter</h2>
          <p>
            <Placeholder>Vollständiger Firmenname einschließlich Rechtsform</Placeholder>
            <br />
            <Placeholder>Straße und Hausnummer</Placeholder>
            <br />
            <Placeholder>Postleitzahl und Ort</Placeholder>
            <br />
            <Placeholder>Land</Placeholder>
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">Vertretungsberechtigte</h2>
          <p>
            <Placeholder>
              Namen der Geschäftsführung bzw. des Vorstands
            </Placeholder>
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">Kontakt</h2>
          <p>
            Telefon: <Placeholder>Telefonnummer</Placeholder>
            <br />
            E-Mail: <Placeholder>kontakt@ihre-domain.de</Placeholder>
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">Registereintrag</h2>
          <p>
            Registergericht: <Placeholder>Amtsgericht</Placeholder>
            <br />
            Registernummer: <Placeholder>HRB-Nummer</Placeholder>
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">Umsatzsteuer</h2>
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:{" "}
            <Placeholder>USt-IdNr.</Placeholder>
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">
            Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
          </h2>
          <p>
            <Placeholder>Name</Placeholder>
            <br />
            <Placeholder>Anschrift, sofern von oben abweichend</Placeholder>
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">
            Verbraucherstreitbeilegung
          </h2>
          <p className="text-muted-foreground">
            Ob eine Teilnahme an einem Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle besteht oder ausdrücklich nicht
            besteht, muss hier angegeben werden:{" "}
            <Placeholder>Angabe zur Teilnahmebereitschaft</Placeholder>
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">Haftung für Inhalte</h2>
          <p className="text-muted-foreground">
            Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten
            nach den allgemeinen Gesetzen verantwortlich. Wir sind jedoch nicht
            verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
            überwachen oder nach Umständen zu forschen, die auf eine
            rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung
            oder Sperrung der Nutzung von Informationen nach den allgemeinen
            Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist
            erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung
            möglich. Bei Bekanntwerden entsprechender Rechtsverletzungen
            entfernen wir diese Inhalte unverzüglich.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">Haftung für Links</h2>
          <p className="text-muted-foreground">
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren
            Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
            fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
            verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
            verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der
            Verlinkung auf mögliche Rechtsverstöße überprüft; rechtswidrige
            Inhalte waren nicht erkennbar.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="text-base font-semibold">Urheberrecht</h2>
          <p className="text-muted-foreground">
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf
            diesen Seiten unterliegen dem deutschen Urheberrecht.
            Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
            Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der
            schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
          </p>
        </section>
      </div>
    </div>
  );
}
