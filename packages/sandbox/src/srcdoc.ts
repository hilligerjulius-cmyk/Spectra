import { cssVariableBlock } from "@spectra/design-tokens/css";
import { CDN, contentSecurityPolicy } from "./policy";
import { TAILWIND_FALLBACK_CSS } from "./tailwind-fallback";
import { FRAME_RUNTIME_JS } from "./frame-runtime";

/**
 * Build the complete HTML document loaded into the sandbox iframe via `srcdoc`.
 * The compiled bundle is NOT embedded here — it is delivered later over
 * postMessage — so nothing about the generated code needs HTML-escaping.
 */
export function buildSrcDoc(): string {
  const importMap = JSON.stringify({
    imports: {
      react: CDN.react,
      "react-dom": CDN.reactDomClient,
      "react-dom/client": CDN.reactDomClient,
      "react/jsx-runtime": CDN.jsxRuntime,
      "react/jsx-dev-runtime": CDN.jsxDevRuntime,
    },
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy()}" />
<script type="importmap">${importMap}</script>
<script src="${CDN.tailwind}"></script>
<style id="spectra-fallback">${TAILWIND_FALLBACK_CSS}</style>
<style id="spectra-tokens">
${cssVariableBlock(":root")}
html,body{height:auto;margin:0;background:var(--spectra-abyss);color:var(--spectra-text);
  font-family:var(--spectra-font-sans);-webkit-font-smoothing:antialiased;}
#spectra-root{min-height:0;}
::selection{background:var(--spectra-violet);color:#0a0a0c;}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:var(--spectra-border-strong);border-radius:9999px}
</style>
</head>
<body>
<div id="spectra-root"></div>
<script type="module">${FRAME_RUNTIME_JS}</script>
</body>
</html>`;
}
