/**
 * The AST security policy — the *third* isolation layer (after the null-origin
 * iframe and the CSP). It parses the candidate and rejects code that reaches
 * for capabilities a materialized app must never have: eval, the Function
 * constructor, dynamic import, network, or persistent/cross-frame storage.
 */
import { parse } from "@babel/parser";
import { walk, type AstNode } from "./walk";

/** Globals that may never be invoked/constructed. */
const FORBIDDEN_CALLEES = new Set([
  "eval",
  "Function",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts",
  "require",
]);

/** Member properties that may never be accessed. */
const FORBIDDEN_PROPS = new Set([
  "cookie",
  "localStorage",
  "sessionStorage",
  "indexedDB",
]);

/** Cross-frame escape hatches, only forbidden off a window-like object. */
const FRAME_PROPS = new Set(["parent", "top", "opener", "frames"]);
const WINDOW_OBJECTS = new Set(["window", "globalThis", "self", "top", "parent"]);

/** Bare identifiers that must not be referenced as an object. */
const FORBIDDEN_OBJECTS = new Set(["localStorage", "sessionStorage", "indexedDB"]);

export interface PolicyResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

function calleeName(node: AstNode): string | null {
  const callee = node.callee as AstNode | undefined;
  if (!callee) return null;
  if (callee.type === "Identifier") return callee.name as string;
  return null;
}

/** Parse and enforce the policy. A parse failure is itself a violation. */
export function enforcePolicy(source: string): PolicyResult {
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

  walk(ast, (node) => {
    // dynamic import()
    if (node.type === "CallExpression") {
      const callee = node.callee as AstNode | undefined;
      if (callee?.type === "Import") {
        errors.push("Dynamic import() is not permitted in materialized apps.");
      }
      const name = calleeName(node);
      if (name && FORBIDDEN_CALLEES.has(name)) {
        errors.push(`Call to forbidden global "${name}()" is not permitted.`);
      }
    }
    if (node.type === "NewExpression") {
      const name = calleeName(node);
      if (name && FORBIDDEN_CALLEES.has(name)) {
        errors.push(`Construction of forbidden global "new ${name}()" is not permitted.`);
      }
    }
    // member access: x.cookie / x.localStorage / window.parent
    if (node.type === "MemberExpression" && !node.computed) {
      const prop = node.property as AstNode | undefined;
      const obj = node.object as AstNode | undefined;
      const propName = prop?.type === "Identifier" ? (prop.name as string) : undefined;
      if (propName && FORBIDDEN_PROPS.has(propName)) {
        errors.push(`Access to "${propName}" is not permitted.`);
      }
      if (
        propName &&
        FRAME_PROPS.has(propName) &&
        obj?.type === "Identifier" &&
        WINDOW_OBJECTS.has(obj.name as string)
      ) {
        errors.push(`Cross-frame access to "${propName}" is not permitted.`);
      }
    }
    // bare identifier object: localStorage.getItem(...)
    if (
      node.type === "MemberExpression" &&
      (node.object as AstNode | undefined)?.type === "Identifier" &&
      FORBIDDEN_OBJECTS.has(((node.object as AstNode).name as string) ?? "")
    ) {
      errors.push(`Reference to storage global is not permitted.`);
    }
  });

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
