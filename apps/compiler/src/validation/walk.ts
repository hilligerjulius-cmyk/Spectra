/**
 * A tiny, dependency-free AST walker over the @babel/parser output. We avoid
 * @babel/traverse (and its ESM interop quirks) — for a security allow/deny
 * visitor a plain recursive walk is clearer and has no runtime footprint.
 */

export interface AstNode {
  type: string;
  [key: string]: unknown;
}

const SKIP_KEYS = new Set([
  "loc",
  "start",
  "end",
  "range",
  "leadingComments",
  "trailingComments",
  "innerComments",
  "comments",
  "tokens",
  "extra",
]);

function isNode(value: unknown): value is AstNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

/** Depth-first walk. `visit` is called for every AST node encountered. */
export function walk(root: unknown, visit: (node: AstNode, parent: AstNode | null) => void): void {
  const stack: Array<{ node: unknown; parent: AstNode | null }> = [{ node: root, parent: null }];
  while (stack.length) {
    const { node, parent } = stack.pop()!;
    if (Array.isArray(node)) {
      for (const child of node) stack.push({ node: child, parent });
      continue;
    }
    if (!isNode(node)) continue;
    visit(node, parent);
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = node[key];
      if (Array.isArray(value) || isNode(value)) {
        stack.push({ node: value, parent: node });
      }
    }
  }
}
