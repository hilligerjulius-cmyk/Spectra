import Link from "next/link";
import { CtaBanner, PageIntro } from "@/components/shared/marketing";

export const metadata = {
  title: "FAQ",
  description:
    "Häufige Fragen zu digitalen Mitarbeitern: Freigaben, Datenzugriff, Kosten, Grenzen und Einstieg.",
};

const groups: { title: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    title: "Einstieg",
    items: [
      {
        q: "Wie fange ich an?",
        a: (
          <>
            Sie registrieren sich, legen eine Organisation an und durchlaufen
            einen Einrichtungsassistenten mit 14 Schritten. Er fragt nach Ihren
            Zeitfressern, schlägt ein Team vor und führt Sie bis zum
            Sandbox-Testlauf. Erst danach lassen sich Agenten aktivieren.
            Alternativ starten Sie ohne Registrierung im{" "}
            <Link href="/konfigurator" className="text-primary hover:underline">
              Konfigurator
            </Link>
            .
          </>
        ),
      },
      {
        q: "Kann ich das ohne eigene Daten ausprobieren?",
        a: "Ja. Der Demo-Modus erzeugt klar gekennzeichnete Beispieldaten eines B2B-Dienstleisters — Postfach, Kalender, offene Angebote und Wissensdokumente. Alle Datensätze tragen die Markierung „Demo“ und lassen sich jederzeit vollständig entfernen.",
      },
      {
        q: "Wie lange dauert die Einrichtung?",
        a: "Ein erster Agent läuft in wenigen Minuten in der Sandbox. Wie schnell er produktiv arbeitet, hängt an Ihren Datenquellen: Demo-Connectoren, Webhooks und CSV funktionieren sofort, eine Anbindung an Gmail oder Google Calendar braucht Zugangsdaten.",
      },
    ],
  },
  {
    title: "Kontrolle und Freigaben",
    items: [
      {
        q: "Kann ein Agent etwas tun, das ich nicht wollte?",
        a: "Aktionen mit finanzieller, rechtlicher, personeller oder reputationsbezogener Wirkung erfordern grundsätzlich eine Freigabe — unabhängig davon, wie hoch Sie die Automatisierungsstufe stellen. Diese Grenze ist im Agentenkatalog festgeschrieben und lässt sich in der Oberfläche nicht aufheben.",
      },
      {
        q: "Was passiert genau, wenn ich freigebe?",
        a: "Die vorbereitete Aktion wird ausgeführt — genau diese, nicht eine neu erzeugte. Wenn Sie den Inhalt vorher bearbeiten, wird Ihre bearbeitete Fassung ausgeführt. Es läuft kein zweiter, unkontrollierter Agentenlauf.",
      },
      {
        q: "Kann ich etwas zurücknehmen?",
        a: "Laufende Vorgänge lassen sich abbrechen, Freigaben ablehnen, Fähigkeiten einzeln abschalten und Agenten pausieren. Was bereits nach außen ging — eine versendete E-Mail etwa — kann die Plattform nicht zurückholen; genau deshalb ist der Versand freigabepflichtig.",
      },
      {
        q: "Sehe ich, was ein Agent getan hat?",
        a: "Jeder Lauf wird mit allen Schritten protokolliert: welche Quelle gelesen, welches Werkzeug aufgerufen, welches Modell genutzt, welche Kosten entstanden sind. Das Protokoll ist für die Anwendung nicht änderbar.",
      },
    ],
  },
  {
    title: "Daten und Datenschutz",
    items: [
      {
        q: "Auf welche Daten greift ein Agent zu?",
        a: "Ausschließlich auf Quellen, die Sie für genau diesen Agenten freigegeben haben. Ein nicht verbundener Connector liefert keine Daten, und das zugehörige Werkzeug meldet den fehlenden Zugriff, statt ein Ergebnis zu erfinden.",
      },
      {
        q: "Sind meine Daten von anderen Kunden getrennt?",
        a: "Ja, und zwar auf Datenbankebene über Row-Level-Security-Policies. Die Anwendung verbindet sich mit einer Rolle, die ohne gesetzten Organisationskontext keine Zeile sieht.",
      },
      {
        q: "Kann Ihr Support in meine Daten sehen?",
        a: "Nur mit protokollierter Begründung — und dieser Eintrag erscheint in Ihrem eigenen Audit-Log. Sie sehen also, wer wann und warum hineingesehen hat.",
      },
      {
        q: "Werden meine Daten zum Training verwendet?",
        a: "Nein. Ihre Inhalte werden zur Bearbeitung Ihrer Aufgaben verarbeitet, nicht zum Training von Modellen.",
      },
    ],
  },
  {
    title: "Kosten",
    items: [
      {
        q: "Wie setzt sich der Preis zusammen?",
        a: (
          <>
            Aus einem Plattformplan und den digitalen Mitarbeitern, die Sie
            einsetzen. Ab fünf Agenten sinkt der Agentenpreis, komplette
            Departments gelten automatisch als Paket. Alle Werte stehen auf der{" "}
            <Link href="/preise" className="text-primary hover:underline">
              Preisseite
            </Link>
            .
          </>
        ),
      },
      {
        q: "Was passiert, wenn mein Kontingent aufgebraucht ist?",
        a: "Bei 80 Prozent warnt die Anwendung, bei 100 Prozent lehnt sie neue Läufe ab, statt still weiterzulaufen und Kosten zu verursachen. Sandbox-Testläufe bleiben möglich und zählen ohnehin nicht mit.",
      },
      {
        q: "Gibt es eine Testphase?",
        a: "14 Tage ohne Zahlungsmittel. Danach entscheiden Sie, ob und mit welchem Plan Sie weitermachen; monatliche Zahlung ist monatlich kündbar.",
      },
    ],
  },
  {
    title: "Grenzen",
    items: [
      {
        q: "Ersetzt das Personal?",
        a: "Nein. Die Plattform übernimmt wiederkehrende Arbeit und bereitet Entscheidungen vor. Sie entscheidet nicht, sie führt kein Unternehmen und sie ersetzt keine Fachkraft.",
      },
      {
        q: "Kann ich mich auf die Auskünfte verlassen?",
        a: "Für Wissensfragen antworten Agenten mit Quellenangabe und sagen ausdrücklich, wenn kein Beleg vorliegt. Trotzdem gilt: Sprachmodelle können irren. Rechtliche, steuerliche und medizinische Fragen gehören zu einer fachkundigen Person, nicht zu einem Agenten.",
      },
      {
        q: "Was ist mit Anbindungen, die es noch nicht gibt?",
        a: (
          <>
            Nicht implementierte Connectoren sind als solche gekennzeichnet und
            liefern keine Scheinergebnisse. Bis dahin helfen Webhooks und
            CSV-Import. Der aktuelle Stand steht auf der{" "}
            <Link
              href="/integrationen"
              className="text-primary hover:underline"
            >
              Integrationsseite
            </Link>
            .
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-14 px-4 py-16">
      <PageIntro
        eyebrow="FAQ"
        title="Häufige Fragen"
        lead="Kurz und ohne Ausweichen — auch dort, wo die Antwort „das kann die Plattform nicht“ lautet."
      />

      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            {group.title}
          </h2>
          <div className="divide-y rounded-xl border">
            {group.items.map((item) => (
              <details key={item.q} className="group p-4">
                <summary className="cursor-pointer list-none font-medium marker:content-none">
                  <span className="flex items-start justify-between gap-3">
                    {item.q}
                    <span className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <div className="mt-2 text-sm text-muted-foreground">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <CtaBanner
        title="Ihre Frage fehlt?"
        text="Schreiben Sie uns — wir ergänzen diese Seite mit den Fragen, die tatsächlich gestellt werden."
        href="/kontakt"
        label="Frage stellen"
      />
    </div>
  );
}
