import { describe, it, expect, afterAll } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentType } from "react";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveTemplate } from "../src/generators/deterministic/registry";
import { compileSource } from "../src/pipeline/stages/compile";

/**
 * The strongest offline proof that the Mounting Sandbox contract holds: take a
 * template, run it through the REAL compiler, then actually execute the emitted
 * ES module under React and assert the rendered HTML. If React is available
 * (which it is in any browser), this is exactly what the sandbox will mount.
 */
const ctx = { title: "Demo", intent: "a demo app", accent: "#7C5CFF" };

// Temp dir INSIDE the package so the bundle's bare `react` imports resolve.
const dir = mkdtempSync(join(process.cwd(), ".render-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function renderArchetype(archetype: string): Promise<string> {
  const source = resolveTemplate(archetype)(ctx);
  const compiled = await compileSource(source);
  expect(compiled.ok, compiled.errors.join("; ")).toBe(true);
  const file = join(dir, `${archetype}.mjs`);
  writeFileSync(file, compiled.bundle!, "utf8");
  const mod = (await import(pathToFileURL(file).href)) as { default: ComponentType };
  return renderToStaticMarkup(createElement(mod.default));
}

describe("materialized bundles render under React", () => {
  it("kanban renders its columns and seed cards", async () => {
    const html = await renderArchetype("kanban");
    expect(html).toContain("Backlog");
    expect(html).toContain("In Progress");
    expect(html).toContain("Research spectral palette");
  });

  it("timer renders the initial focus duration", async () => {
    const html = await renderArchetype("timer");
    expect(html).toContain("25:00");
  });

  it("pricing renders its tiers", async () => {
    const html = await renderArchetype("pricing");
    expect(html).toContain("Starter");
    expect(html).toContain("Pro");
    expect(html).toContain("Team");
  });

  it("landing echoes the intent", async () => {
    const html = await renderArchetype("landing");
    expect(html).toContain("Materialized by Spectra");
    expect(html.toLowerCase()).toContain("demo");
  });

  it("todo renders seed tasks", async () => {
    const html = await renderArchetype("todo");
    expect(html).toContain("Ship it");
  });
});
