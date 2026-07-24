"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { navSections } from "./nav";

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden w-56 justify-between text-muted-foreground sm:flex"
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-2">
          <SearchIcon className="size-3.5" />
          Suchen…
        </span>
        <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        aria-label="Suchen"
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Navigation">
        <CommandInput placeholder="Seite oder Aktion suchen…" />
        <CommandList>
          <CommandEmpty>Keine Treffer.</CommandEmpty>
          {navSections.map((section) => (
            <CommandGroup key={section.title} heading={section.title}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    setOpen(false);
                    router.push(item.href);
                  }}
                >
                  <item.icon />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
