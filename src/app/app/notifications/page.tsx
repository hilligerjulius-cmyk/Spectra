import { requireOrg } from "@/server/auth/guards";
import {
  countUnread,
  listNotifications,
  mailProviderInfo,
  NOTIFICATION_TYPES,
} from "@/server/notifications/service";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";
import { NotificationsView } from "./notifications-view";

export const metadata = { title: "Benachrichtigungen" };

export default async function NotificationsPage() {
  const ctx = await requireOrg();
  const [items, unread] = await Promise.all([
    listNotifications(ctx.organizationId, ctx.userId),
    countUnread(ctx.organizationId, ctx.userId),
  ]);
  const mail = mailProviderInfo();

  const typeLabels = Object.fromEntries(
    NOTIFICATION_TYPES.map((t) => [t.key, t.label]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Benachrichtigungen"
        description="Wartende Freigaben, fehlgeschlagene Läufe und erkannte Risiken."
      />
      {!mail.isReal ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>E-Mail-Versand ist nicht konfiguriert</AlertTitle>
          <AlertDescription>{mail.note}</AlertDescription>
        </Alert>
      ) : null}
      <NotificationsView
        unreadCount={unread}
        typeLabels={typeLabels}
        items={items.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          href: n.href,
          read: n.readAt !== null,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
