"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password"));
    if (password.length < 10) {
      toast.error("Das Passwort muss mindestens 10 Zeichen lang sein.");
      return;
    }
    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: String(formData.get("name")),
      email: String(formData.get("email")),
      password,
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message ?? "Registrierung fehlgeschlagen. Bitte erneut versuchen.",
      );
      return;
    }
    toast.success(
      "Konto erstellt. Wir haben Ihnen eine E-Mail zur Bestätigung geschickt.",
    );
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Konto erstellen</CardTitle>
        <CardDescription>
          Kostenlos starten und Ihr digitales Team zusammenstellen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Vollständiger Name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              placeholder="Maria Beispiel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Geschäftliche E-Mail</Label>
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
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Mindestens 10 Zeichen.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner /> : null}
            Konto erstellen
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Bereits registriert?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Anmelden
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
