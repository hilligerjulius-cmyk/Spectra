/** Spectral Prism — elevation & glow. Layered ambient shadow + spectral bloom. */

import { spectrum } from "./color";

export const shadow = {
  /** Subtle lift for surfaces. */
  sm: "0 1px 2px rgba(0,0,0,0.4)",
  /** Cards / command bar. */
  md: "0 8px 24px -8px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.4)",
  /** Elevated popovers / mounted frame. */
  lg: "0 24px 64px -16px rgba(0,0,0,0.7), 0 8px 24px -8px rgba(0,0,0,0.5)",
  /** Signature spectral glow (violet). */
  glow: `0 0 0 1px ${spectrum.violet}22, 0 12px 48px -12px ${spectrum.violet}55`,
  /** Cyan-edged focus glow. */
  glowCyan: `0 0 0 1px ${spectrum.cyan}33, 0 8px 32px -8px ${spectrum.cyan}44`,
  /** Inner hairline for glass surfaces. */
  inset: "inset 0 1px 0 0 rgba(255,255,255,0.05)",
} as const;

export const blur = {
  sm: "8px",
  md: "16px",
  lg: "40px",
  xl: "80px",
} as const;

export type ShadowTokens = typeof shadow;
export type BlurTokens = typeof blur;
