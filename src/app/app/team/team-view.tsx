"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MailIcon, UserPlusIcon } from "lucide-react";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
  revokeInvitation,
} from "@/server/team/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface MemberView {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  isSelf: boolean;
  joinedAt: string;
}

export interface InvitationView {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
}

export function TeamView({
  members,
  invitations,
  roles,
  roleDescriptions,
  canManage,
  emailIsReal,
}: {
  members: MemberView[];
  invitations: InvitationView[];
  roles: string[];
  roleDescriptions: Record<string, string>;
  canManage: boolean;
  emailIsReal: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("member");

  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; message: string }>,
  ) {
    setPending(key);
    const result = await action();
    setPending(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Person einladen</CardTitle>
            <CardDescription>
              Die Rolle bestimmt, was die Person sehen und entscheiden darf.
              {!emailIsReal
                ? " Ohne konfigurierten SMTP-Zugang wird die Einladung nicht versendet, sondern im Postausgang abgelegt — den Link finden Sie dort."
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1 space-y-1.5">
                <Label htmlFor="inviteEmail">E-Mail-Adresse</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kollegin@beispiel.de"
                />
              </div>
              <div className="w-48 space-y-1.5">
                <Label htmlFor="inviteRole">Rolle</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="inviteRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                disabled={pending === "invite" || email.trim().length === 0}
                onClick={() =>
                  run("invite", async () => {
                    const result = await inviteMember({
                      email: email.trim(),
                      role: inviteRole as never,
                    });
                    if (result.ok) setEmail("");
                    return result;
                  })
                }
              >
                {pending === "invite" ? <Spinner /> : <UserPlusIcon />}
                Einladen
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {roleDescriptions[inviteRole]}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="info">
          <UserPlusIcon />
          <AlertTitle>Nur lesender Zugriff</AlertTitle>
          <AlertDescription>
            Ihre Rolle darf das Team nicht verwalten. Wenden Sie sich an eine
            Person mit Owner- oder Admin-Rolle.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Mitglieder ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead className="w-48">Rolle</TableHead>
                  <TableHead>Seit</TableHead>
                  {canManage ? (
                    <TableHead className="text-right">Aktion</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium">
                        {m.name}
                        {m.isSelf ? (
                          <Badge variant="secondary" className="ml-2">
                            Sie
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select
                          value={m.role}
                          onValueChange={(role) =>
                            run(`role-${m.id}`, () =>
                              changeMemberRole({
                                memberId: m.id,
                                role: role as never,
                              }),
                            )
                          }
                        >
                          <SelectTrigger
                            aria-label={`Rolle von ${m.name}`}
                            className="h-8"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{m.role}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(m.joinedAt).toLocaleDateString("de-DE")}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={m.isSelf || pending === `remove-${m.id}`}
                          onClick={() =>
                            run(`remove-${m.id}`, () => removeMember(m.id))
                          }
                        >
                          {pending === `remove-${m.id}` ? <Spinner /> : null}
                          Entfernen
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offene Einladungen</CardTitle>
            <CardDescription>
              Noch nicht angenommen — die eingeladene Person hat keinen Zugriff.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {invitations.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <MailIcon className="size-4 text-muted-foreground" />
                    <span>{i.email}</span>
                    <Badge variant="secondary">{i.role}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      gültig bis{" "}
                      {new Date(i.expiresAt).toLocaleDateString("de-DE")}
                    </span>
                    {canManage ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending === `revoke-${i.id}`}
                        onClick={() =>
                          run(`revoke-${i.id}`, () => revokeInvitation(i.id))
                        }
                      >
                        {pending === `revoke-${i.id}` ? <Spinner /> : null}
                        Zurückziehen
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
