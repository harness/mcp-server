/**
 * Auto-resolves flat key-value runtime inputs into the full YAML structure
 * that the Harness pipeline execute API expects.
 *
 * Flow:
 * 1. Fetch the runtime input template for the pipeline (POST /pipeline/api/inputSets/template)
 * 2. Parse the template YAML to find `<+input>` placeholders
 * 3. Match user-provided flat key-value pairs to the placeholders by field name
 * 4. Return the filled YAML string ready for the execute API
 */
import YAML from "yaml";
import type { HarnessClient } from "../client/harness-client.js";
import { createLogger } from "./logger.js";
import { isRecord, asRecord, asString } from "./type-guards.js";

const log = createLogger("runtime-inputs");

const INPUT_PLACEHOLDER = /^<\+input>\.?/;
const HAS_DEFAULT = /^<\+input>\.default\(/;

const TEMPLATE_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

interface CachedTemplate {
  yaml: string | null;
  expiresAt: number;
}

const templateCache = new Map<string, CachedTemplate>();

function templateCacheKey(opts: ResolveOptions): string {
  return `${opts.pipelineId}|${opts.orgId ?? ""}|${opts.projectId ?? ""}|${opts.branch ?? ""}`;
}

/** Evict expired entries. Called on cache writes to prevent unbounded growth. */
function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of templateCache) {
    if (now >= entry.expiresAt) templateCache.delete(key);
  }
}

/** Clear the template cache (useful for testing). */
export function clearTemplateCache(): void {
  templateCache.clear();
}

export interface ResolveOptions {
  pipelineId: string;
  orgId?: string;
  projectId?: string;
  branch?: string;
}

export interface ResolutionResult {
  yaml: string;
  matched: string[];
  unmatchedRequired: string[];
  unmatchedOptional: string[];
  expectedKeys: string[];
}

interface TemplateResponse {
  inputSetTemplateYaml?: string;
  replacedExpressions?: string[];
  hasInputSets?: boolean;
}

/**
 * Fetch the runtime input template for a pipeline.
 * Returns the raw template YAML string with `<+input>` placeholders, or null if no inputs needed.
 */
export async function fetchRuntimeInputTemplate(
  client: HarnessClient,
  options: ResolveOptions,
): Promise<string | null> {
  const cacheKey = templateCacheKey(options);
  const cached = templateCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    log.debug("Runtime input template cache hit", { pipelineId: options.pipelineId });
    return cached.yaml;
  }

  const params: Record<string, string> = {
    pipelineIdentifier: options.pipelineId,
  };
  if (options.orgId) params.orgIdentifier = options.orgId;
  if (options.projectId) params.projectIdentifier = options.projectId;
  if (options.branch) params.branch = options.branch;

  const raw = await client.request<unknown>({
    method: "POST",
    path: "/pipeline/api/inputSets/template",
    params,
    body: {},
  });

  const data = asRecord(asRecord(raw)?.data);
  const templateYaml = asString(data?.inputSetTemplateYaml);

  const result = (templateYaml && templateYaml.trim() !== "") ? templateYaml : null;

  if (!result) {
    log.debug("Pipeline has no runtime inputs");
  }

  evictExpired();
  templateCache.set(cacheKey, { yaml: result, expiresAt: Date.now() + TEMPLATE_CACHE_TTL_MS });
  return result;
}

/**
 * Check if a value looks like a flat key-value map of runtime inputs
 * (as opposed to already being a full pipeline YAML structure or string).
 */
export function isFlatKeyValueInputs(inputs: unknown): inputs is Record<string, unknown> {
  if (!isRecord(inputs)) return false;
  // If it has a "pipeline" key, it's already a full structure
  if ("pipeline" in inputs) return false;
  // If all values are primitives (string, number, boolean), it's flat key-value
  return Object.values(inputs).every(
    (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean",
  );
}

/**
 * Given a template YAML with `<+input>` placeholders and a flat key-value map,
 * substitute matching fields and return the filled YAML string.
 *
 * Matching strategy:
 * - Walk the YAML tree depth-first
 * - For any value that is `<+input>` (or starts with `<+input>.`), look for a user-provided
 *   value by the leaf field name (e.g. "branch", "env", "tag")
 * - Also try matching by the full dotted path from the YAML root (e.g. "stages.deploy.spec.branch")
 */
export function substituteInputs(
  templateYaml: string,
  userInputs: Record<string, unknown>,
): ResolutionResult {
  const doc = YAML.parseDocument(templateYaml);
  const matched: string[] = [];
  const unmatchedRequired: string[] = [];
  const unmatchedOptional: string[] = [];
  const expectedKeys: string[] = [];

  const normalizedInputs = new Map<string, unknown>();
  for (const [key, value] of Object.entries(userInputs)) {
    normalizedInputs.set(key.toLowerCase(), value);
  }

  /**
   * For Harness variable-style entries like:
   *   - name: "branch"
   *     value: "<+input>"
   * When the leaf key is "value" or "default", look at the sibling "name" field
   * to get the actual variable name for matching.
   */
  function getSiblingName(parentMap: YAML.YAMLMap): string | undefined {
    for (const pair of parentMap.items) {
      const key = YAML.isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
      if (key === "name" && YAML.isScalar(pair.value)) {
        return String(pair.value.value);
      }
    }
    return undefined;
  }

  function walk(node: unknown, path: string[], parentMap?: YAML.YAMLMap): void {
    if (YAML.isMap(node)) {
      for (const pair of node.items) {
        const key = YAML.isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
        walk(pair.value, [...path, key], node);
      }
    } else if (YAML.isSeq(node)) {
      for (let i = 0; i < node.items.length; i++) {
        walk(node.items[i], [...path, String(i)], undefined);
      }
    } else if (YAML.isScalar(node)) {
      const val = String(node.value);
      if (INPUT_PLACEHOLDER.test(val)) {
        const rawLeafKey = path[path.length - 1] ?? "";
        const leafKey = rawLeafKey.toLowerCase();
        const fullPath = path.join(".").toLowerCase();
        const isOptional = HAS_DEFAULT.test(val);

        let variableNameRaw: string | undefined;
        let variableNameLower: string | undefined;
        if ((leafKey === "value" || leafKey === "default") && parentMap) {
          variableNameRaw = getSiblingName(parentMap);
          variableNameLower = variableNameRaw?.toLowerCase();
        }

        const bestKey = variableNameRaw ?? rawLeafKey ?? path.join(".");
        expectedKeys.push(bestKey);

        let replacement: unknown = undefined;
        let matchedAs: string | undefined;

        if (variableNameLower && normalizedInputs.has(variableNameLower)) {
          replacement = normalizedInputs.get(variableNameLower);
          matchedAs = variableNameLower;
        } else if (normalizedInputs.has(leafKey)) {
          replacement = normalizedInputs.get(leafKey);
          matchedAs = leafKey;
        } else if (normalizedInputs.has(fullPath)) {
          replacement = normalizedInputs.get(fullPath);
          matchedAs = fullPath;
        }

        const displayName = variableNameRaw ?? rawLeafKey ?? path.join(".");
        if (replacement !== undefined) {
          node.value = replacement;
          matched.push(matchedAs ?? displayName);
        } else if (isOptional) {
          unmatchedOptional.push(displayName);
        } else {
          unmatchedRequired.push(displayName);
        }
      }
    }
  }

  walk(doc.contents, [], undefined);

  return {
    yaml: doc.toString(),
    matched,
    unmatchedRequired,
    unmatchedOptional,
    expectedKeys,
  };
}

/**
 * High-level resolver: fetches the template and substitutes user inputs.
 * Returns the resolved YAML string ready for the pipeline execute API.
 *
 * If the pipeline has no runtime inputs, returns an empty string.
 * unmatchedRequired: placeholders that MUST be provided (will cause API 400).
 * unmatchedOptional: placeholders with .default() — the API fills them in.
 */
export async function resolveRuntimeInputs(
  client: HarnessClient,
  flatInputs: Record<string, unknown>,
  options: ResolveOptions,
): Promise<ResolutionResult> {
  log.info(`Resolving runtime inputs for pipeline ${options.pipelineId}`);

  const templateYaml = await fetchRuntimeInputTemplate(client, options);
  if (!templateYaml) {
    log.info("Pipeline has no runtime inputs, ignoring user-provided inputs");
    return { yaml: "", matched: [], unmatchedRequired: [], unmatchedOptional: [], expectedKeys: [] };
  }

  log.debug("Template YAML fetched", { templateLength: templateYaml.length });

  const result = substituteInputs(templateYaml, flatInputs);

  if (result.matched.length > 0) {
    log.info(`Resolved ${result.matched.length} runtime inputs: ${result.matched.join(", ")}`);
  }
  if (result.unmatchedRequired.length > 0) {
    log.warn(`${result.unmatchedRequired.length} required placeholders unresolved: ${result.unmatchedRequired.join(", ")}`);
  }
  if (result.unmatchedOptional.length > 0) {
    log.debug(`${result.unmatchedOptional.length} optional placeholders (have defaults): ${result.unmatchedOptional.join(", ")}`);
  }

  return result;
}
