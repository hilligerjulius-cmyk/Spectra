import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Tote Links sind ein Versprechen, das die Anwendung nicht hält.
 *
 * Dieser Test liest die Navigations- und Footer-Definitionen aus dem Quellcode
 * und prüft für jeden internen Pfad, dass die zugehörige Route existiert.
 * Er schlägt fehl, sobald ein Link ergänzt wird, dessen Seite fehlt — und
 * fängt damit genau den Fehler ab, der bei /preise und /einladung/[id]
 * tatsächlich aufgetreten ist.
 */

const root = process.cwd();

/** Prüft, ob für einen Pfad eine Next-Route existiert (inkl. Routengruppen). */
function routeExists(pathname: string): boolean {
  const segments = pathname.replace(/^\//, "").split("/").filter(Boolean);

  // Kandidaten: mit und ohne Routengruppen-Verzeichnis am Anfang.
  const groups = ["", "(marketing)", "(auth)", "app"];
  for (const group of groups) {
    const base = path.join(root, "src/app", group, ...segments);
    if (
      existsSync(path.join(base, "page.tsx")) ||
      existsSync(path.join(base, "route.ts"))
    ) {
      return true;
    }
  }

  // Dynamische Segmente: letztes Segment gegen [param] prüfen.
  if (segments.length > 0) {
    for (const group of groups) {
      const parent = path.join(root, "src/app", group, ...segments.slice(0, -1));
      if (!existsSync(parent)) continue;
      const dynamic = ["[slug]", "[id]", "[...all]"];
      for (const candidate of dynamic) {
        if (existsSync(path.join(parent, candidate, "page.tsx"))) return true;
      }
    }
  }
  return false;
}

/** Sammelt href="/..."-Werte aus einer Datei. */
async function internalLinks(relativePath: string): Promise<string[]> {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(path.join(root, relativePath), "utf8");
  const found = new Set<string>();
  for (const match of content.matchAll(/href:\s*"(\/[^"]*)"/g)) {
    found.add(match[1]!);
  }
  for (const match of content.matchAll(/href="(\/[^"#?]*)"/g)) {
    found.add(match[1]!);
  }
  return [...found];
}

describe("Interne Links zeigen auf existierende Routen", () => {
  it("Marketing-Navigation und Footer", async () => {
    const links = await internalLinks("src/app/(marketing)/layout.tsx");
    expect(links.length).toBeGreaterThan(10);
    const missing = links.filter((href) => !routeExists(href));
    expect(missing, `Tote Links: ${missing.join(", ")}`).toEqual([]);
  });

  it("App-Navigation", async () => {
    const links = await internalLinks("src/components/app-shell/nav.tsx");
    expect(links.length).toBeGreaterThan(10);
    const missing = links.filter((href) => !routeExists(href));
    expect(missing, `Tote Links: ${missing.join(", ")}`).toEqual([]);
  });

  it("Erkennt fehlende Routen zuverlässig", () => {
    // Gegenprobe: Der Prüfer darf nicht alles durchwinken.
    expect(routeExists("/gibt-es-sicher-nicht")).toBe(false);
    expect(routeExists("/preise")).toBe(true);
    expect(routeExists("/app/billing")).toBe(true);
    expect(routeExists("/einladung/irgendeine-id")).toBe(true);
  });
});
