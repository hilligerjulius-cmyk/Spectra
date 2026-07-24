import "dotenv/config";

/**
 * Demo-Daten für eine bestehende Organisation erzeugen.
 * Aufruf: pnpm db:seed:demo <email-der-nutzerin>
 * Ohne Argument wird die erste Organisation in der Datenbank verwendet.
 */
async function main() {
  const email = process.argv[2];
  const { seedDemoData, findOrganizationForEmail } = await import(
    "@/server/demo/seed"
  );
  const { adminDb } = await import("@/server/db/client");
  const { member, organization, user } = await import("@/server/db/schema");
  const { eq } = await import("drizzle-orm");

  let target: {
    organizationId: string;
    organizationName: string;
    userId: string;
    userLabel: string;
  } | null = null;

  if (email) {
    target = await findOrganizationForEmail(email);
    if (!target) {
      console.error(
        `Keine Organisation für "${email}" gefunden. Bitte zuerst registrieren und eine Organisation anlegen.`,
      );
      process.exit(1);
    }
  } else {
    const [row] = await adminDb
      .select({
        organizationId: organization.id,
        organizationName: organization.name,
        userId: member.userId,
        userLabel: user.name,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .innerJoin(user, eq(member.userId, user.id))
      .limit(1);
    if (!row) {
      console.error(
        "Keine Organisation in der Datenbank. Bitte zuerst registrieren und eine Organisation anlegen.",
      );
      process.exit(1);
    }
    target = row;
  }

  console.log(`Erzeuge Demo-Daten für "${target.organizationName}"…`);
  const result = await seedDemoData({
    organizationId: target.organizationId,
    userId: target.userId,
    userLabel: target.userLabel,
  });
  console.log(
    `Fertig: ${result.emails} E-Mails, ${result.events} Termine, ${result.deals} Deals, ${result.documents} Wissensdokumente, ${result.agents} Agenten (Sandbox-Modus).`,
  );
  console.log(
    "Alle Datensätze sind als Demo gekennzeichnet und im UI entsprechend markiert.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Demo-Seed fehlgeschlagen:", err);
  process.exit(1);
});
