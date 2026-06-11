import fastJsonPatch, { type Operation } from "fast-json-patch";
import YAML from "yaml";
import type { ResourceDefinition } from "../registry/types.js";

// fast-json-patch is CommonJS — applyPatch/compare are only on the default export
// under Node's ESM interop, so destructure from default rather than named imports.
const { applyPatch, compare, deepClone } = fastJsonPatch;

export type PatchOperation =
  | { op: "add" | "replace" | "test"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "move" | "copy"; path: string; from: string };

export type PatchableResourceDefinition = Pick<ResourceDefinition, "resourceType" | "patchSupport">;

export interface ExtractResult {
  document: Record<string, unknown>;
  yamlSource: boolean;
}

export function supportsJsonPatch(def: PatchableResourceDefinition): boolean {
  return def.patchSupport?.kind === "yaml" && def.patchSupport.bodyFields.length > 0;
}

/**
 * Resolve a bodyFields entry against a GET response. A plain name (e.g.
 * "inputSetYaml") reads a top-level field; a dotted path (e.g. "template.yaml")
 * walks nested objects. Returns undefined if any segment is missing or not an
 * object, so extraction fails closed rather than throwing.
 */
function resolveFieldPath(record: Record<string, unknown>, field: string): unknown {
  if (!field.includes(".")) {
    return record[field];
  }
  let current: unknown = record;
  for (const segment of field.split(".")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Extract the mutable JSON body from a GET response.
 * For YAML-based resources (pipelines, templates, etc.), parses the embedded
 * YAML string into a JSON object. Unsupported resource types fail closed.
 */
export function extractMutableBody(
  getResult: unknown,
  def: PatchableResourceDefinition,
): ExtractResult {
  const resourceType = def.resourceType;
  const record = getResult as Record<string, unknown> | null | undefined;
  if (!record || typeof record !== "object") {
    throw new Error(`GET response for "${resourceType}" is not an object — cannot apply patch operations.`);
  }

  if (!supportsJsonPatch(def)) {
    throw new Error(
      `JSON Patch is not configured for "${resourceType}". ` +
      "This resource has no mutable-body projector, so patching its GET response is unsafe. Use a full body update instead.",
    );
  }

  let yamlStr: string | undefined;
  const bodyFields = def.patchSupport!.bodyFields;
  for (const field of bodyFields) {
    const value = resolveFieldPath(record, field);
    if (typeof value === "string") {
      yamlStr = value;
      break;
    }
  }
  if (typeof yamlStr === "string") {
    const parsed = YAML.parse(yamlStr);
    if (parsed && typeof parsed === "object") {
      return { document: parsed as Record<string, unknown>, yamlSource: true };
    }
    throw new Error(`Parsed YAML for "${resourceType}" is not an object.`);
  }
  throw new Error(
    `GET response for "${resourceType}" does not contain a YAML body (checked: ${bodyFields.join(", ")}). ` +
    `Ensure the GET returns the full resource definition.`,
  );
}

/**
 * Serialize a patched document back to the format expected by the update endpoint.
 * For YAML resources: converts back to a YAML string.
 * For others: returns the JSON object directly.
 */
export function serializeBody(
  patchedDoc: Record<string, unknown>,
  yamlSource: boolean,
): string | Record<string, unknown> {
  if (yamlSource) {
    return YAML.stringify(patchedDoc, { lineWidth: 0 });
  }
  return patchedDoc;
}

/**
 * Compute a structural diff between two documents, returning RFC 6902 operations
 * that transform `original` into `patched`. Useful for dry-run previews so we
 * expose only what changed rather than the full document.
 */
export function computeDiff(
  original: Record<string, unknown>,
  patched: Record<string, unknown>,
): Operation[] {
  return compare(original, patched);
}

/**
 * Apply RFC 6902 JSON Patch operations to a document.
 * Deep-clones the document before patching so the original is unmodified.
 * Validates operations and provides contextual error messages.
 */
export function applyJsonPatch(
  document: Record<string, unknown>,
  operations: PatchOperation[],
): Record<string, unknown> {
  if (operations.length === 0) {
    throw new Error("No patch operations provided.");
  }

  const cloned = deepClone(document) as Record<string, unknown>;

  let newDocument: unknown;
  try {
    const result = applyPatch(
      cloned,
      operations as Operation[],
      true,   // validateOperation
      true,   // mutateDocument (we already cloned)
      true,   // banPrototypeModifications
    );
    newDocument = result.newDocument;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`JSON Patch failed: ${msg}`);
  }

  // RFC 6901 allows path "" to target the document root, and fast-json-patch
  // honors root-level replace/remove. That would let a "targeted" patch collapse
  // the whole resource into a scalar, array, or null — which serializeBody() would
  // then forward as an unsafe full-body overwrite. Reject anything that is not a
  // plain (non-array) object so a patch can never escalate into a destructive write.
  if (newDocument === null || typeof newDocument !== "object" || Array.isArray(newDocument)) {
    const got = newDocument === null ? "null" : Array.isArray(newDocument) ? "array" : typeof newDocument;
    const article = /^[aeiou]/.test(got) ? "an" : "a";
    throw new Error(
      `JSON Patch failed: operations would replace the resource body with ${article} ${got} ` +
      "instead of an object (e.g. a root-level replace/remove with path \"\"). " +
      "JSON Patch is for targeted field edits — use a full body update to replace the entire resource.",
    );
  }

  return newDocument as Record<string, unknown>;
}
