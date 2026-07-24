"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    const { error } = await authClient.signIn.email({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.status === 403
          ? "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse."
          : "Anmeldung fehlgeschlagen. Bitte prüfen Sie E-Mail und Passwort.",
      );
      return;
    }
    const next = searchParams.get("next");
    router.push(next && next.startsWith("/") ? next : "/app");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anmelden</CardTitle>
        <CardDescription>
          Willkommen zurück. Melden Sie sich bei Ihrem Konto an.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="sie@unternehmen.de"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Passwort</Label>
              <Link
                href="/passwort-vergessen"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Passwort vergessen?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner /> : null}
            Anmelden
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Noch kein Konto?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Jetzt registrieren
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}
