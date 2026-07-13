import type { TemplateContext } from "../../../pipeline/types";

export function landingTemplate(ctx: TemplateContext): string {
  return `import { useState } from "react";

const ACCENT = ${JSON.stringify(ctx.accent)};
const TITLE = ${JSON.stringify(ctx.title)};
const INTENT = ${JSON.stringify(ctx.intent)};

const FEATURES = [
  { icon: "◆", title: "Instant", body: "Materializes in milliseconds from a single line of intent." },
  { icon: "✦", title: "Fluid", body: "The interface becomes the product — no menus, no friction." },
  { icon: "◈", title: "Precise", body: "Every pixel and interaction tuned to a spectral system." },
];

export default function App() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <div className="min-h-screen w-full px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
          Materialized by Spectra
        </div>

        <h1 className="text-5xl font-semibold tracking-tight leading-tight text-zinc-100 mb-5" style={{ maxWidth: "20ch" }}>
          {TITLE}
        </h1>
        <p className="text-lg text-zinc-400 mb-8" style={{ maxWidth: "52ch" }}>
          {INTENT}. A crafted, on-demand experience — built the instant you asked for it.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-16">
          <button className="px-6 py-3 rounded-xl font-medium text-black" style={{ background: ACCENT }}>Get started</button>
          <button className="px-6 py-3 rounded-xl font-medium text-zinc-200 bg-white/5 border border-white/10">Learn more</button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-16">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white/5 border border-white/10 p-6">
              <div className="text-2xl mb-3" style={{ color: ACCENT }}>{f.icon}</div>
              <div className="text-zinc-100 font-medium mb-1.5">{f.title}</div>
              <div className="text-sm text-zinc-500 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 p-8 text-center" style={{ background: "radial-gradient(80% 120% at 50% 0%, " + ACCENT + "22, transparent 70%)" }}>
          <h3 className="text-2xl font-semibold text-zinc-100 mb-2">Join the waitlist</h3>
          <p className="text-zinc-500 mb-5">Be first when it goes live.</p>
          {joined ? (
            <div className="text-zinc-200">You're on the list ✓</div>
          ) : (
            <div className="flex gap-2 max-w-md mx-auto">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 outline-none text-zinc-100"
              />
              <button
                onClick={() => email.includes("@") && setJoined(true)}
                className="px-5 py-3 rounded-xl font-medium text-black"
                style={{ background: ACCENT }}
              >
                Join
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;
}
