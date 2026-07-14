import { describe, it, expect } from "vitest";
import { enforcePolicy } from "../src/validation/ast-policy";
import { enforceContract } from "../src/validation/contract";
import { validateSource } from "../src/pipeline/stages/validate";

const GOOD = `import { useState } from "react";
export default function App() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>{n}</button>;
}`;

describe("ast-policy", () => {
  it("accepts a clean component", () => {
    expect(enforcePolicy(GOOD).ok).toBe(true);
  });

  it("rejects fetch()", () => {
    const r = enforcePolicy(`export default function A(){ fetch("/x"); return null; }`);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/fetch/);
  });

  it("rejects eval()", () => {
    expect(enforcePolicy(`export default function A(){ eval("1"); return null; }`).ok).toBe(false);
  });

  it("rejects localStorage access", () => {
    expect(enforcePolicy(`export default function A(){ localStorage.getItem("x"); return null; }`).ok).toBe(false);
  });

  it("rejects document.cookie", () => {
    expect(enforcePolicy(`export default function A(){ const c = document.cookie; return null; }`).ok).toBe(false);
  });

  it("rejects dynamic import()", () => {
    expect(enforcePolicy(`export default function A(){ import("x"); return null; }`).ok).toBe(false);
  });

  it("rejects window.parent escape", () => {
    expect(enforcePolicy(`export default function A(){ window.parent.postMessage(1,"*"); return null; }`).ok).toBe(false);
  });
});

describe("contract", () => {
  it("accepts a single default export importing only react", () => {
    expect(enforceContract(GOOD).ok).toBe(true);
  });

  it("rejects a missing default export", () => {
    expect(enforceContract(`import { useState } from "react"; export const x = 1;`).ok).toBe(false);
  });

  it("rejects non-react imports", () => {
    const r = enforceContract(`import axios from "axios";\nexport default function A(){ return null; }`);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/axios/);
  });
});

describe("validateSource", () => {
  it("flags a syntax error", () => {
    const r = validateSource(`export default function A( { return <div>;`);
    expect(r.ok).toBe(false);
  });
});
