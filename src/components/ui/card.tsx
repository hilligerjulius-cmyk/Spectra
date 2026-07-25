import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-5", className)}
      {...props}
    />
  );
}

/**
 * Kartentitel. Standardmäßig ein `div`, weil eine Karte im Seitenkontext
 * meist keine eigene Gliederungsebene bildet.
 *
 * Über `as` lässt sich ein echtes Überschriftenelement wählen. Das ist dort
 * nötig, wo die Karte den Hauptinhalt der Seite trägt — Anmeldung und
 * Registrierung etwa. Ohne `h1` fehlt Screenreadern und der
 * Dokumentgliederung der Einstiegspunkt.
 */
function CardTitle({
  className,
  as: Component = "div",
  ...props
}: React.ComponentProps<"div"> & { as?: "div" | "h1" | "h2" | "h3" }) {
  return (
    <Component
      data-slot="card-title"
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-5 pt-0", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center p-5 pt-0", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
