/**
 * Sanitize an LLM completion into raw TSX. Models sometimes wrap output in
 * markdown fences or add a stray sentence despite instructions; we strip that
 * defensively before the source enters the validation loop.
 */
export function extractComponentSource(raw: string): string {
  let text = raw.trim();

  // Prefer a fenced code block if present.
  const fence = text.match(/```(?:tsx?|jsx?|javascript|typescript)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    text = fence[1].trim();
  }

  // Drop any leading lines before the first import/export if the model added prose.
  const firstCode = text.search(/^\s*(import|export|const|function)\b/m);
  if (firstCode > 0) {
    text = text.slice(firstCode);
  }

  return text.trim();
}
