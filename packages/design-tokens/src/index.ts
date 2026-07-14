import { color } from "./color";
import { typography } from "./typography";
import { space } from "./space";
import { radius } from "./radius";
import { shadow, blur } from "./shadow";
import { motion } from "./motion";

export * from "./color";
export * from "./typography";
export * from "./space";
export * from "./radius";
export * from "./shadow";
export * from "./motion";
export { toCssVariables, cssVariableBlock } from "./css";

/** The complete Spectral Prism token set. */
export const tokens = {
  color,
  typography,
  space,
  radius,
  shadow,
  blur,
  motion,
} as const;

export type Tokens = typeof tokens;
