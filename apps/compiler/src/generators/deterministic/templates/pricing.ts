import type { TemplateContext } from "../../../pipeline/types";

export function pricingTemplate(ctx: TemplateContext): string {
  return `import { useState } from "react";

const ACCENT = ${JSON.stringify(ctx.accent)};
const TITLE = ${JSON.stringify(ctx.title)};

const TIERS = [
  { name: "Starter", monthly: 0, features: ["1 workspace", "Community support", "Core generation"], highlight: false },
  { name: "Pro", monthly: 24, features: ["Unlimited workspaces", "Priority support", "LLM generation", "Custom themes"], highlight: true },
  { name: "Team", monthly: 79, features: ["Everything in Pro", "SSO & roles", "Audit log", "SLA"], highlight: false },
];

export default function App() {
  const [yearly, setYearly] = useState(false);
  const price = (m) => (m === 0 ? "Free" : "$" + (yearly ? Math.round(m * 10) : m));

  return (
    <div className="min-h-screen w-full px-6 py-14">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-100 mb-3">{TITLE}</h1>
        <p className="text-zinc-500 mb-6">Simple pricing that scales with you.</p>
        <div className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
          <button onClick={() => setYearly(false)} className={"px-4 py-1.5 rounded-full text-sm transition " + (!yearly ? "text-black" : "text-zinc-400")} style={!yearly ? { background: ACCENT } : undefined}>Monthly</button>
          <button onClick={() => setYearly(true)} className={"px-4 py-1.5 rounded-full text-sm transition " + (yearly ? "text-black" : "text-zinc-400")} style={yearly ? { background: ACCENT } : undefined}>Yearly</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className="rounded-2xl p-6 border flex flex-col"
            style={{
              borderColor: t.highlight ? ACCENT : "rgba(255,255,255,0.1)",
              background: t.highlight ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
              boxShadow: t.highlight ? "0 20px 60px -20px " + ACCENT : "none",
            }}
          >
            {t.highlight ? <div className="text-xs font-medium mb-3 self-start px-2 py-0.5 rounded-full text-black" style={{ background: ACCENT }}>Most popular</div> : null}
            <div className="text-lg font-medium text-zinc-200">{t.name}</div>
            <div className="mt-3 mb-5">
              <span className="text-4xl font-semibold text-zinc-100 tabular-nums">{price(t.monthly)}</span>
              {t.monthly > 0 ? <span className="text-zinc-500 text-sm">/{yearly ? "yr" : "mo"}</span> : null}
            </div>
            <ul className="space-y-2.5 flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                  <span style={{ color: ACCENT }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button className="mt-6 py-2.5 rounded-xl font-medium text-black" style={{ background: t.highlight ? ACCENT : "rgba(255,255,255,0.9)" }}>
              Choose {t.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
`;
}
