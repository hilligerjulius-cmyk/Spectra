import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Auth-Integrationstests gegen die Test-DB: Registrierung, Verifikations-Mail
 * in der Outbox, Organisationserstellung mit Owner-Rolle.
 */

const unique = Date.now();

describe("Auth & Organisationen", () => {
  it("registriert einen Nutzer und legt die Verifikations-Mail in die Outbox", async () => {
    const { auth } = await import("@/server/auth/auth");
    const { adminDb } = await import("@/server/db/client");
    const { mailOutbox } = await import("@/server/db/schema");

    const email = `test-${unique}@example.com`;
    const res = await auth.api.signUpEmail({
      body: {
        email,
        password: "sicheres-passwort-123",
        name: "Test Nutzer",
      },
    });
    expect(res.user.email).toBe(email);

    const mails = await adminDb
      .select()
      .from(mailOutbox)
      .where(eq(mailOutbox.recipient, email));
    expect(mails.length).toBeGreaterThanOrEqual(1);
    expect(mails[0]!.category).toBe("auth");
    expect(mails[0]!.status).toBe("stored"); // Outbox: gespeichert, nicht versendet
  });

  it("erstellt eine Organisation; Ersteller wird Owner", async () => {
    const { auth } = await import("@/server/auth/auth");
    const { adminDb } = await import("@/server/db/client");
    const { member } = await import("@/server/db/schema");

    const email = `founder-${unique}@example.com`;
    const signUp = await auth.api.signUpEmail({
      body: { email, password: "sicheres-passwort-123", name: "Gründerin" },
      asResponse: true,
    });
    const cookie = signUp.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();

    const org = await auth.api.createOrganization({
      body: { name: "Acme GmbH", slug: `acme-${unique}` },
      headers: new Headers({ cookie: cookie! }),
    });
    expect(org?.name).toBe("Acme GmbH");

    const members = await adminDb
      .select()
      .from(member)
      .where(eq(member.organizationId, org!.id));
    expect(members).toHaveLength(1);
    expect(members[0]!.role).toBe("owner");
  });

  it("weist Login mit falschem Passwort ab", async () => {
    const { auth } = await import("@/server/auth/auth");
    await expect(
      auth.api.signInEmail({
        body: {
          email: `test-${unique}@example.com`,
          password: "falsches-passwort",
        },
      }),
    ).rejects.toThrow();
  });

  it("verhindert doppelte Registrierung mit derselben E-Mail", async () => {
    const { auth } = await import("@/server/auth/auth");
    await expect(
      auth.api.signUpEmail({
        body: {
          email: `test-${unique}@example.com`,
          password: "sicheres-passwort-456",
          name: "Doppelt",
        },
      }),
    ).rejects.toThrow();
  });
});
