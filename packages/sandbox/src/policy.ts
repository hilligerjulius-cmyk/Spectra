/**
 * Isolation policy for the Mounting Sandbox.
 *
 * Generated code runs inside an <iframe> that is deliberately *not* granted
 * `allow-same-origin`, so it executes at a null origin: no access to the
 * parent DOM, our cookies, storage, or session. `allow-scripts` is the only
 * capability it needs to render. A strict CSP is layered on top as defense in
 * depth (the server-side AST policy is the third layer).
 */

/** Pinned React runtime (ESM) served to the frame via an import map. */
export const REACT_VERSION = "18.3.1";

export const CDN = {
  react: `https://esm.sh/react@${REACT_VERSION}`,
  reactDomClient: `https://esm.sh/react-dom@${REACT_VERSION}/client`,
  jsxRuntime: `https://esm.sh/react@${REACT_VERSION}/jsx-runtime`,
  jsxDevRuntime: `https://esm.sh/react@${REACT_VERSION}/jsx-dev-runtime`,
  tailwind: "https://cdn.tailwindcss.com",
} as const;

/**
 * The `sandbox` attribute value for the iframe. Intentionally omits
 * `allow-same-origin`. `allow-scripts` runs the app; `allow-forms` and
 * `allow-modals` let generated UIs use native inputs/dialogs.
 */
export const IFRAME_SANDBOX = "allow-scripts allow-forms allow-modals allow-popups";

/** Content-Security-Policy applied inside the frame document. */
export function contentSecurityPolicy(): string {
  const esm = "https://esm.sh";
  const tw = "https://cdn.tailwindcss.com";
  return [
    `default-src 'none'`,
    // Tailwind Play CDN evaluates config; the frame runtime is inline; blob: for the compiled module.
    `script-src 'unsafe-inline' 'unsafe-eval' blob: ${esm} ${tw}`,
    `style-src 'unsafe-inline' ${tw}`,
    `font-src data: ${esm}`,
    `img-src data: blob: https:`,
    `connect-src ${esm}`,
    `frame-src 'none'`,
    `base-uri 'none'`,
    `form-action 'none'`,
  ].join("; ");
}
