"use client";

import * as React from "react";
import Link from "next/link";
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

export default function ForgotPasswordPage() {
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    const { error } = await authClient.requestPasswordReset({
      email: String(formData.get("email")),
      redirectTo: "/passwort-zuruecksetzen",
    });
    setLoading(false);
    if (error) {
      toast.error("Anfrage fehlgeschlagen. Bitte erneut versuchen.");
      return;
    }
    setSent(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Passwort zurücksetzen</CardTitle>
        <CardDescription>
          Wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Wenn ein Konto mit dieser E-Mail-Adresse existiert, haben wir Ihnen
            soeben einen Link geschickt. Bitte prüfen Sie Ihr Postfach.
          </p>
        ) : (
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Spinner /> : null}
              Link anfordern
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Zurück zur Anmeldung
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
