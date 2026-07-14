/**
 * Spectral Prism — motion. One shared vocabulary of springs, easings and
 * durations so Framer Motion (canvas) and CSS keyframes (morph / sandbox)
 * feel like a single system.
 */

/** Cubic-bezier easings. */
export const easing = {
  /** Standard entrance/exit — expressive but controlled. */
  spectra: [0.22, 1, 0.36, 1] as const,
  /** Snappy in-out for micro-interactions. */
  swift: [0.4, 0, 0.2, 1] as const,
  /** Anticipatory ease for the morph. */
  refract: [0.7, 0, 0.2, 1] as const,
} as const;

/** Named spring configs (Framer Motion `transition`). */
export const spring = {
  /** Default UI spring. */
  base: { type: "spring", stiffness: 220, damping: 30, mass: 1 } as const,
  /** Gentle, heavy — used for the materialization scale-in. */
  materialize: { type: "spring", stiffness: 140, damping: 24, mass: 1.1 } as const,
  /** Tight, responsive — magnetic buttons, cursor glow. */
  snappy: { type: "spring", stiffness: 400, damping: 34, mass: 0.8 } as const,
} as const;

/** Durations in milliseconds. */
export const duration = {
  instant: 120,
  fast: 200,
  base: 320,
  slow: 520,
  morph: 900,
  ambient: 12000,
} as const;

export const motion = { easing, spring, duration } as const;

export type MotionTokens = typeof motion;
