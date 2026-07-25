import "dotenv/config";
import { Pool } from "pg";

/**
 * Vergibt oder entzieht den Zugang zum Plattform-Adminbereich.
 *
 * Es gibt bewusst keinen Weg, sich diesen Zugang aus der Anwendung heraus
 * selbst zu geben: Wer Zugriff auf die Plattformverwaltung erhält, muss auf
 * dem Server entschieden werden. Deshalb dieses CLI.
 *
 * Aufruf:
 *   pnpm platform:admin -- <e-mail> [support|admin]
 *   pnpm platform:admin -- <e-mail> entziehen
 *   pnpm platform:admin -- --liste
 */

const HELP = `
Plattform-Zugang verwalten

  pnpm platform:admin -- person@example.com admin      Vollzugriff (Preise, Pläne, Schalter)
  pnpm platform:admin -- person@example.com support    Nur Einsicht (protokollpflichtig)
  pnpm platform:admin -- person@example.com entziehen  Zugang entfernen
  pnpm platform:admin -- --liste                       Aktuelle Zugänge anzeigen

Die Person muss bereits ein Konto in der Anwendung haben.
`.trim();

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return;
  }

  const url =
    process.env.DATABASE_ADMIN_URL ??
    "postgres://workforce_owner:workforce_owner_dev@localhost:5432/workforce_dev";
  const pool = new Pool({ connectionString: url, max: 1 });

  try {
    if (args[0] === "--liste") {
      const { rows } = await pool.query(
        `select u.email, u.name, p.level, p.created_at
           from platform_admin p
           join "user" u on u.id = p.user_id
          order by p.created_at`,
      );
      if (rows.length === 0) {
        console.log(
          "Kein Plattform-Zugang vergeben. Der Adminbereich ist derzeit für niemanden erreichbar.",
        );
        return;
      }
      console.log(`${rows.length} Zugang/Zugänge:`);
      for (const row of rows) {
        console.log(
          `  ${row.level.padEnd(8)} ${row.email} (${row.name}) — seit ${new Date(row.created_at).toLocaleDateString("de-DE")}`,
        );
      }
      return;
    }

    const email = args[0]!.trim().toLowerCase();
    const action = (args[1] ?? "support").trim().toLowerCase();

    const { rows: users } = await pool.query(
      `select id, name from "user" where lower(email) = $1`,
      [email],
    );
    if (users.length === 0) {
      console.error(
        `Kein Konto mit der Adresse "${email}" gefunden. Bitte zuerst in der Anwendung registrieren.`,
      );
      process.exitCode = 1;
      return;
    }
    const target = users[0]!;

    if (action === "entziehen" || action === "revoke") {
      const { rowCount } = await pool.query(
        `delete from platform_admin where user_id = $1`,
        [target.id],
      );
      console.log(
        rowCount && rowCount > 0
          ? `Plattform-Zugang für ${email} entfernt.`
          : `${email} hatte keinen Plattform-Zugang.`,
      );
      return;
    }

    if (action !== "support" && action !== "admin") {
      console.error(
        `Unbekannte Stufe "${action}". Erlaubt sind: support, admin, entziehen.`,
      );
      process.exitCode = 1;
      return;
    }

    await pool.query(
      `insert into platform_admin (id, user_id, level, note, created_at)
       values (gen_random_uuid()::text, $1, $2, $3, now())
       on conflict (user_id) do update set level = excluded.level, note = excluded.note`,
      [target.id, action, `Vergeben über scripts/grant-platform-admin.ts`],
    );
    console.log(
      `${email} (${target.name}) hat jetzt Plattform-Zugang der Stufe "${action}".`,
    );
    if (action === "support") {
      console.log(
        "Hinweis: Stufe „support“ darf einsehen, aber nichts ändern. Jeder Einblick in Kundendaten wird protokolliert.",
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Vergabe fehlgeschlagen:", err);
  process.exit(1);
});
