import type { z } from "zod";
import type { AITaskType, AI_TASKS } from "./schemas";

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  /** Kosten in Zehntel-Cent. */
  costDeciCents: number;
  model: string;
}

export interface AITaskRequest<T extends AITaskType> {
  taskType: T;
  /** Nutzdaten — werden strikt als Daten behandelt, nie als Anweisung. */
  input: string;
  /** Zusätzlicher Kontext (z. B. Tonalität, Agentenrolle). */
  context?: string;
  /** Modell-Override (sonst Default des Providers). */
  model?: string;
}

export type AITaskResult<T extends AITaskType> = {
  data: z.infer<(typeof AI_TASKS)[T]["schema"]>;
  usage: AIUsage;
};

export interface AIProvider {
  readonly name: string;
  /** true = echte LLM-Aufrufe; false = deterministischer Demo-Provider. */
  readonly isReal: boolean;
  run<T extends AITaskType>(req: AITaskRequest<T>): Promise<AITaskResult<T>>;
}
