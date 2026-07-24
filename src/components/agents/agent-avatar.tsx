import { cn } from "@/lib/utils";

/** Initialen-Avatar mit Department-Akzentfarbe. */
export function AgentAvatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
  };
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white",
        color,
        sizeClasses[size],
        className,
      )}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
