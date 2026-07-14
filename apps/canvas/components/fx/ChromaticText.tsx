import type { ReactNode } from "react";

/** Display text with a subtle RGB chromatic-aberration split behind the fill. */
export function ChromaticText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span className={"chroma " + className} data-text={text}>
      {text}
    </span>
  );
}
