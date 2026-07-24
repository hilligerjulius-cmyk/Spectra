"use client";

import Link from "next/link";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Glocke mit Zähler ungelesener Meldungen. Die Zahl wird serverseitig beim
 * Rendern der App-Shell ermittelt und mit jeder Navigation aktualisiert —
 * bewusst ohne Polling, damit keine Dauerlast entsteht.
 */
export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      asChild
      aria-label={
        unread > 0
          ? `Benachrichtigungen, ${unread} ungelesen`
          : "Benachrichtigungen"
      }
    >
      <Link href="/app/notifications" className="relative">
        <BellIcon />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-4 text-primary-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
