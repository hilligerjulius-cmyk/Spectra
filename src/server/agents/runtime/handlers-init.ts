import { agentCatalog } from "@/server/agents/catalog";
import { registerArchetypeHandlers } from "./handlers-generic";

/**
 * Vervollständigt die Handler-Registry: Jede im Katalog beschriebene Fähigkeit
 * erhält den Handler ihres Archetyps, sofern nicht bereits ein vertiefter
 * agentenspezifischer Handler registriert wurde (handlers-core.ts wird zuerst
 * geladen). Damit läuft jeder Agent des Katalogs real — ohne dass für jede
 * Fähigkeit eigener Code entsteht.
 */
export const catalogCapabilityKeys = [
  ...new Set(agentCatalog.flatMap((a) => a.capabilities.map((c) => c.key))),
];

registerArchetypeHandlers(catalogCapabilityKeys);
