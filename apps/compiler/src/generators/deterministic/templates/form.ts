import type { TemplateContext } from "../../../pipeline/types";

export function formTemplate(ctx: TemplateContext): string {
  return `import { useState } from "react";

const ACCENT = ${JSON.stringify(ctx.accent)};
const TITLE = ${JSON.stringify(ctx.title)};

export default function App() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailOk = /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(form.email);
  const valid = form.name.trim().length > 1 && emailOk && form.message.trim().length > 4;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => { e.preventDefault(); setTouched(true); if (valid) setSent(true); };

  if (sent) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center text-2xl text-black" style={{ background: ACCENT }}>✓</div>
          <h2 className="text-2xl font-semibold text-zinc-100 mb-2">Message sent</h2>
          <p className="text-zinc-500 mb-6">Thanks, {form.name.split(" ")[0]}. We'll be in touch.</p>
          <button onClick={() => { setSent(false); setForm({ name: "", email: "", message: "" }); setTouched(false); }} className="text-sm text-zinc-400 underline">Send another</button>
        </div>
      </div>
    );
  }

  const field = (label, key, type) => (
    <label className="block">
      <span className="block text-sm text-zinc-400 mb-1.5">{label}</span>
      <input
        type={type || "text"}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border outline-none text-zinc-100"
        style={{ borderColor: touched && !form[key] ? "rgba(255,107,107,0.5)" : "rgba(255,255,255,0.1)" }}
      />
    </label>
  );

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 py-12">
      <form onSubmit={submit} className="w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 mb-1">{TITLE}</h1>
        <p className="text-zinc-500 mb-7">We usually reply within a day.</p>
        <div className="space-y-4">
          {field("Name", "name")}
          {field("Email", "email", "email")}
          <label className="block">
            <span className="block text-sm text-zinc-400 mb-1.5">Message</span>
            <textarea
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none text-zinc-100 resize-none"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={touched && !valid}
          className="w-full mt-6 py-3.5 rounded-xl font-medium text-black transition"
          style={{ background: ACCENT, opacity: touched && !valid ? 0.5 : 1 }}
        >
          Send message
        </button>
      </form>
    </div>
  );
}
`;
}
