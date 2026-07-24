"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SendIcon } from "lucide-react";
import {
  saveNotificationPreference,
  sendDigestNow,
} from "@/server/notifications/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface TypeOption {
  key: string;
  label: string;
  description: string;
}

export function NotificationSettings({
  types,
  initial,
  emailIsReal,
}: {
  types: TypeOption[];
  initial: {
    inAppTypes: string[];
    emailTypes: string[];
    dailyDigest: boolean;
    digestHour: string;
  };
  emailIsReal: boolean;
}) {
  const router = useRouter();
  const [inApp, setInApp] = React.useState<string[]>(initial.inAppTypes);
  const [email, setEmail] = React.useState<string[]>(initial.emailTypes);
  const [digest, setDigest] = React.useState(initial.dailyDigest);
  const [hour, setHour] = React.useState(initial.digestHour);
  const [pending, setPending] = React.useState<string | null>(null);

  function toggle(
    list: string[],
    set: (v: string[]) => void,
    key: string,
    on: boolean,
  ) {
    set(on ? [...new Set([...list, key])] : list.filter((k) => k !== key));
  }

  async function save() {
    setPending("save");
    const result = await saveNotificationPreference({
      inAppTypes: inApp,
      emailTypes: email,
      dailyDigest: digest,
      digestHour: hour,
    });
    setPending(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function testDigest() {
    setPending("digest");
    const result = await sendDigestNow();
    setPending(null);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Benachrichtigungen</CardTitle>
        <CardDescription>
          Wählen Sie je Anlass, ob Sie ihn in der Anwendung und/oder per E-Mail
          erhalten.
          {!emailIsReal
            ? " Ohne konfigurierten SMTP-Zugang werden E-Mails im Postausgang abgelegt statt versendet."
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium">Anlass</th>
                <th className="w-24 pb-2 text-center font-medium">In-App</th>
                <th className="w-24 pb-2 text-center font-medium">E-Mail</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.key} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  </td>
                  <td className="py-3 text-center">
                    <Checkbox
                      aria-label={`${t.label} in der Anwendung`}
                      checked={inApp.includes(t.key)}
                      onCheckedChange={(v) =>
                        toggle(inApp, setInApp, t.key, v === true)
                      }
                    />
                  </td>
                  <td className="py-3 text-center">
                    <Checkbox
                      aria-label={`${t.label} per E-Mail`}
                      checked={email.includes(t.key)}
                      onCheckedChange={(v) =>
                        toggle(email, setEmail, t.key, v === true)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Switch
              id="digest"
              checked={digest}
              onCheckedChange={setDigest}
            />
            <Label htmlFor="digest" className="cursor-pointer">
              Tageszusammenfassung statt Einzelmails
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Bei aktivierter Zusammenfassung entfallen die einzelnen E-Mails; die
            gewählten Anlässe werden gebündelt zugestellt. In-App-Meldungen
            erscheinen weiterhin sofort. Ohne neue Meldungen wird nichts
            versendet.
          </p>
          {digest ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="digestHour">Uhrzeit</Label>
                <Input
                  id="digestHour"
                  type="time"
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending === "digest"}
                onClick={testDigest}
              >
                {pending === "digest" ? <Spinner /> : <SendIcon />}
                Jetzt erzeugen
              </Button>
            </div>
          ) : null}
        </div>

        <Button disabled={pending === "save"} onClick={save}>
          {pending === "save" ? <Spinner /> : null}
          Einstellungen speichern
        </Button>
      </CardContent>
    </Card>
  );
}
