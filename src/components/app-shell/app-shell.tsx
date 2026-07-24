"use client";

import * as React from "react";
import { MenuIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { OrgSwitcher, type OrgSummary } from "./org-switcher";
import { UserMenu } from "./user-menu";
import { CommandMenu } from "./command-menu";
import { NotificationBell } from "./notification-bell";

export function AppShell({
  user,
  activeOrg,
  organizations,
  role,
  unreadNotifications,
  children,
}: {
  user: { name: string; email: string };
  activeOrg: OrgSummary;
  organizations: OrgSummary[];
  role: string;
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop-Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b px-5">
          <Logo href="/app" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="border-t p-2">
          <OrgSwitcher activeOrg={activeOrg} organizations={organizations} />
        </div>
      </aside>

      {/* Hauptbereich */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md">
          {/* Mobile-Navigation */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Navigation öffnen"
              >
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-14 items-center border-b px-5">
                <Logo href="/app" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarNav onNavigate={() => setMobileOpen(false)} />
              </div>
              <div className="border-t p-2">
                <OrgSwitcher
                  activeOrg={activeOrg}
                  organizations={organizations}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex flex-1 items-center justify-end gap-2">
            <CommandMenu />
            <NotificationBell unread={unreadNotifications} />
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} role={role} />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
