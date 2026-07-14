import type { TemplateContext } from "../../../pipeline/types";

export function calculatorTemplate(ctx: TemplateContext): string {
  return `import { useState } from "react";

const ACCENT = ${JSON.stringify(ctx.accent)};
const TITLE = ${JSON.stringify(ctx.title)};

const KEYS = ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="];

export default function App() {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);

  const compute = (a, b, o) => {
    if (o === "+") return a + b;
    if (o === "−") return a - b;
    if (o === "×") return a * b;
    if (o === "÷") return b === 0 ? 0 : a / b;
    return b;
  };

  const press = (k) => {
    if (k === "C") { setDisplay("0"); setAcc(null); setOp(null); setFresh(true); return; }
    if (k === "±") { setDisplay((d) => (parseFloat(d) * -1).toString()); return; }
    if (k === "%") { setDisplay((d) => (parseFloat(d) / 100).toString()); return; }
    if (k === ".") { if (!display.includes(".")) setDisplay(display + "."); setFresh(false); return; }
    if (["+", "−", "×", "÷"].includes(k)) {
      setAcc(parseFloat(display)); setOp(k); setFresh(true); return;
    }
    if (k === "=") {
      if (op != null && acc != null) {
        const r = compute(acc, parseFloat(display), op);
        setDisplay(String(Math.round(r * 1e9) / 1e9)); setAcc(null); setOp(null); setFresh(true);
      }
      return;
    }
    // digit
    setDisplay((d) => (fresh || d === "0" ? k : d + k));
    setFresh(false);
  };

  const isOp = (k) => ["÷", "×", "−", "+", "="].includes(k);

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xs">
        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">{TITLE}</div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-4 text-right">
          <div className="text-5xl font-semibold text-zinc-100 tabular-nums truncate">{display}</div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className={"h-16 rounded-xl text-lg font-medium transition " + (k === "0" ? "col-span-2 " : "") + (isOp(k) ? "text-black" : "bg-white/5 border border-white/10 text-zinc-100")}
              style={isOp(k) ? { background: ACCENT } : undefined}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
`;
}
