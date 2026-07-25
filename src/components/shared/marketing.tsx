import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Standard-Kopf einer Marketing-Unterseite. */
export function PageIntro({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead: string;
}) {
  return (
    <header className="mx-auto max-w-3xl space-y-4 text-center">
      {eyebrow ? (
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
      ) : null}
      <h1 className="text-balance text-4xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="text-balance text-lg text-muted-foreground">{lead}</p>
    </header>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Hinweis auf Rechtstexten.
 *
 * Diese Seiten sind bewusst als Entwurf gekennzeichnet: Ein von einer KI
 * erzeugter Rechtstext ist keine Rechtsberatung und darf nicht ungeprüft
 * veröffentlicht werden. Wer die Plattform betreibt, muss die Texte durch
 * eine fachkundige Person prüfen und mit den eigenen Angaben füllen.
 */
export function LegalReviewNotice({ document }: { document: string }) {
  return (
    <Alert variant="warning">
      <AlertTriangleIcon />
      <AlertTitle>Entwurf — juristisch zu prüfen</AlertTitle>
      <AlertDescription>
        Dieser Text ist ein unverbindlicher Entwurf als Arbeitsgrundlage und{" "}
        <strong>keine Rechtsberatung</strong>. Vor Veröffentlichung
        müssen {document} durch eine fachkundige Person geprüft und alle
        Platzhalter durch die tatsächlichen Angaben des Betreibers ersetzt
        werden. Mit Platzhaltern veröffentlicht wäre der Text nicht nur
        unvollständig, sondern in Deutschland abmahnfähig.
      </AlertDescription>
    </Alert>
  );
}

/** Wiederkehrende Platzhalter in Rechtstexten. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-status-warning/12 px-1 font-mono text-[0.9em] text-status-warning">
      [{children}]
    </span>
  );
}

export function CtaBanner({
  title,
  text,
  href = "/konfigurator",
  label = "Team zusammenstellen",
}: {
  title: string;
  text: string;
  href?: string;
  label?: string;
}) {
  return (
    <section className="rounded-2xl border bg-muted/30 p-8 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{text}</p>
      <Button className="mt-6" asChild>
        <Link href={href}>{label}</Link>
      </Button>
    </section>
  );
}
