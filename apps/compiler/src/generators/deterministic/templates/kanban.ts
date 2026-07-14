import type { TemplateContext } from "../../../pipeline/types";

export function kanbanTemplate(ctx: TemplateContext): string {
  return `import { useState, useRef } from "react";

const ACCENT = ${JSON.stringify(ctx.accent)};
const TITLE = ${JSON.stringify(ctx.title)};

const COLUMNS = [
  { id: "backlog", name: "Backlog" },
  { id: "progress", name: "In Progress" },
  { id: "done", name: "Done" },
];

const SEED = [
  { id: 1, col: "backlog", text: "Research spectral palette" },
  { id: 2, col: "backlog", text: "Define motion tokens" },
  { id: 3, col: "progress", text: "Build the morph theatre" },
  { id: 4, col: "done", text: "Ship the canvas" },
];

export default function App() {
  const [cards, setCards] = useState(SEED);
  const [dragId, setDragId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const uid = useRef(5);

  const move = (id, col) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, col } : c)));
  const add = (col) => {
    const text = (drafts[col] || "").trim();
    if (!text) return;
    setCards((prev) => prev.concat({ id: uid.current++, col, text }));
    setDrafts((d) => ({ ...d, [col]: "" }));
  };

  return (
    <div className="min-h-screen w-full px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 mb-6">{TITLE}</h1>
      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const list = cards.filter((c) => c.col === col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId != null && (move(dragId, col.id), setDragId(null))}
              className="rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col"
            >
              <div className="flex items-center justify-between px-1 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                  <span className="text-sm font-medium text-zinc-300">{col.name}</span>
                </div>
                <span className="text-xs text-zinc-600 tabular-nums">{list.length}</span>
              </div>
              <div className="space-y-2 flex-1">
                {list.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    className="px-3 py-3 rounded-xl bg-zinc-900 border border-white/10 text-sm text-zinc-200 cursor-grab active:cursor-grabbing shadow"
                  >
                    {c.text}
                  </div>
                ))}
              </div>
              <input
                value={drafts[col.id] || ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [col.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && add(col.id)}
                placeholder="+ Add card"
                className="mt-3 px-3 py-2 rounded-lg bg-transparent border border-white/10 outline-none text-sm text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
`;
}
