"use client";

/**
 * Auswahl-Chips für Assistenten (Konfigurator, Einrichtung).
 * Als Buttons mit `aria-pressed` umgesetzt, damit die Auswahl auch mit
 * Tastatur und Screenreader bedienbar ist.
 */

export interface ChipOption {
  key: string;
  label: string;
}

const base =
  "rounded-full border px-3.5 py-1.5 text-sm transition-colors cursor-pointer";
const activeClass = "border-primary bg-primary/10 font-medium text-primary";
const inactiveClass =
  "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground";

export function MultiChips({
  options,
  selected,
  onToggle,
}: {
  options: ChipOption[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.key);
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(opt.key)}
            className={`${base} ${active ? activeClass : inactiveClass}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SingleChips({
  options,
  selected,
  onSelect,
}: {
  options: readonly string[] | ChipOption[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const normalized: ChipOption[] = options.map((o) =>
    typeof o === "string" ? { key: o, label: o } : o,
  );
  return (
    <div className="flex flex-wrap gap-2">
      {normalized.map((opt) => (
        <button
          key={opt.key}
          type="button"
          aria-pressed={selected === opt.key}
          onClick={() => onSelect(opt.key)}
          className={`${base} ${selected === opt.key ? activeClass : inactiveClass}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
