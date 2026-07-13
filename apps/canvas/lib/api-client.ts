import { SSE_EVENT, type MaterializeRequest, type PhaseEvent } from "@spectra/contracts";

export interface StreamHandlers {
  onEvent: (event: PhaseEvent) => void;
  signal?: AbortSignal;
}

/**
 * POST an intent to the same-origin proxy and consume the SSE phase stream.
 * Parses `event:`/`data:` frames incrementally from the fetch body reader.
 */
export async function materializeStream(
  request: MaterializeRequest,
  { onEvent, signal }: StreamHandlers,
): Promise<void> {
  const res = await fetch("/api/materialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Materialize request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      dispatchFrame(frame, onEvent);
    }
  }
}

function dispatchFrame(frame: string, onEvent: (e: PhaseEvent) => void): void {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue; // comment / keep-alive
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (eventName !== SSE_EVENT || dataLines.length === 0) return;
  try {
    onEvent(JSON.parse(dataLines.join("\n")) as PhaseEvent);
  } catch {
    /* ignore malformed frame */
  }
}
