"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { departmentList } from "@/server/agents/catalog/departments";

const priceTiers = [
  { value: "simple", label: "Einfach (149 €)" },
  { value: "advanced", label: "Fortgeschritten (349 €)" },
  { value: "complex", label: "Komplex (699 €)" },
  { value: "chief", label: "Chief of Staff (999 €)" },
];

const setupEfforts = [
  { value: "low", label: "Gering" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" },
];

export function MarketplaceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters =
    searchParams.has("department") ||
    searchParams.has("preis") ||
    searchParams.has("aufwand");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={searchParams.get("department") ?? "all"}
        onValueChange={(v) => setParam("department", v)}
      >
        <SelectTrigger className="w-56" aria-label="Nach Department filtern">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Departments</SelectItem>
          {departmentList.map((d) => (
            <SelectItem key={d.slug} value={d.slug}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("preis") ?? "all"}
        onValueChange={(v) => setParam("preis", v)}
      >
        <SelectTrigger className="w-52" aria-label="Nach Preis filtern">
          <SelectValue placeholder="Preis" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Preisstufen</SelectItem>
          {priceTiers.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("aufwand") ?? "all"}
        onValueChange={(v) => setParam("aufwand", v)}
      >
        <SelectTrigger className="w-48" aria-label="Nach Einrichtungsaufwand filtern">
          <SelectValue placeholder="Einrichtungsaufwand" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Jeder Aufwand</SelectItem>
          {setupEfforts.map((e) => (
            <SelectItem key={e.value} value={e.value}>
              Einrichtung: {e.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          Filter zurücksetzen
        </Button>
      ) : null}
    </div>
  );
}
