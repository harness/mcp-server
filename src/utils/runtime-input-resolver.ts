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

type PathSegment = string | number;

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
 * Check if inputs can be resolved through the template system.
 * Returns true for any object that isn't already a full pipeline YAML structure.
 * Broader than isFlatKeyValueInputs — also accepts structural/nested inputs
 * (e.g. codebase build objects with nested type/spec).
 */
export function isResolvableInputs(inputs: unknown): inputs is Record<string, unknown> {
  if (!isRecord(inputs)) return false;
  if ("pipeline" in inputs) return false;
  return true;
}

/**
 * Flatten nested object inputs into dot-separated keys for template matching.
 * Preserves intermediate object values at each level for whole-subtree matching.
 *
 * Example: { build: { type: "branch", spec: { branch: "main" } } }
 * → { "build": { type: "branch", ... }, "build.type": "branch", "build.spec.branch": "main" }
 */
export function flattenInputs(inputs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  function recurse(obj: Record<string, unknown>, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      result[fullKey] = value;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        recurse(value as Record<string, unknown>, fullKey);
      }
    }
  }

  recurse(inputs, "");
  return result;
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

  function walk(node: unknown, path: string[], parentMap?: YAML.YAMLMap, parentPair?: YAML.Pair): void {
    if (YAML.isMap(node)) {
      for (const pair of node.items) {
        const key = YAML.isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
        walk(pair.value, [...path, key], node, pair);
      }
    } else if (YAML.isSeq(node)) {
      for (let i = 0; i < node.items.length; i++) {
        walk(node.items[i], [...path, String(i)], undefined, undefined);
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

        // Suffix matching: try progressively shorter path suffixes for dot-separated
        // flattened keys (e.g. "build.type" matches "...codebase.build.type")
        if (replacement === undefined) {
          for (let i = 1; i < path.length - 1; i++) {
            const suffix = path.slice(i).join(".").toLowerCase();
            if (normalizedInputs.has(suffix)) {
              replacement = normalizedInputs.get(suffix);
              matchedAs = suffix;
              break;
            }
          }
        }

        const displayName = variableNameRaw ?? rawLeafKey ?? path.join(".");
        if (replacement !== undefined) {
          if (typeof replacement === "object" && replacement !== null && parentPair) {
            // Replace scalar <+input> placeholder with a structured YAML node
            parentPair.value = doc.createNode(replacement);
          } else {
            node.value = replacement;
          }
          matched.push(matchedAs ?? displayName);
        } else if (isOptional) {
          unmatchedOptional.push(displayName);
        } else {
          unmatchedRequired.push(displayName);
        }
      }
    }
  }

  walk(doc.contents, [], undefined, undefined);

  return {
    yaml: doc.toString(),
    matched,
    unmatchedRequired,
    unmatchedOptional,
    expectedKeys,
  };
}

function normalizeInputs(userInputs: Record<string, unknown>): Map<string, unknown> {
  const normalizedInputs = new Map<string, unknown>();
  for (const [key, value] of Object.entries(userInputs)) {
    normalizedInputs.set(key.toLowerCase(), value);
  }
  return normalizedInputs;
}

function replacementForPath(
  path: PathSegment[],
  normalizedInputs: Map<string, unknown>,
  variableNameRaw?: string,
): { value: unknown; matchedAs: string | undefined } {
  const rawLeafKey = String(path[path.length - 1] ?? "");
  const leafKey = rawLeafKey.toLowerCase();
  const fullPath = path.map(String).join(".").toLowerCase();
  const variableNameLower = variableNameRaw?.toLowerCase();

  if (variableNameLower && normalizedInputs.has(variableNameLower)) {
    return { value: normalizedInputs.get(variableNameLower), matchedAs: variableNameLower };
  }
  if (normalizedInputs.has(leafKey)) {
    return { value: normalizedInputs.get(leafKey), matchedAs: leafKey };
  }
  if (normalizedInputs.has(fullPath)) {
    return { value: normalizedInputs.get(fullPath), matchedAs: fullPath };
  }

  for (let i = 1; i < path.length - 1; i++) {
    const suffix = path.slice(i).map(String).join(".").toLowerCase();
    if (normalizedInputs.has(suffix)) {
      return { value: normalizedInputs.get(suffix), matchedAs: suffix };
    }
  }

  return { value: undefined, matchedAs: undefined };
}

function getAtPath(root: unknown, path: PathSegment[]): unknown {
  let current = root;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[segment];
      continue;
    }
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[segment];
  }
  return current;
}

function setAtPath(root: unknown, path: PathSegment[], value: unknown): boolean {
  if (path.length === 0) return false;
  let current = root;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i]!;
    const nextSegment = path[i + 1]!;
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return false;
      if (current[segment] === undefined) {
        current[segment] = typeof nextSegment === "number" ? [] : {};
      }
      current = current[segment];
      continue;
    }

    const record = asRecord(current);
    if (!record) return false;
    if (record[segment] === undefined) {
      record[segment] = typeof nextSegment === "number" ? [] : {};
    }
    current = record[segment];
  }

  const leaf = path[path.length - 1]!;
  if (typeof leaf === "number") {
    if (!Array.isArray(current)) return false;
    current[leaf] = value;
    return true;
  }
  const record = asRecord(current);
  if (!record) return false;
  record[leaf] = value;
  return true;
}

function findVariableRecord(root: unknown, parentPath: PathSegment[], variableNameRaw: string): Record<string, unknown> | undefined {
  const variableName = variableNameRaw.toLowerCase();
  const directParent = asRecord(getAtPath(root, parentPath));
  if (asString(directParent?.name)?.toLowerCase() === variableName) {
    return directParent;
  }

  const maybeVariableList = getAtPath(root, parentPath.slice(0, -1));
  if (!Array.isArray(maybeVariableList)) return undefined;

  for (const item of maybeVariableList) {
    const record = asRecord(item);
    if (asString(record?.name)?.toLowerCase() === variableName) {
      return record;
    }
  }
  return undefined;
}

function getCoveredValue(root: unknown, path: PathSegment[], variableNameRaw: string | undefined): unknown {
  if (variableNameRaw) {
    const variable = findVariableRecord(root, path.slice(0, -1), variableNameRaw);
    const leaf = path[path.length - 1];
    if (variable && typeof leaf === "string") {
      return variable[leaf];
    }
    return undefined;
  }
  return getAtPath(root, path);
}

function setOverrideValue(
  root: unknown,
  path: PathSegment[],
  value: unknown,
  variableNameRaw: string | undefined,
  templateVariable?: Record<string, unknown>,
): void {
  if (variableNameRaw) {
    const variable = findVariableRecord(root, path.slice(0, -1), variableNameRaw);
    const leaf = path[path.length - 1];
    if (variable && typeof leaf === "string") {
      variable[leaf] = value;
      return;
    }
    const variableList = getAtPath(root, path.slice(0, -2));
    if (Array.isArray(variableList) && typeof leaf === "string") {
      variableList.push({
        ...(templateVariable ?? { name: variableNameRaw }),
        [leaf]: value,
      });
    }
    return;
  }
  setAtPath(root, path, value);
}

function isCoveredByBaseInput(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return !(typeof value === "string" && INPUT_PLACEHOLDER.test(value));
}

/**
 * Apply simple inline overrides onto already-materialized input-set YAML.
 *
 * The runtime template is used only as a map from public input keys to exact
 * runtime locations. Fields that the caller did not provide are left from the
 * input set, instead of leaking unresolved `<+input>` placeholders from the
 * template into the execute body.
 */
export function substituteInputsIntoBaseYaml(
  templateYaml: string,
  userInputs: Record<string, unknown>,
  baseYaml: string,
): ResolutionResult {
  const templateRoot = YAML.parse(templateYaml) as unknown;
  const outputRoot = YAML.parse(baseYaml) as unknown;
  const normalizedInputs = normalizeInputs(userInputs);
  const matched: string[] = [];
  const unmatchedRequired: string[] = [];
  const unmatchedOptional: string[] = [];
  const expectedKeys: string[] = [];

  function walk(node: unknown, path: PathSegment[], parentRecord?: Record<string, unknown>): void {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, [...path, index], undefined));
      return;
    }

    const record = asRecord(node);
    if (record) {
      for (const [key, value] of Object.entries(record)) {
        walk(value, [...path, key], record);
      }
      return;
    }

    if (typeof node !== "string" || !INPUT_PLACEHOLDER.test(node)) {
      return;
    }

    const rawLeafKey = String(path[path.length - 1] ?? "");
    const variableNameRaw = (rawLeafKey.toLowerCase() === "value" || rawLeafKey.toLowerCase() === "default")
      ? asString(parentRecord?.name)
      : undefined;
    const displayName = variableNameRaw ?? rawLeafKey ?? path.map(String).join(".");
    const isOptional = HAS_DEFAULT.test(node);
    expectedKeys.push(displayName);

    const replacement = replacementForPath(path, normalizedInputs, variableNameRaw);
    if (replacement.value !== undefined) {
      setOverrideValue(outputRoot, path, replacement.value, variableNameRaw, parentRecord);
      matched.push(replacement.matchedAs ?? displayName);
      return;
    }

    if (isCoveredByBaseInput(getCoveredValue(outputRoot, path, variableNameRaw))) {
      return;
    }

    if (isOptional) {
      unmatchedOptional.push(displayName);
    } else {
      unmatchedRequired.push(displayName);
    }
  }

  walk(templateRoot, [], undefined);

  return {
    yaml: YAML.stringify(outputRoot),
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

export async function resolveRuntimeInputsWithBaseYaml(
  client: HarnessClient,
  flatInputs: Record<string, unknown>,
  options: ResolveOptions,
  baseYaml: string,
): Promise<ResolutionResult> {
  log.info(`Resolving runtime input overrides for pipeline ${options.pipelineId}`);

  const templateYaml = await fetchRuntimeInputTemplate(client, options);
  if (!templateYaml) {
    log.info("Pipeline has no runtime input template, using materialized input set YAML as-is");
    return { yaml: baseYaml, matched: [], unmatchedRequired: [], unmatchedOptional: [], expectedKeys: [] };
  }

  const result = substituteInputsIntoBaseYaml(templateYaml, flatInputs, baseYaml);

  if (result.matched.length > 0) {
    log.info(`Applied ${result.matched.length} runtime input override(s): ${result.matched.join(", ")}`);
  }
  if (result.unmatchedRequired.length > 0) {
    log.warn(`${result.unmatchedRequired.length} required placeholders unresolved after input set merge: ${result.unmatchedRequired.join(", ")}`);
  }
  if (result.unmatchedOptional.length > 0) {
    log.debug(`${result.unmatchedOptional.length} optional placeholders still defaulted after input set merge: ${result.unmatchedOptional.join(", ")}`);
  }

  return result;
}
