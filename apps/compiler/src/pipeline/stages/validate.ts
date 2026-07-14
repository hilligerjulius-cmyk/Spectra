import type { ValidateResult } from "../types";
import { enforceContract } from "../../validation/contract";
import { enforcePolicy } from "../../validation/ast-policy";

/**
 * Static validation: the component contract (single default export, React-only
 * imports) plus the security policy (no eval/network/storage/dynamic-import).
 * Both parse independently so a syntax error surfaces here before esbuild runs.
 */
export function validateSource(source: string): ValidateResult {
  const contract = enforceContract(source);
  const policy = enforcePolicy(source);
  const errors = [...contract.errors, ...policy.errors];
  return { ok: errors.length === 0, errors };
}
