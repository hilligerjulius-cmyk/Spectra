import { SSE_EVENT, type PhaseEvent } from "@spectra/contracts";

/** Format a phase event as a Server-Sent Events frame. */
export function formatSse(event: PhaseEvent): string {
  return `event: ${SSE_EVENT}\ndata: ${JSON.stringify(event)}\n\n`;
}
