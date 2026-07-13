/**
 * The component contract: a materialized module must be a single, self-contained
 * React component. Exactly one default export, imports only from the React
 * runtime, and no CommonJS. This is what lets the Mounting Sandbox load the
 * bundle blind and know it will find a default component to render.
 */
import { parse } from "@babel/parser";
import { walk, type AstNode } from "./walk";

const ALLOWED_IMPORTS = new Set([
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
]);

export interface ContractResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export function enforceContract(source: string): ContractResult {
  const errors: string[] = [];
  let ast: AstNode;
  try {
    ast = parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    }) as unknown as AstNode;
  } catch (err) {
    return { ok: false, errors: [`Parse error: ${(err as Error).message}`] };
  }

  let defaultExports = 0;

  walk(ast, (node) => {
    if (node.type === "ImportDeclaration") {
      const src = (node.source as AstNode | undefined)?.value as string | undefined;
      if (src && !ALLOWED_IMPORTS.has(src)) {
        errors.push(`Import from "${src}" is not allowed; only the React runtime may be imported.`);
      }
    }
    if (node.type === "ExportDefaultDeclaration") {
      defaultExports += 1;
    }
    if (node.type === "ExportAllDeclaration") {
      errors.push(`"export *" is not allowed in a materialized component.`);
    }
  });

  if (defaultExports === 0) {
    errors.push("Missing a default export — the module must default-export one React component.");
  }
  if (defaultExports > 1) {
    errors.push("Multiple default exports found — exactly one is required.");
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
