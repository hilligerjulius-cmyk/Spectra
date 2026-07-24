"use client";

import * as React from "react";
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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);
}

export function CreateOrganizationForm({ userName }: { userName: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    setLoading(true);
    const { data, error } = await authClient.organization.create({
      name,
      slug,
    });
    if (error || !data) {
      setLoading(false);
      toast.error("Organisation konnte nicht erstellt werden.");
      return;
    }
    await authClient.organization.setActive({ organizationId: data.id });
    setLoading(false);
    toast.success(`Willkommen, ${userName.split(" ")[0]}!`);
    router.push("/app");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organisation erstellen</CardTitle>
        <CardDescription>
          Ihre Organisation ist der sichere, getrennte Arbeitsbereich für Ihr
          Team und Ihre digitalen Mitarbeiter.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Name des Unternehmens</Label>
            <Input
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              placeholder="Beispiel GmbH"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !name}>
            {loading ? <Spinner /> : null}
            Organisation anlegen
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
