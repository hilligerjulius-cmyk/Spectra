import { agentCatalog } from "@/server/agents/catalog";
import { registerCatalogPlaceholders } from "./tools";
// Seiteneffekt: registriert die connector-gestützten Tools (echte Implementierungen).
import "./tools-connectors";
// Seiteneffekt: registriert die plattforminternen Tools (ohne externe Zugangsdaten).
import "./tools-platform";
// Seiteneffekt: registriert die Fachwerkzeuge auf den eigenen Datenbeständen.
import "./tools-business";

/**
 * Initialisiert die Tool-Registry vollständig:
 * 1. Kern-Tools (tools.ts, beim Import registriert)
 * 2. Connector-Tools (tools-connectors.ts)
 * 3. Plattform-Tools (tools-platform.ts)
 * 4. Fachwerkzeuge (tools-business.ts)
 * 5. Platzhalter für alle übrigen im Katalog referenzierten Tools —
 *    diese werfen einen klaren Fehler statt Ergebnisse vorzutäuschen.
 */
const catalogToolKeys = [
  ...new Set(
    agentCatalog.flatMap((a) => a.capabilities.flatMap((c) => c.requiredTools)),
  ),
];

registerCatalogPlaceholders(catalogToolKeys);

export { catalogToolKeys };
