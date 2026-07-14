/**
 * The runtime injected INTO the sandboxed iframe (as an inline module script).
 *
 * Responsibilities:
 *   1. Announce readiness to the parent.
 *   2. Receive a compiled ESM bundle, import it as a blob module, and render its
 *      default export inside a React error boundary.
 *   3. Report lifecycle + runtime errors + content height back over postMessage.
 *
 * `react` / `react-dom/client` bare specifiers resolve through the import map
 * declared in the srcdoc. The generated bundle's own `import`s resolve the same
 * way, so React identity is shared across the runtime and the mounted app.
 */
export const FRAME_RUNTIME_JS = /* js */ `
import React from "react";
import { createRoot } from "react-dom/client";

const PARENT = "spectra-parent";
const FRAME = "spectra-frame";

const post = (msg) => {
  try { parent.postMessage(Object.assign({ source: FRAME }, msg), "*"); } catch (_) {}
};

const reportError = (err) => {
  const message = err && err.message ? String(err.message) : String(err);
  const stack = err && err.stack ? String(err.stack) : undefined;
  post({ type: "error", message, stack });
};

window.addEventListener("error", (e) => reportError(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => reportError(e.reason));

// ── React error boundary so a faulty render can never escape the frame ──
class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { reportError(error); }
  render() {
    if (this.state.failed) {
      return React.createElement(
        "div",
        { style: { padding: "24px", fontFamily: "ui-monospace, monospace", color: "#fb7185", fontSize: "13px" } },
        "This materialization faulted at runtime."
      );
    }
    return this.props.children;
  }
}

let root = null;
let ro = null;

const observeHeight = (el) => {
  const report = () => {
    const h = Math.ceil(el.getBoundingClientRect().height || document.body.scrollHeight);
    if (h > 0) post({ type: "resize", height: h });
  };
  if (ro) ro.disconnect();
  ro = new ResizeObserver(() => requestAnimationFrame(report));
  ro.observe(el);
  requestAnimationFrame(report);
};

const mount = async (bundle) => {
  const el = document.getElementById("spectra-root");
  if (!el) return;
  try {
    const blob = new Blob([bundle], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const mod = await import(/* @vite-ignore */ url);
    URL.revokeObjectURL(url);
    const App = mod.default;
    if (typeof App !== "function") {
      throw new Error("Materialized module has no default React component export.");
    }
    if (!root) root = createRoot(el);
    root.render(React.createElement(Boundary, null, React.createElement(App)));
    // allow paint, then report
    requestAnimationFrame(() => {
      post({ type: "mounted" });
      observeHeight(el);
    });
  } catch (err) {
    reportError(err);
  }
};

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.source !== PARENT) return;
  if (data.type === "mount" && typeof data.bundle === "string") {
    mount(data.bundle);
  }
});

post({ type: "ready" });
`;
