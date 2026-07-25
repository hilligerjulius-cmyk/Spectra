import { expect, test } from "@playwright/test";

/**
 * E2E-Tests der öffentlichen Seiten.
 *
 * Diese Tests prüfen, was ohne Anmeldung erreichbar sein muss: dass jede
 * verlinkte Seite lädt, dass die Sicherheits-Kopfzeilen gesetzt sind und dass
 * geschützte Bereiche nicht ohne Anmeldung zugänglich sind. Sie ergänzen die
 * Integrationstests, die die Fachlogik gegen die Datenbank abdecken.
 */

const publicPages = [
  { path: "/", heading: /Build your digital workforce/i },
  { path: "/produkt", heading: /Digitale Mitarbeiter, nicht Chatbots/i },
  { path: "/departments", heading: /Department/i },
  { path: "/agenten", heading: /Alle digitalen Mitarbeiter/i },
  { path: "/preise", heading: /Preise ohne Überraschungen/i },
  { path: "/sicherheit", heading: /Wir verlassen uns nicht/i },
  { path: "/integrationen", heading: /Was heute wirklich angebunden ist/i },
  { path: "/faq", heading: /Häufige Fragen/i },
  { path: "/konfigurator", heading: /./ },
  { path: "/loesungen/unternehmensgroesse", heading: /Womit Sie sinnvoll starten/i },
  { path: "/loesungen/anwendungsfall", heading: /Sechs Abläufe/i },
  { path: "/datenschutz-produkt", heading: /Welche Daten wofür/i },
  { path: "/ueber-uns", heading: /Weniger Autonomie/i },
  { path: "/ressourcen", heading: /Leitfäden/i },
  { path: "/kontakt", heading: /Schreiben Sie uns/i },
  { path: "/impressum", heading: /Impressum/i },
  { path: "/datenschutz", heading: /Datenschutzerklärung/i },
  { path: "/agb", heading: /Allgemeine Geschäftsbedingungen/i },
  { path: "/login", heading: /Anmelden/i },
  { path: "/register", heading: /Konto erstellen/i },
];

test.describe("Öffentliche Seiten", () => {
  for (const page of publicPages) {
    test(`${page.path} lädt und zeigt Inhalt`, async ({ page: browser }) => {
      const response = await browser.goto(page.path);
      expect(response?.status(), `${page.path} antwortet nicht mit 200`).toBe(
        200,
      );
      await expect(
        browser.locator("h1").first(),
        `${page.path} hat keine passende Überschrift`,
      ).toContainText(page.heading);
    });
  }

  test("setzt Sicherheits-Kopfzeilen auf jeder Antwort", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response!.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  test("Rechtstexte sind als Entwurf gekennzeichnet", async ({ page }) => {
    for (const path of ["/impressum", "/datenschutz", "/agb"]) {
      await page.goto(path);
      await expect(
        page.getByText("Entwurf — juristisch zu prüfen"),
        `${path} kennzeichnet den Entwurfsstatus nicht`,
      ).toBeVisible();
      await expect(page.getByText("keine Rechtsberatung")).toBeVisible();
    }
  });

  test("Preisseite nennt Beträge und die Kontingent-Grenze", async ({ page }) => {
    await page.goto("/preise");
    await expect(page.getByText(/199/).first()).toBeVisible();
    // Die ehrliche Aussage zum Kontingent muss dort stehen.
    await expect(
      page.getByText(/stoppen die Agenten, statt still weiterzulaufen/i),
    ).toBeVisible();
  });

  test("Integrationsseite trennt fertig von nicht implementiert", async ({
    page,
  }) => {
    await page.goto("/integrationen");
    // Auf Überschriften prüfen, nicht auf beliebiges Vorkommen des Textes —
    // die Begriffe stehen zusätzlich im Einleitungsabsatz.
    await expect(
      page.getByRole("heading", { name: /Sofort nutzbar/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Implementiert, Zugangsdaten erforderlich/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Noch nicht implementiert/i }),
    ).toBeVisible();
  });
});

test.describe("Geschützte Bereiche", () => {
  for (const path of ["/app", "/app/billing", "/onboarding", "/admin"]) {
    test(`${path} leitet ohne Anmeldung auf /login um`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      // Der Zielpfad bleibt erhalten, damit die Anmeldung dorthin zurückführt.
      expect(page.url()).toContain("next=");
    });
  }
});

test.describe("Webhook-Endpunkt", () => {
  test("weist unsignierte Aufrufe ab", async ({ request }) => {
    const response = await request.post("/api/webhooks/irgendeine-org", {
      data: { event: "test", title: "Ohne Signatur" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  test("lehnt GET ausdrücklich ab", async ({ request }) => {
    const response = await request.get("/api/webhooks/irgendeine-org");
    expect(response.status()).toBe(405);
  });
});

test.describe("Systemzustand", () => {
  test("Health-Endpunkt antwortet", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
  });
});
