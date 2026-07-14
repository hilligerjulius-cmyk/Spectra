import type { TemplateContext } from "../../../pipeline/types";

export function timerTemplate(ctx: TemplateContext): string {
  return `import { useState, useEffect, useRef } from "react";

const ACCENT = ${JSON.stringify(ctx.accent)};
const TITLE = ${JSON.stringify(ctx.title)};

const PRESETS = [
  { label: "Focus", secs: 25 * 60 },
  { label: "Short", secs: 5 * 60 },
  { label: "Long", secs: 15 * 60 },
];

export default function App() {
  const [total, setTotal] = useState(PRESETS[0].secs);
  const [left, setLeft] = useState(PRESETS[0].secs);
  const [running, setRunning] = useState(false);
  const tick = useRef(null);

  useEffect(() => {
    if (running) {
      tick.current = setInterval(() => {
        setLeft((l) => {
          if (l <= 1) { setRunning(false); return 0; }
          return l - 1;
        });
      }, 1000);
    }
    return () => tick.current && clearInterval(tick.current);
  }, [running]);

  const choose = (secs) => { setTotal(secs); setLeft(secs); setRunning(false); };
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const pct = total ? left / total : 0;
  const R = 120;
  const C = 2 * Math.PI * R;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-12">
      <div className="text-xs uppercase tracking-widest text-zinc-500 mb-8">{TITLE}</div>
      <div className="relative" style={{ width: 300, height: 300 }}>
        <svg width="300" height="300" className="-rotate-90">
          <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            cx="150" cy="150" r={R} fill="none" stroke={ACCENT} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl font-semibold text-zinc-100 tabular-nums">{mm}:{ss}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-10">
        <button
          onClick={() => setRunning((r) => !r)}
          className="px-8 py-3 rounded-xl font-medium text-black"
          style={{ background: ACCENT }}
        >
          {running ? "Pause" : "Start"}
        </button>
        <button
          onClick={() => choose(total)}
          className="px-6 py-3 rounded-xl font-medium text-zinc-200 bg-white/5 border border-white/10"
        >
          Reset
        </button>
      </div>

      <div className="flex gap-2 mt-6">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => choose(p.secs)}
            className={"px-4 py-1.5 rounded-lg text-sm transition " + (total === p.secs ? "bg-white/10 text-zinc-100" : "text-zinc-500")}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
`;
}
