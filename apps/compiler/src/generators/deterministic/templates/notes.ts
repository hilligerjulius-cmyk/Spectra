import type { TemplateContext } from "../../../pipeline/types";

export function notesTemplate(ctx: TemplateContext): string {
  return `import { useState, useRef } from "react";

const ACCENT = ${JSON.stringify(ctx.accent)};
const TITLE = ${JSON.stringify(ctx.title)};

const SEED = [
  { id: 1, title: "Welcome", body: "This note materialized from your intent.\\nEdit me — everything is live." },
  { id: 2, title: "Ideas", body: "• zero-interface software\\n• fluid on-demand apps\\n• spectral prism identity" },
];

export default function App() {
  const [notes, setNotes] = useState(SEED);
  const [activeId, setActiveId] = useState(1);
  const uid = useRef(3);
  const active = notes.find((n) => n.id === activeId) || notes[0];

  const update = (patch) => setNotes((prev) => prev.map((n) => (n.id === activeId ? { ...n, ...patch } : n)));
  const add = () => {
    const id = uid.current++;
    setNotes((prev) => [{ id, title: "Untitled", body: "" }].concat(prev));
    setActiveId(id);
  };
  const remove = (id) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      if (id === activeId && next[0]) setActiveId(next[0].id);
      return next;
    });
  };

  return (
    <div className="min-h-screen w-full flex" style={{ height: "100vh" }}>
      <aside className="w-64 shrink-0 border-r border-white/10 p-3 flex flex-col">
        <div className="flex items-center justify-between px-2 mb-3">
          <span className="text-sm font-semibold text-zinc-200">{TITLE}</span>
          <button onClick={add} className="w-7 h-7 rounded-lg text-black flex items-center justify-center" style={{ background: ACCENT }}>+</button>
        </div>
        <div className="space-y-1 overflow-y-auto flex-1">
          {notes.map((n) => (
            <div
              key={n.id}
              onClick={() => setActiveId(n.id)}
              className={"group px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between " + (n.id === activeId ? "bg-white/10" : "hover:bg-white/5")}
            >
              <div className="min-w-0">
                <div className="text-sm text-zinc-200 truncate">{n.title || "Untitled"}</div>
                <div className="text-xs text-zinc-600 truncate">{n.body.split("\\n")[0] || "Empty"}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); remove(n.id); }} className="text-zinc-600 opacity-0 group-hover:opacity-100">✕</button>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 p-8">
        {active ? (
          <div className="max-w-2xl mx-auto">
            <input
              value={active.title}
              onChange={(e) => update({ title: e.target.value })}
              className="w-full bg-transparent outline-none text-3xl font-semibold text-zinc-100 mb-4"
              placeholder="Title"
            />
            <textarea
              value={active.body}
              onChange={(e) => update({ body: e.target.value })}
              className="w-full bg-transparent outline-none text-zinc-300 leading-relaxed resize-none"
              style={{ minHeight: "60vh" }}
              placeholder="Start writing…"
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-600">No note selected</div>
        )}
      </main>
    </div>
  );
}
`;
}
