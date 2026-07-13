# Spectra Systems

> **Zero-Interface / Fluid On-Demand Software.**
> Describe anything. Watch it materialize into a living, sandboxed application inside a cinematic
> canvas — in milliseconds. The interface *is* the app it becomes.

Spectra turns pure natural-language intent into a running React application on the fly. There are
no forms, dashboards, or settings screens to navigate — you express what you want, and a bespoke
app is compiled and mounted before you in real time.

---

## How it works

```
  intent ─►  THE SPECTRA CANVAS  ─► POST /materialize ─►  THE COMPILER ENGINE  ─► compiled ESM
   "a         (Next.js · React 19)      (SSE stream)         (Node.js · Fastify)      + manifest
   kanban          ▲                                    Ingest ▸ Generate ▸ Validate       │
   board")         │                                    ▸ Compile(esbuild) ▸ Repair ▸ Package
                   │                                                                        │
                   └──────────  THE MOUNTING SANDBOX  ◄─────────────────────────────────────┘
                        sandboxed <iframe> (null origin) · CSP · React · postMessage bridge
```

1. **The Spectra Canvas** — a single, breathtaking surface with a ⌘K command bar. On submit it
   streams the compiler's pipeline phases live, then plays the **morph**: spectral light collapses
   into the app container as chromatic aberration resolves into focus.
2. **The Compiler Engine** — a Fastify pipeline that turns intent into a component and *guarantees*
   it is syntactically valid before it ships. The **zero-syntax-error guarantee** is a mechanism:
   every candidate must survive `@babel/parser` AST validation **and** an `esbuild` transform.
   Failures are fed back into a bounded **repair loop**; anything unhealable falls back to a
   known-good template. The canvas never mounts broken code.
3. **The Mounting Sandbox** — generated code runs inside a `sandbox="allow-scripts"` iframe with
   **no `allow-same-origin`**, so it executes at a null origin with no access to the parent DOM,
   cookies, storage, or your session. A strict CSP and a server-side AST deny-list (no
   `eval`/`fetch`/`localStorage`/dynamic-import) provide defense in depth. A React error boundary
   means a faulty app can never crash the canvas.

### Hybrid generation

- **Deterministic (default):** a fast intent-grammar classifies your request into one of nine
  hand-authored, guaranteed-valid archetypes — **todo, kanban, calculator, dashboard, timer,
  notes, form, pricing, landing** — and materializes it instantly. **Zero API keys, fully offline.**
- **LLM (opt-in):** set `SPECTRA_LLM=anthropic` and `ANTHROPIC_API_KEY` to generate open-ended apps
  with Claude. Its output still runs the *full* validate → compile → repair loop — the model is
  never trusted blindly, and a deterministic template is always the ultimate fallback.

---

## Quickstart

Requirements: **Node ≥ 20**, **pnpm 10**.

```bash
pnpm install
pnpm dev
```

- Canvas → http://localhost:3000
- Compiler → http://localhost:4000 (`GET /health`)

Open the canvas, press **⌘K** (or click a suggestion chip), describe an app, and watch it
materialize. Everything runs offline with zero configuration.

> The sandbox iframe loads the React runtime from a CDN (`esm.sh`) at mount time, so the live
> in-browser app render needs outbound network access to that host. On a restricted network the
> pipeline, phases, and morph still run; only the final in-iframe render is affected.

### Optional: open-ended LLM generation

```bash
cp .env.example .env
# edit .env:
#   SPECTRA_LLM=anthropic
#   ANTHROPIC_API_KEY=sk-ant-...
pnpm dev
```

---

## Deploy (Railway, single service)

Spectra ships as **one container**: the Compiler Engine runs **in-process** inside the Next.js
server (the `/api/materialize` route runs the pipeline directly and streams SSE), so there's no
second service to wire up and **no environment variables are required**.

1. Push this repo to GitHub (already done for the working branch).
2. On [Railway](https://railway.app): **New Project → Deploy from GitHub repo** → pick this repo.
3. Railway detects the root `Dockerfile` (pinned via `railway.json`) and builds the image.
   It injects `PORT`; the server binds it automatically. That's it — open the generated URL.

Because a real browser can reach the CDN, the sandbox renders the live app fully in production.

**Optional env:**
- `SPECTRA_LLM=anthropic` + `ANTHROPIC_API_KEY` — enable open-ended LLM generation.
- `COMPILER_URL=https://…` — switch to a **two-service** topology: the canvas proxies to a
  standalone Fastify compiler (run `pnpm --filter @spectra/compiler start` as its own service)
  instead of running the pipeline in-process.

Local production check:

```bash
pnpm --filter @spectra/canvas build
pnpm --filter @spectra/canvas start   # in-process compiler, honors $PORT (default 3000)
```

## Monorepo layout

```
apps/
  canvas/      The Spectra Canvas — Next.js 15 · React 19 · Tailwind · Framer Motion
  compiler/    The Compiler Engine — Node.js · Fastify · esbuild · @babel/parser
packages/
  contracts/       Shared TS types (MaterializeRequest, PhaseEvent, AppManifest…)
  design-tokens/   The Spectral Prism design system + CSS-variable emitter
  sandbox/         The Mounting Sandbox (iframe engine, srcdoc, bridge, policy)
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run the compiler + canvas together (Turborepo, parallel) |
| `pnpm build` | Production build of every package/app |
| `pnpm typecheck` | Type-check the whole workspace |
| `pnpm test` | Run the compiler test suite (Vitest) |

## Verifying it works

```bash
pnpm typecheck                 # all packages type-check
pnpm test                      # 30 tests: validation policy, template compile,
                               # pipeline e2e + cache + repair-fallback, and a test
                               # that executes each compiled bundle under React

# live pipeline smoke test (with `pnpm dev` running):
curl -N -X POST http://localhost:4000/materialize \
  -H 'Content-Type: application/json' \
  -d '{"intent":"a kanban board"}'
```

---

## Design identity — Spectral Prism

A near-black canvas (`#08080A`) holds a refracted light spectrum. The signature gradient
(violet `#7C5CFF` → blue `#3B82F6` → cyan `#22D3EE`) is used sparingly — for accent, glow, and the
materialization morph — never as flat fill. Tokens live in `packages/design-tokens` and are the
single source of truth for both the Tailwind theme and the sandbox frame, so the canvas and every
materialized app feel like one system.
