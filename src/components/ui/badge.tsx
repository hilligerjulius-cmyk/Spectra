import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        active:
          "border-transparent bg-status-active/12 text-status-active",
        paused:
          "border-transparent bg-status-paused/12 text-status-paused",
        warning:
          "border-transparent bg-status-warning/12 text-status-warning",
        error: "border-transparent bg-status-error/12 text-status-error",
        approval:
          "border-transparent bg-status-approval/12 text-status-approval",
        demo: "border-dashed border-status-warning text-status-warning",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
