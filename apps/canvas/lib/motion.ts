import type { Transition, Variants } from "framer-motion";
import { spring, easing } from "@spectra/design-tokens";

/** Shared spring/easing transitions (typed for Framer Motion). */
export const springs = {
  base: spring.base as Transition,
  materialize: spring.materialize as Transition,
  snappy: spring.snappy as Transition,
};

type Bezier = [number, number, number, number];

export const ease = {
  spectra: [...easing.spectra] as Bezier,
  swift: [...easing.swift] as Bezier,
  refract: [...easing.refract] as Bezier,
};

/** Staggered container reveal. */
export const stagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const riseItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: ease.spectra } },
};

/** Fade + scale used when the canvas swaps between states. */
export const stateSwap: Variants = {
  initial: { opacity: 0, scale: 0.98, filter: "blur(6px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.5, ease: ease.spectra } },
  exit: { opacity: 0, scale: 1.01, filter: "blur(8px)", transition: { duration: 0.3, ease: ease.swift } },
};
