/** Full-bleed filmic grain, blended over everything for texture. */
export function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="grain pointer-events-none fixed inset-0 z-50 opacity-[0.05] mix-blend-overlay"
    />
  );
}
