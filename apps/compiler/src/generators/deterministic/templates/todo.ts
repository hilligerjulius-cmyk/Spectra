import type { TemplateContext } from "../../../pipeline/types";

export function todoTemplate(ctx: TemplateContext): string {
  return `import { useState, useRef } from "react";

const ACCENT = ${JSON.stringify(ctx.accent)};
const TITLE = ${JSON.stringify(ctx.title)};

const SEED = [
  { id: 1, text: "Materialize a new idea", done: true },
  { id: 2, text: "Refine the details", done: false },
  { id: 3, text: "Ship it", done: false },
];

export default function App() {
  const [items, setItems] = useState(SEED);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("all");
  const uid = useRef(4);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setItems((prev) => prev.concat({ id: uid.current++, text, done: false }));
    setDraft("");
  };
  const toggle = (id) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  const visible = items.filter((i) => (filter === "all" ? true : filter === "active" ? !i.done : i.done));
  const left = items.filter((i) => !i.done).length;

  return (
    <div className="min-h-screen w-full px-6 py-12 flex justify-center">
      <div className="w-full max-w-lg">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{TITLE}</h1>
          <span className="text-sm text-zinc-500 tabular-nums">{left} left</span>
        </div>

        <div className="flex gap-2 mb-5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add a task…"
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            onClick={add}
            className="px-4 py-3 rounded-xl font-medium text-black"
            style={{ background: ACCENT }}
          >
            Add
          </button>
        </div>

        <div className="flex gap-1 mb-4">
          {["all", "active", "done"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={"px-3 py-1.5 rounded-lg text-sm capitalize transition " + (filter === f ? "bg-white/10 text-zinc-100" : "text-zinc-500")}
            >
              {f}
            </button>
          ))}
        </div>

        <ul className="space-y-2">
          {visible.map((i) => (
            <li key={i.id} className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <button
                onClick={() => toggle(i.id)}
                className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0"
                style={{ borderColor: i.done ? ACCENT : "rgba(255,255,255,0.25)", background: i.done ? ACCENT : "transparent" }}
                aria-label="toggle"
              >
                {i.done ? <span className="text-black text-xs">✓</span> : null}
              </button>
              <span className={"flex-1 " + (i.done ? "line-through text-zinc-600" : "text-zinc-200")}>{i.text}</span>
              <button onClick={() => remove(i.id)} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition">✕</button>
            </li>
          ))}
          {visible.length === 0 ? <li className="text-center text-zinc-600 py-8 text-sm">Nothing here yet.</li> : null}
        </ul>
      </div>
    </div>
  );
}
`;
}
