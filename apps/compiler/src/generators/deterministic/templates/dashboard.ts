import type { TemplateContext } from "../../../pipeline/types";

export function dashboardTemplate(ctx: TemplateContext): string {
  return `import { useState, useMemo } from "react";

const ACCENT = ${JSON.stringify(ctx.accent)};
const TITLE = ${JSON.stringify(ctx.title)};

const RANGES = { "7d": 7, "30d": 30, "90d": 90 };

function series(n, seed) {
  const out = [];
  let v = 40 + (seed % 20);
  for (let i = 0; i < n; i++) {
    v = Math.max(8, Math.min(100, v + Math.sin((i + seed) / 2) * 12 + ((i * 7 + seed) % 11) - 5));
    out.push(Math.round(v));
  }
  return out;
}

export default function App() {
  const [range, setRange] = useState("30d");
  const n = RANGES[range];
  const data = useMemo(() => series(n, n), [n]);
  const max = Math.max(...data);
  const total = data.reduce((a, b) => a + b, 0);
  const avg = Math.round(total / data.length);
  const last = data[data.length - 1];
  const prev = data[data.length - 2] || last;
  const delta = Math.round(((last - prev) / (prev || 1)) * 100);

  const stats = [
    { label: "Total", value: total.toLocaleString() },
    { label: "Average", value: avg.toString() },
    { label: "Peak", value: max.toString() },
    { label: "Change", value: (delta >= 0 ? "+" : "") + delta + "%" },
  ];

  return (
    <div className="min-h-screen w-full px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{TITLE}</h1>
        <div className="flex gap-1 rounded-lg bg-white/5 border border-white/10 p-1">
          {Object.keys(RANGES).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={"px-3 py-1 rounded-md text-sm transition " + (range === r ? "text-black" : "text-zinc-400")}
              style={range === r ? { background: ACCENT } : undefined}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">{s.label}</div>
            <div className="text-2xl font-semibold text-zinc-100 tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <div className="text-sm text-zinc-400 mb-4">Activity</div>
        <div className="flex items-end gap-1 h-48">
          {data.map((v, i) => (
            <div
              key={i}
              title={String(v)}
              className="flex-1 rounded-t transition-all"
              style={{ height: (v / max) * 100 + "%", background: i === data.length - 1 ? ACCENT : "rgba(255,255,255,0.14)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
`;
}
