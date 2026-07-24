import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 font-semibold tracking-tight",
        className,
      )}
    >
      <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
        W
      </span>
      <span>
        WORKFORCE <span className="text-primary">OS</span>
      </span>
    </Link>
  );
}
