/**
 * Spectral Prism — color system.
 *
 * A near-black canvas holds a refracted light spectrum. The spectral gradient
 * (violet → blue → cyan) is the signature; it is used sparingly, for accent,
 * glow, and the materialization morph — never as a flat fill.
 */

/** Base near-black ramp — the void the spectrum refracts against. */
export const base = {
  /** The canvas floor. */
  void: "#08080A",
  /** Slightly lifted background regions. */
  abyss: "#0B0B0E",
  /** Elevated surface (cards, command bar). */
  surface: "#0E0E12",
  /** Higher elevation (popovers, mounted-app chrome). */
  raised: "#15151B",
  /** Highest elevation / hover. */
  overlay: "#1C1C24",
} as const;

/** Hairline borders and separators (alpha over the void). */
export const border = {
  faint: "rgba(255, 255, 255, 0.06)",
  subtle: "rgba(255, 255, 255, 0.09)",
  strong: "rgba(255, 255, 255, 0.14)",
} as const;

/** Text ramp. */
export const text = {
  primary: "#F5F5F7",
  secondary: "#A1A1AA",
  muted: "#71717A",
  faint: "#52525B",
  onAccent: "#0A0A0C",
} as const;

/**
 * The signature spectral stops. Ordered violet → blue → cyan.
 * Individual hues double as semantic accents.
 */
export const spectrum = {
  violet: "#7C5CFF",
  indigo: "#5B6CFF",
  blue: "#3B82F6",
  sky: "#2CA6F0",
  cyan: "#22D3EE",
} as const;

/** Extended prism used only for the ambient backdrop / aura. */
export const prism = {
  rose: "#FF5C8A",
  violet: "#7C5CFF",
  blue: "#3B82F6",
  cyan: "#22D3EE",
  mint: "#34E5C2",
} as const;

/** Primary accent (the one hue that stands in for the brand). */
export const accent = spectrum.violet;

/** Semantic status colors (kept cool to sit within the palette). */
export const status = {
  ok: "#34E5C2",
  warn: "#F5C451",
  error: "#FF6B6B",
  info: spectrum.sky,
} as const;

/** Canonical gradient strings. */
export const gradients = {
  /** The signature accent sweep. */
  signature: `linear-gradient(120deg, ${spectrum.violet} 0%, ${spectrum.blue} 52%, ${spectrum.cyan} 100%)`,
  /** Full prism sweep for ambient auras. */
  prism: `linear-gradient(120deg, ${prism.rose} 0%, ${prism.violet} 28%, ${prism.blue} 55%, ${prism.cyan} 78%, ${prism.mint} 100%)`,
  /** Radial glow for hero aura. */
  aura: `radial-gradient(60% 60% at 50% 40%, ${spectrum.violet}33 0%, ${spectrum.blue}1A 45%, transparent 78%)`,
} as const;

export const color = {
  base,
  border,
  text,
  spectrum,
  prism,
  accent,
  status,
  gradients,
} as const;

export type ColorTokens = typeof color;
