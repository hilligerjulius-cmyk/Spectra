/** Spectral Prism — typography. Geist for UI, Geist Mono for signals. */

export const fontFamily = {
  sans: `"Geist", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`,
  mono: `"Geist Mono", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace`,
} as const;

/** Fluid type scale using clamp() — display sizes breathe with the viewport. */
export const fontSize = {
  micro: "0.6875rem", // 11px
  xs: "0.75rem", // 12px
  sm: "0.8125rem", // 13px
  base: "0.9375rem", // 15px
  md: "1rem", // 16px
  lg: "1.125rem", // 18px
  xl: "1.375rem", // 22px
  "2xl": "1.75rem", // 28px
  display: "clamp(2.75rem, 6vw, 4.75rem)",
  hero: "clamp(3.5rem, 9vw, 8rem)",
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const letterSpacing = {
  tighter: "-0.04em",
  tight: "-0.02em",
  normal: "0em",
  wide: "0.04em",
  wider: "0.12em",
} as const;

export const lineHeight = {
  none: "1",
  tight: "1.1",
  snug: "1.3",
  normal: "1.55",
} as const;

export const typography = {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
} as const;

export type TypographyTokens = typeof typography;
