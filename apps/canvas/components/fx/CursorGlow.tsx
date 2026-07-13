"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

/** A chromatic light that follows the cursor with a soft spring lag. */
export function CursorGlow() {
  const reduce = useReducedMotion();
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const sx = useSpring(x, { stiffness: 220, damping: 34, mass: 0.8 });
  const sy = useSpring(y, { stiffness: 220, damping: 34, mass: 0.8 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, x, y]);

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed -z-10 h-[520px] w-[520px] rounded-full"
      style={{
        left: sx,
        top: sy,
        translateX: "-50%",
        translateY: "-50%",
        background:
          "radial-gradient(circle, rgba(124,92,255,0.14), rgba(34,211,238,0.06) 40%, transparent 68%)",
        filter: "blur(24px)",
      }}
    />
  );
}
