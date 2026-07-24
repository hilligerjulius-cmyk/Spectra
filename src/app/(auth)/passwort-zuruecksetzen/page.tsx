"use client";

import * as React from "react";
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

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      toast.error("Ungültiger oder abgelaufener Link.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    const { error } = await authClient.resetPassword({
      newPassword: String(formData.get("password")),
      token,
    });
    setLoading(false);
    if (error) {
      toast.error("Zurücksetzen fehlgeschlagen. Der Link ist möglicherweise abgelaufen.");
      return;
    }
    toast.success("Passwort aktualisiert. Bitte melden Sie sich an.");
    router.push("/login");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neues Passwort festlegen</CardTitle>
        <CardDescription>Mindestens 10 Zeichen.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Neues Passwort</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner /> : null}
            Passwort speichern
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense>
      <ResetPasswordForm />
    </React.Suspense>
  );
}
