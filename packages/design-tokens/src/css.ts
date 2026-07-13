/**
 * Emit the Spectral Prism tokens as CSS custom properties.
 * Consumed by the canvas (globals) and injected into the sandbox srcdoc so the
 * mounted app frame is themed by the same source of truth.
 */

import { base, border, text, spectrum, accent, gradients, status } from "./color";
import { fontFamily } from "./typography";
import { radius } from "./radius";
import { shadow, blur } from "./shadow";

/** Flat record of `--spectra-*` custom properties. */
export function toCssVariables(): Record<string, string> {
  return {
    // surfaces
    "--spectra-void": base.void,
    "--spectra-abyss": base.abyss,
    "--spectra-surface": base.surface,
    "--spectra-raised": base.raised,
    "--spectra-overlay": base.overlay,
    // borders
    "--spectra-border-faint": border.faint,
    "--spectra-border-subtle": border.subtle,
    "--spectra-border-strong": border.strong,
    // text
    "--spectra-text": text.primary,
    "--spectra-text-secondary": text.secondary,
    "--spectra-text-muted": text.muted,
    "--spectra-text-faint": text.faint,
    "--spectra-text-on-accent": text.onAccent,
    // spectrum
    "--spectra-violet": spectrum.violet,
    "--spectra-indigo": spectrum.indigo,
    "--spectra-blue": spectrum.blue,
    "--spectra-sky": spectrum.sky,
    "--spectra-cyan": spectrum.cyan,
    "--spectra-accent": accent,
    // status
    "--spectra-ok": status.ok,
    "--spectra-warn": status.warn,
    "--spectra-error": status.error,
    // gradients
    "--spectra-gradient-signature": gradients.signature,
    "--spectra-gradient-prism": gradients.prism,
    "--spectra-gradient-aura": gradients.aura,
    // radius
    "--spectra-radius-sm": radius.sm,
    "--spectra-radius-md": radius.md,
    "--spectra-radius-lg": radius.lg,
    "--spectra-radius-xl": radius.xl,
    "--spectra-radius-2xl": radius["2xl"],
    "--spectra-radius-full": radius.full,
    // elevation
    "--spectra-shadow-md": shadow.md,
    "--spectra-shadow-lg": shadow.lg,
    "--spectra-shadow-glow": shadow.glow,
    "--spectra-blur-md": blur.md,
    "--spectra-blur-lg": blur.lg,
    // type
    "--spectra-font-sans": fontFamily.sans,
    "--spectra-font-mono": fontFamily.mono,
  };
}

/** Render the custom properties as a `:root { ... }` CSS block. */
export function cssVariableBlock(selector = ":root"): string {
  const vars = toCssVariables();
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}
