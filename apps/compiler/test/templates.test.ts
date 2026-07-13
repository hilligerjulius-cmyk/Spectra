import { describe, it, expect } from "vitest";
import { ARCHETYPES, resolveTemplate } from "../src/generators/deterministic/registry";
import { validateSource } from "../src/pipeline/stages/validate";
import { compileSource } from "../src/pipeline/stages/compile";

const ctx = { title: "Test", intent: "a test app", accent: "#7C5CFF" };

describe("deterministic templates", () => {
  it("registers at least 8 archetypes", () => {
    expect(ARCHETYPES.length).toBeGreaterThanOrEqual(8);
  });

  for (const archetype of ARCHETYPES) {
    it(`"${archetype}" passes validation and compiles to a module`, async () => {
      const source = resolveTemplate(archetype)(ctx);

      const validation = validateSource(source);
      expect(validation.ok, validation.errors.join("; ")).toBe(true);

      const compiled = await compileSource(source);
      expect(compiled.ok, compiled.errors.join("; ")).toBe(true);
      expect(compiled.bundle && compiled.bundle.length).toBeGreaterThan(0);
      // Compiled ESM keeps react as an external import and a default export.
      expect(compiled.bundle).toMatch(/from\s*"react/);
      expect(compiled.bundle).toMatch(/export\s*\{[^}]*default|export default/);
    });
  }
});
