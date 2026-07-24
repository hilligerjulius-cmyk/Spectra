"use client";

import { createAuthClient } from "better-auth/react";
import {
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { ac, roles } from "@/server/auth/permissions";

/**
 * Auth-Client für Client-Komponenten. `permissions.ts` ist client-sicher
 * (reine Rollen-/Berechtigungsdefinitionen, keine Server-Abhängigkeiten).
 */
export const authClient = createAuthClient({
  plugins: [organizationClient({ ac, roles }), twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
