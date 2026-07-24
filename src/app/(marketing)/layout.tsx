import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/produkt", label: "Produkt" },
  { href: "/departments", label: "Departments" },
  { href: "/agenten", label: "Agenten" },
  { href: "/preise", label: "Preise" },
  { href: "/sicherheit", label: "Sicherheit" },
  { href: "/faq", label: "FAQ" },
];

const footerColumns: { title: string; links: { href: string; label: string }[] }[] =
  [
    {
      title: "Produkt",
      links: [
        { href: "/produkt", label: "Übersicht" },
        { href: "/departments", label: "Departments" },
        { href: "/agenten", label: "Alle Agenten" },
        { href: "/preise", label: "Preise" },
        { href: "/integrationen", label: "Integrationen" },
        { href: "/konfigurator", label: "Team-Konfigurator" },
      ],
    },
    {
      title: "Lösungen",
      links: [
        { href: "/loesungen/unternehmensgroesse", label: "Nach Unternehmensgröße" },
        { href: "/loesungen/anwendungsfall", label: "Nach Anwendungsfall" },
        { href: "/sicherheit", label: "Sicherheit" },
        { href: "/datenschutz-produkt", label: "Datenschutz im Produkt" },
      ],
    },
    {
      title: "Unternehmen",
      links: [
        { href: "/ueber-uns", label: "Über uns" },
        { href: "/ressourcen", label: "Ressourcen" },
        { href: "/faq", label: "FAQ" },
        { href: "/kontakt", label: "Kontakt" },
      ],
    },
    {
      title: "Rechtliches",
      links: [
        { href: "/impressum", label: "Impressum" },
        { href: "/datenschutz", label: "Datenschutzerklärung" },
        { href: "/agb", label: "AGB" },
      ],
    },
  ];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-8">
            <Logo />
            <nav
              aria-label="Hauptnavigation"
              className="hidden items-center gap-1 md:flex"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/konfigurator">Team zusammenstellen</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-3">
              <Logo />
              <p className="text-sm text-muted-foreground">
                Build your digital workforce.
              </p>
            </div>
            {footerColumns.map((col) => (
              <div key={col.title}>
                <h3 className="mb-3 text-sm font-semibold">{col.title}</h3>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 border-t pt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} WORKFORCE OS. Alle Rechte vorbehalten.
          </div>
        </div>
      </footer>
    </div>
  );
}
