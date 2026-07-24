import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, twoFactor } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/lib/env";
import { adminDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { sendMail } from "@/server/mail";
import { ac, roles } from "./permissions";

/**
 * Better-Auth-Konfiguration: E-Mail/Passwort mit Verifikation, Sessions,
 * Organisationen mit eigener Rollen-/Berechtigungsmatrix, optionale MFA (TOTP).
 * Auth-Tabellen werden über die Owner-Rolle verwaltet (adminDb) — sie sind
 * nutzerbezogen, nicht mandantenbezogen; Mandanten-Daten laufen über withOrg().
 */
export const auth = betterAuth({
  appName: "WORKFORCE OS",
  baseURL: env.APP_URL,
  secret: env.AUTH_SECRET,
  database: drizzleAdapter(adminDb, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        category: "auth",
        subject: "WORKFORCE OS — Passwort zurücksetzen",
        text: `Hallo ${user.name ?? ""},\n\nüber folgenden Link können Sie Ihr Passwort zurücksetzen:\n${url}\n\nWenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        category: "auth",
        subject: "WORKFORCE OS — E-Mail-Adresse bestätigen",
        text: `Hallo ${user.name ?? ""},\n\nbitte bestätigen Sie Ihre E-Mail-Adresse:\n${url}\n\nDanach können Sie Ihre Organisation anlegen und Ihr digitales Team zusammenstellen.`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 Tage
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
  },
  advanced: {
    database: { generateId: () => crypto.randomUUID() },
  },
  plugins: [
    organization({
      ac,
      roles,
      allowUserToCreateOrganization: true,
      sendInvitationEmail: async (data) => {
        const inviteUrl = `${env.APP_URL}/einladung/${data.id}`;
        await sendMail({
          to: data.email,
          category: "invitation",
          organizationId: data.organization.id,
          subject: `Einladung zu ${data.organization.name} — WORKFORCE OS`,
          text: `${data.inviter.user.name ?? "Ein Teammitglied"} hat Sie zur Organisation "${data.organization.name}" eingeladen.\n\nEinladung annehmen: ${inviteUrl}`,
        });
      },
    }),
    twoFactor({ issuer: "WORKFORCE OS" }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
