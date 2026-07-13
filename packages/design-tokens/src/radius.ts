/** Spectral Prism — corner radii. Soft, generous, modern. */

export const radius = {
  none: "0px",
  sm: "6px",
  md: "10px",
  lg: "14px",
  xl: "20px",
  "2xl": "28px",
  "3xl": "36px",
  full: "9999px",
} as const;

export type RadiusTokens = typeof radius;
