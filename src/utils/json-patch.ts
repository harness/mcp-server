import fastJsonPatch, { type Operation } from "fast-json-patch";
import YAML from "yaml";
import type { ResourceDefinition } from "../registry/types.js";

// fast-json-patch is CommonJS — applyPatch/compare are only on the default export
// under Node's ESM interop, so destructure from default rather than named imports.
const { applyPatch, compare, deepClone } = fastJsonPatch;

export interface PatchOperation {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: unknown;
  from?: string;
}

export type PatchableResourceDefinition = Pick<ResourceDefinition, "resourceType" | "patchSupport">;

export interface ExtractResult {
  document: Record<string, unknown>;
  yamlSource: boolean;
  /** Raw GET metadata (e.g. lastObjectId, storeType) preserved for the update call */
  metadata: Record<string, unknown>;
}

export function supportsJsonPatch(def: PatchableResourceDefinition): boolean {
  return def.patchSupport?.kind === "yaml" && def.patchSupport.bodyFields.length > 0;
}

/**
 * Extract the mutable JSON body from a GET response.
 * For YAML-based resources (pipelines, templates, etc.), parses the embedded
 * YAML string into a JSON object. Unsupported resource types fail closed.
 * Also preserves GET metadata needed for optimistic concurrency (lastObjectId, etc.).
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

  const metadata: Record<string, unknown> = {};
  if (record.lastObjectId !== undefined) metadata.lastObjectId = record.lastObjectId;
  if (record.lastCommitId !== undefined) metadata.lastCommitId = record.lastCommitId;
  if (record.storeType !== undefined) metadata.storeType = record.storeType;
  if (record.connectorRef !== undefined) metadata.connectorRef = record.connectorRef;

  if (!supportsJsonPatch(def)) {
    throw new Error(
      `JSON Patch is not configured for "${resourceType}". ` +
      "This resource has no mutable-body projector, so patching its GET response is unsafe. Use a full body update instead.",
    );
  }

  let yamlStr: string | undefined;
  const bodyFields = def.patchSupport!.bodyFields;
  for (const field of bodyFields) {
    if (typeof record[field] === "string") {
      yamlStr = record[field] as string;
      break;
    }
  }
  if (typeof yamlStr === "string") {
    const parsed = YAML.parse(yamlStr);
    if (parsed && typeof parsed === "object") {
      return { document: parsed as Record<string, unknown>, yamlSource: true, metadata };
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

  try {
    const result = applyPatch(
      cloned,
      operations as Operation[],
      true,   // validateOperation
      true,   // mutateDocument (we already cloned)
      true,   // banPrototypeModifications
    );
    return result.newDocument as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`JSON Patch failed: ${msg}`);
  }
}
