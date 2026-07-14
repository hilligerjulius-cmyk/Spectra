/**
 * A compact subset of Tailwind utilities, vendored as a string and always
 * injected into the frame. When the Tailwind Play CDN is reachable it takes
 * over with full JIT; when it is not (offline), this keeps generated apps
 * legible and correctly laid out. Deterministic templates are authored to
 * lean on the classes covered here.
 */
export const TAILWIND_FALLBACK_CSS = `
*,*::before,*::after{box-sizing:border-box;border:0 solid rgba(255,255,255,.1)}
html,body{margin:0}
/* layout */
.block{display:block}.inline-block{display:inline-block}.inline{display:inline}.hidden{display:none}
.flex{display:flex}.inline-flex{display:inline-flex}.grid{display:grid}
.flex-col{flex-direction:column}.flex-row{flex-direction:row}.flex-wrap{flex-wrap:wrap}
.flex-1{flex:1 1 0%}.flex-none{flex:none}.grow{flex-grow:1}.shrink-0{flex-shrink:0}
.items-center{align-items:center}.items-start{align-items:flex-start}.items-end{align-items:flex-end}.items-stretch{align-items:stretch}
.justify-center{justify-content:center}.justify-between{justify-content:space-between}.justify-start{justify-content:flex-start}.justify-end{justify-content:flex-end}.justify-around{justify-content:space-around}
.self-center{align-self:center}.self-start{align-self:flex-start}
.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.gap-1{gap:4px}.gap-2{gap:8px}.gap-3{gap:12px}.gap-4{gap:16px}.gap-5{gap:20px}.gap-6{gap:24px}.gap-8{gap:32px}
.relative{position:relative}.absolute{position:absolute}.fixed{position:fixed}.sticky{position:sticky}
.inset-0{inset:0}.top-0{top:0}.right-0{right:0}.bottom-0{bottom:0}.left-0{left:0}
.overflow-hidden{overflow:hidden}.overflow-auto{overflow:auto}.overflow-y-auto{overflow-y:auto}
/* sizing */
.w-full{width:100%}.w-screen{width:100vw}.w-auto{width:auto}.w-fit{width:fit-content}.w-1\\/2{width:50%}
.w-6{width:24px}.w-8{width:32px}.w-10{width:40px}.w-12{width:48px}.w-16{width:64px}.w-24{width:96px}
.h-full{height:100%}.h-screen{height:100vh}.h-auto{height:auto}.min-h-screen{min-height:100vh}
.h-1{height:4px}.h-2{height:8px}.h-6{height:24px}.h-8{height:32px}.h-10{height:40px}.h-12{height:48px}.h-16{height:64px}
.max-w-md{max-width:28rem}.max-w-lg{max-width:32rem}.max-w-xl{max-width:36rem}.max-w-2xl{max-width:42rem}.max-w-4xl{max-width:56rem}.mx-auto{margin-left:auto;margin-right:auto}
/* spacing */
.p-1{padding:4px}.p-2{padding:8px}.p-3{padding:12px}.p-4{padding:16px}.p-5{padding:20px}.p-6{padding:24px}.p-8{padding:32px}
.px-2{padding-left:8px;padding-right:8px}.px-3{padding-left:12px;padding-right:12px}.px-4{padding-left:16px;padding-right:16px}.px-5{padding-left:20px;padding-right:20px}.px-6{padding-left:24px;padding-right:24px}
.py-1{padding-top:4px;padding-bottom:4px}.py-2{padding-top:8px;padding-bottom:8px}.py-3{padding-top:12px;padding-bottom:12px}.py-4{padding-top:16px;padding-bottom:16px}.py-6{padding-top:24px;padding-bottom:24px}
.mt-1{margin-top:4px}.mt-2{margin-top:8px}.mt-4{margin-top:16px}.mt-6{margin-top:24px}.mb-1{margin-bottom:4px}.mb-2{margin-bottom:8px}.mb-4{margin-bottom:16px}.mb-6{margin-bottom:24px}
.ml-auto{margin-left:auto}.mr-2{margin-right:8px}
.space-y-2>*+*{margin-top:8px}.space-y-3>*+*{margin-top:12px}.space-y-4>*+*{margin-top:16px}
/* type */
.text-xs{font-size:12px}.text-sm{font-size:13px}.text-base{font-size:15px}.text-lg{font-size:18px}.text-xl{font-size:22px}.text-2xl{font-size:28px}.text-3xl{font-size:34px}.text-4xl{font-size:44px}
.font-normal{font-weight:400}.font-medium{font-weight:500}.font-semibold{font-weight:600}.font-bold{font-weight:700}
.text-center{text-align:center}.text-left{text-align:left}.text-right{text-align:right}
.uppercase{text-transform:uppercase}.tracking-tight{letter-spacing:-.02em}.tracking-wide{letter-spacing:.05em}.tracking-widest{letter-spacing:.15em}
.leading-tight{line-height:1.15}.leading-normal{line-height:1.5}.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tabular-nums{font-variant-numeric:tabular-nums}.font-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.line-through{text-decoration:line-through}.italic{font-style:italic}
/* color */
.text-white{color:#fff}.text-black{color:#000}
.text-zinc-100{color:#f4f4f5}.text-zinc-200{color:#e4e4e7}.text-zinc-300{color:#d4d4d8}.text-zinc-400{color:#a1a1aa}.text-zinc-500{color:#71717a}.text-zinc-600{color:#52525b}
.text-violet-300{color:#c4b5fd}.text-violet-400{color:#a78bfa}.text-cyan-300{color:#67e8f9}.text-cyan-400{color:#22d3ee}.text-blue-400{color:#60a5fa}
.text-emerald-400{color:#34d399}.text-rose-400{color:#fb7185}.text-amber-400{color:#fbbf24}
.bg-transparent{background:transparent}.bg-white{background:#fff}.bg-black{background:#000}
.bg-zinc-800{background:#27272a}.bg-zinc-900{background:#18181b}.bg-zinc-950{background:#09090b}
.bg-violet-500{background:#8b5cf6}.bg-violet-600{background:#7c3aed}.bg-blue-500{background:#3b82f6}.bg-cyan-500{background:#06b6d4}.bg-emerald-500{background:#10b981}.bg-rose-500{background:#f43f5e}.bg-amber-500{background:#f59e0b}
.bg-white\\/5{background:rgba(255,255,255,.05)}.bg-white\\/10{background:rgba(255,255,255,.1)}
/* border / radius / shadow */
.border{border-width:1px}.border-2{border-width:2px}.border-t{border-top-width:1px}.border-b{border-bottom-width:1px}
.border-zinc-700{border-color:#3f3f46}.border-zinc-800{border-color:#27272a}.border-white\\/10{border-color:rgba(255,255,255,.1)}.border-violet-500{border-color:#8b5cf6}
.rounded{border-radius:6px}.rounded-md{border-radius:8px}.rounded-lg{border-radius:12px}.rounded-xl{border-radius:16px}.rounded-2xl{border-radius:20px}.rounded-full{border-radius:9999px}
.shadow{box-shadow:0 1px 3px rgba(0,0,0,.4)}.shadow-lg{box-shadow:0 12px 32px -8px rgba(0,0,0,.6)}.shadow-xl{box-shadow:0 24px 60px -12px rgba(0,0,0,.7)}
/* effects */
.opacity-0{opacity:0}.opacity-50{opacity:.5}.opacity-60{opacity:.6}.opacity-70{opacity:.7}
.cursor-pointer{cursor:pointer}.select-none{user-select:none}.appearance-none{appearance:none}.outline-none{outline:none}
.transition{transition:all .2s ease}.transition-colors{transition:color .2s,background-color .2s,border-color .2s}.duration-200{transition-duration:.2s}
.backdrop-blur{backdrop-filter:blur(8px)}
/* hover — approximated (no JIT) */
button{cursor:pointer;font:inherit}
input,textarea,select{font:inherit;color:inherit;background:transparent}
`;
