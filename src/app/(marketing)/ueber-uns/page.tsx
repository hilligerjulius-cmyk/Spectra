import { CtaBanner, PageIntro, Section } from "@/components/shared/marketing";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Über uns",
  description:
    "Warum WORKFORCE OS Freigaben in den Mittelpunkt stellt — und woran wir uns messen lassen.",
};

const principles = [
  {
    title: "Erst funktionieren, dann versprechen",
    text: "Was auf dieser Website steht, ist gebaut. Wo etwas fehlt, steht es als fehlend da — inklusive einer Liste offener Punkte im Quellcode.",
  },
  {
    title: "Menschen entscheiden",
    text: "Aktionen mit finanzieller, rechtlicher, personeller oder reputationsbezogener Wirkung erfordern eine Freigabe. Diese Grenze ist keine Einstellung, sondern eine Regel im Agentenkatalog.",
  },
  {
    title: "Keine erfundenen Zahlen",
    text: "In den Berichten steht, was gemessen wurde. Die einzige Schätzung — die Zeitersparnis — ist als Schätzung gekennzeichnet, und ihre Herleitung ist nachlesbar.",
  },
  {
    title: "Grenzen nennen",
    text: "Ein Agent, der eine Frage nicht belegen kann, sagt das. Eine Anbindung, die nicht existiert, wird nicht simuliert. Das ist unbequemer und auf Dauer brauchbarer.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-16 px-4 py-16">
      <PageIntro
        eyebrow="Über uns"
        title="Weniger Autonomie, mehr Verlässlichkeit"
        lead="Die meisten Werkzeuge in diesem Feld versprechen, Arbeit vollständig zu übernehmen. Wir halten das für den falschen Anspruch — und bauen deshalb anders."
      />

      <Section title="Warum diese Plattform so gebaut ist">
        <div className="space-y-4 text-muted-foreground">
          <p>
            Ein Sprachmodell kann einen Text erzeugen, der überzeugend klingt und
            trotzdem falsch ist. Wer daraus ein System baut, das eigenständig
            E-Mails versendet, Zahlungen anweist oder Verträge kündigt, verlagert
            das Risiko vollständig auf das Unternehmen, das es einsetzt.
          </p>
          <p>
            Deshalb steht bei WORKFORCE OS nicht die Autonomie im Mittelpunkt,
            sondern die Vorbereitung. Ein Agent recherchiert, ordnet ein,
            entwirft — und legt das Ergebnis so vor, dass ein Mensch in Sekunden
            entscheiden kann. Das ist kein Rückschritt gegenüber
            vollautomatischen Systemen. Es ist der Unterschied zwischen einem
            Werkzeug, das man einsetzen kann, und einem, das man ständig
            beaufsichtigen muss.
          </p>
          <p>
            Die zweite Entscheidung betrifft Ehrlichkeit über Grenzen. Es ist
            technisch einfach, eine Integration zu simulieren oder eine
            Kennzahl zu schätzen und beides wie echte Daten aussehen zu lassen.
            Wir tun das nicht — auch dann nicht, wenn eine Seite dadurch leerer
            wirkt.
          </p>
        </div>
      </Section>

      <Section title="Woran wir uns messen lassen">
        <div className="grid gap-4 sm:grid-cols-2">
          {principles.map((principle) => (
            <Card key={principle.title}>
              <CardHeader>
                <CardTitle className="text-base">{principle.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {principle.text}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Was wir nicht sind">
        <div className="space-y-3 text-muted-foreground">
          <p>
            Wir sind keine Unternehmensberatung und keine Kanzlei. Die Plattform
            unterstützt bei wiederkehrender Arbeit; sie ersetzt keine
            rechtliche, steuerliche oder medizinische Beratung und übernimmt
            keine Verantwortung für unternehmerische Entscheidungen.
          </p>
          <p>
            Wir behaupten auch keine Zertifizierung, die wir nicht haben. Eine
            unabhängige Sicherheitsprüfung durch Dritte hat bisher nicht
            stattgefunden — das steht so auch auf der Sicherheitsseite.
          </p>
        </div>
      </Section>

      <CtaBanner
        title="Klingt nach Ihrer Vorstellung von Software?"
        text="Sehen Sie sich an, wie ein Ablauf konkret aussieht — oder stellen Sie ein Team zusammen."
        href="/loesungen/anwendungsfall"
        label="Abläufe ansehen"
      />
    </div>
  );
}
