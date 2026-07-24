import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0 focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
