import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";
import { requirePlatformAccess } from "@/server/platform/guards";
import { Logo } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const navItems = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/organisationen", label: "Organisationen" },
  { href: "/admin/preise", label: "Preise & Pläne" },
  { href: "/admin/flags", label: "Funktionsschalter" },
  { href: "/admin/audit", label: "Audit-Suche" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Leitet auf /app um, wenn kein Plattformzugang besteht — die Existenz des
  // Bereichs wird gegenüber Unberechtigten nicht bestätigt.
  const ctx = await requirePlatformAccess("support");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <Logo href="/admin" />
            <Badge variant="warning">
              <ShieldAlertIcon /> Plattform · {ctx.level}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app">Zur Anwendung</Link>
            </Button>
          </div>
        </div>
        <nav
          aria-label="Plattform-Navigation"
          className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 pb-2"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>

      <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
        Jeder Einblick in Kundendaten wird protokolliert und ist im Audit-Log
        der betroffenen Organisation sichtbar.
      </footer>
    </div>
  );
}
