import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { AlertTriangleIcon } from "lucide-react";
import { getSession } from "@/server/auth/guards";
import { adminDb } from "@/server/db/client";
import { invitation, organization, user } from "@/server/db/schema";
import { Logo } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Einladung" };

const roleDescriptions: Record<string, string> = {
  owner: "Vollzugriff inklusive Abrechnung.",
  admin: "Verwaltung ohne Abrechnung und Eigentumsübertragung.",
  manager: "Departments überwachen, Freigaben entscheiden, Agenten konfigurieren.",
  member: "Agenten nutzen und Freigaben erteilen.",
  viewer: "Ausschließlich lesender Zugriff.",
  billingAdmin: "Ausschließlich Abrechnung; keine operativen Unternehmensdaten.",
};

/**
 * Ablaufprüfung außerhalb der Komponente: Sie liest die aktuelle Uhrzeit und
 * ist damit Datenprüfung, nicht Rendering.
 */
function isExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now();
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [row] = await adminDb
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      inviterName: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .leftJoin(user, eq(invitation.inviterId, user.id))
    .where(eq(invitation.id, id));

  if (!row) {
    return (
      <Shell>
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Einladung nicht gefunden</AlertTitle>
          <AlertDescription>
            Der Link ist ungültig oder die Einladung wurde zurückgezogen. Bitten
            Sie um eine neue Einladung.
          </AlertDescription>
        </Alert>
      </Shell>
    );
  }

  const expired = isExpired(row.expiresAt);
  if (row.status !== "pending" || expired) {
    return (
      <Shell>
        <Alert variant="warning">
          <AlertTriangleIcon />
          <AlertTitle>
            {expired ? "Einladung abgelaufen" : "Einladung nicht mehr gültig"}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {expired
                ? `Diese Einladung war bis zum ${row.expiresAt.toLocaleDateString("de-DE")} gültig.`
                : `Die Einladung wurde bereits bearbeitet (Status: ${row.status}).`}
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/login">Zur Anmeldung</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </Shell>
    );
  }

  const session = await getSession();
  if (!session) {
    // Nach der Anmeldung zurück auf genau diese Einladung
    // (Parametername wie im Proxy und auf der Login-Seite: "next").
    redirect(`/login?next=${encodeURIComponent(`/einladung/${id}`)}`);
  }

  const emailMismatch =
    session.user.email.toLowerCase() !== row.email.toLowerCase();

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>Einladung zu {row.organizationName}</CardTitle>
          <CardDescription>
            {row.inviterName
              ? `${row.inviterName} hat Sie eingeladen.`
              : "Sie wurden eingeladen."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Eingeladen als</span>
              <Badge variant="secondary">{row.role ?? "member"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {roleDescriptions[row.role ?? "member"]}
            </p>
            <div className="flex justify-between pt-2">
              <span className="text-muted-foreground">Adresse</span>
              <span>{row.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gültig bis</span>
              <span>{row.expiresAt.toLocaleDateString("de-DE")}</span>
            </div>
          </div>

          {emailMismatch ? (
            <Alert variant="warning">
              <AlertTriangleIcon />
              <AlertTitle>Andere Adresse angemeldet</AlertTitle>
              <AlertDescription>
                Die Einladung gilt für <strong>{row.email}</strong>, angemeldet
                sind Sie als <strong>{session.user.email}</strong>. Melden Sie
                sich mit der eingeladenen Adresse an, um fortzufahren.
              </AlertDescription>
            </Alert>
          ) : (
            <AcceptForm
              invitationId={row.id}
              organizationId={row.organizationId}
            />
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}
