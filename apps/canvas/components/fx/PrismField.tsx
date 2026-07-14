"use client";

import { memo } from "react";

/**
 * The ambient spectral backdrop — refracted light against the void. Pure CSS
 * (no WebGL): heavily-blurred radial blooms in the prism hues, drifting slowly,
 * plus a faint grid and vignette. Intensity dials up during materialization.
 */
export const PrismField = memo(function PrismField({ intensity = 1 }: { intensity?: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* faint grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--spectra-border-strong) 1px, transparent 1px), linear-gradient(90deg, var(--spectra-border-strong) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(circle at 50% 40%, black, transparent 75%)",
        }}
      />
      {/* spectral blooms */}
      <div
        className="absolute left-1/2 top-[38%] h-[60vmax] w-[60vmax] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] animate-aura-pulse"
        style={{
          background:
            "radial-gradient(circle, rgba(124,92,255,0.30), rgba(59,130,246,0.14) 45%, transparent 70%)",
          opacity: 0.5 * intensity + 0.25,
        }}
      />
      <div
        className="absolute left-[18%] top-[64%] h-[42vmax] w-[42vmax] rounded-full blur-[110px] animate-prism-drift"
        style={{
          background: "radial-gradient(circle, rgba(34,211,238,0.22), transparent 68%)",
          opacity: 0.5 * intensity + 0.2,
        }}
      />
      <div
        className="absolute right-[14%] top-[20%] h-[38vmax] w-[38vmax] rounded-full blur-[120px] animate-prism-drift"
        style={{
          background: "radial-gradient(circle, rgba(255,92,138,0.16), transparent 70%)",
          opacity: 0.4 * intensity + 0.15,
          animationDelay: "-6s",
        }}
      />
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, transparent 55%, rgba(0,0,0,0.55))" }}
      />
    </div>
  );
});
