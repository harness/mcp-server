import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestOptions } from "../client/types.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { createLogger } from "../utils/logger.js";
import { SCHEMAS, VALID_SCHEMAS } from "../data/schemas/index.js";
import type { SchemaEntry } from "../data/schemas/types.js";
import { getExample, searchExamples, getExamplesForResource } from "../data/examples/index.js";

const log = createLogger("tool:harness-schema");

type JsonObject = Record<string, unknown>;

interface SchemaClient {
  request<T>(options: RequestOptions): Promise<T>;
}

interface LiveEntitySchemaDefinition {
  entityType: string;
  description: string;
}

const LIVE_ENTITY_SCHEMAS: Record<string, LiveEntitySchemaDefinition> = {
  connector: {
    entityType: "CONNECTOR",
    description: "Connector entity schema fetched from Harness at runtime",
  },
  environment: {
    entityType: "ENVIRONMENT",
    description: "Environment entity schema fetched from Harness at runtime",
  },
  service: {
    entityType: "SERVICE",
    description: "Service entity schema fetched from Harness at runtime",
  },
  infrastructure: {
    entityType: "INFRASTRUCTURE",
    description: "Infrastructure entity schema fetched from Harness at runtime",
  },
  secret: {
    entityType: "SECRET",
    description: "Secret entity schema fetched from Harness at runtime",
  },
};

const RESPONSE_SCHEMA_KEYS = ["schema", "yamlSchema", "jsonSchema", "yaml_schema", "json_schema"];

function isRecord(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isSchemaClient(value: unknown): value is SchemaClient {
  return isRecord(value) && typeof value.request === "function";
}

function looksLikeJsonSchema(value: unknown): value is JsonObject {
  return isRecord(value) && (
    "$schema" in value ||
    "definitions" in value ||
    "properties" in value ||
    "type" in value ||
    "oneOf" in value ||
    "anyOf" in value ||
    "allOf" in value
  );
}

function parseSchemaCandidate(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function collectSchemaCandidates(response: unknown): unknown[] {
  const candidates: unknown[] = [response];
  const parsedResponse = parseSchemaCandidate(response);
  if (parsedResponse !== response) candidates.push(parsedResponse);

  for (const candidate of [...candidates]) {
    const parsed = parseSchemaCandidate(candidate);
    if (!isRecord(parsed)) continue;

    candidates.push(parsed.data);
    for (const key of RESPONSE_SCHEMA_KEYS) {
      candidates.push(parsed[key]);
    }

    const data = parseSchemaCandidate(parsed.data);
    if (isRecord(data)) {
      for (const key of RESPONSE_SCHEMA_KEYS) {
        candidates.push(data[key]);
      }
    }
  }

  return candidates;
}

function extractLiveSchema(response: unknown): JsonObject {
  for (const candidate of collectSchemaCandidates(response)) {
    const parsed = parseSchemaCandidate(candidate);
    if (looksLikeJsonSchema(parsed)) return parsed;
  }

  throw new Error(
    "Harness yaml-schema response did not contain a JSON Schema object. " +
    "Expected a schema object or a response envelope containing data.schema.",
  );
}

function liveSchemaNames(client?: SchemaClient): string[] {
  return client ? Object.keys(LIVE_ENTITY_SCHEMAS) : [];
}

function getLiveSchemaDefinition(resourceType: string): LiveEntitySchemaDefinition | undefined {
  return LIVE_ENTITY_SCHEMAS[resourceType];
}

function getNestedSchemaRoot(value: unknown, preferredKey: string): JsonObject | undefined {
  if (!isRecord(value)) return undefined;
  if (looksLikeJsonSchema(value) && ("properties" in value || "type" in value)) return value;

  const preferred = value[preferredKey];
  if (looksLikeJsonSchema(preferred)) return preferred;

  for (const nested of Object.values(value)) {
    if (looksLikeJsonSchema(nested) && ("properties" in nested || "type" in nested)) {
      return nested;
    }
  }

  return undefined;
}

function getResourceDefinitions(schema: JsonObject, resourceType: string): JsonObject | undefined {
  const definitions = schema.definitions;
  if (!isRecord(definitions)) return undefined;

  const title = typeof schema.title === "string" ? schema.title : undefined;
  const keys = [
    resourceType,
    title,
    resourceType.toUpperCase(),
    resourceType[0]?.toUpperCase() + resourceType.slice(1),
  ].filter((key): key is string => !!key);

  for (const key of keys) {
    const direct = definitions[key];
    if (isRecord(direct)) return direct;
  }

  return undefined;
}

function getRootDefinition(schema: JsonObject, resourceType: string): JsonObject | undefined {
  const resourceDefs = getResourceDefinitions(schema, resourceType);
  const exactHarnessRoot = resourceDefs?.[resourceType];
  if (looksLikeJsonSchema(exactHarnessRoot)) return exactHarnessRoot;

  if (looksLikeJsonSchema(schema) && schema.properties) return schema;

  const rootFromResourceDefs = getNestedSchemaRoot(resourceDefs, resourceType);
  if (rootFromResourceDefs) return rootFromResourceDefs;

  const definitions = schema.definitions;
  if (!isRecord(definitions)) return undefined;

  for (const definition of Object.values(definitions)) {
    const root = getNestedSchemaRoot(definition, resourceType);
    if (root) return root;
  }

  return undefined;
}

function getDefinitionSections(schema: JsonObject, resourceType: string): string[] {
  const resourceDefs = getResourceDefinitions(schema, resourceType);
  if (resourceDefs) return Object.keys(resourceDefs);

  const definitions = schema.definitions;
  return isRecord(definitions) ? Object.keys(definitions) : [];
}

function navigateByDotPath(node: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = node;
  for (const part of parts) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Resolve a $ref pointer within the schema.
 * E.g. "#/definitions/trigger/trigger_source" → schema.definitions.trigger.trigger_source
 */
function resolveRef(schema: JsonObject, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined;
  const parts = ref.slice(2).split("/");
  let current: unknown = schema;
  for (const part of parts) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Inline $ref references one level deep so the returned schema fragment
 * is self-contained and useful without chasing references.
 */
function inlineRefs(schema: JsonObject, node: unknown, depth = 0): unknown {
  if (depth > 3) return node; // prevent infinite recursion
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map((item) => inlineRefs(schema, item, depth));
  }

  const obj = node as Record<string, unknown>;

  // If this node is a $ref, resolve it
  if (typeof obj["$ref"] === "string") {
    const resolved = resolveRef(schema, obj["$ref"]);
    if (resolved && typeof resolved === "object") {
      return inlineRefs(schema, resolved, depth + 1);
    }
    return obj;
  }

  // Recurse into child properties
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "$schema") continue; // strip noise
    result[key] = inlineRefs(schema, value, depth + 1);
  }
  return result;
}

/**
 * Navigate into definitions by dot-separated path.
 * E.g. "trigger_source" → definitions.trigger.trigger_source
 *       "scheduled_trigger" → definitions.trigger.scheduled_trigger
 */
function navigateToPath(
  schema: JsonObject,
  resourceType: string,
  path: string,
): unknown {
  const resourceDefs = getResourceDefinitions(schema, resourceType);

  // Try direct key first
  if (resourceDefs?.[path]) return resourceDefs[path];

  // Try dot-separated path
  const resourcePathResult = resourceDefs ? navigateByDotPath(resourceDefs, path) : undefined;
  if (resourcePathResult !== undefined) return resourcePathResult;

  return navigateByDotPath(schema, path);
}

/**
 * Get a compact summary of the top-level structure: property names, types,
 * required fields, and available definition sections.
 */
function getSummary(schema: JsonObject, resourceType: string): Record<string, unknown> {
  // Harness-generated schemas nest the root definition under definitions[type][type].
  // Plain JSON Schemas (extension/live schemas) place properties at the root level.
  const rootDef = getRootDefinition(schema, resourceType);

  const sections = getDefinitionSections(schema, resourceType);
  const properties = rootDef?.properties as JsonObject | undefined;
  const required = rootDef?.required as string[] | undefined;

  const fields: Array<{ name: string; type: string; required: boolean; ref?: string }> = [];
  if (properties) {
    for (const [name, spec] of Object.entries(properties)) {
      const s = spec as Record<string, unknown>;
      fields.push({
        name,
        type: (s.type as string) ?? (s["$ref"] ? "object ($ref)" : "unknown"),
        required: required?.includes(name) ?? false,
        ...(s["$ref"] ? { ref: (s["$ref"] as string).split("/").pop() } : {}),
      });
    }
  }

  return {
    resource_type: resourceType,
    fields,
    available_sections: sections,
    hint: "Use path parameter to drill into a section. E.g. path='trigger_source' for source structure, path='scheduled_trigger' for cron spec.",
  };
}

export function registerSchemaTool(
  server: McpServer,
  client: SchemaClient,
  additionalSchemas?: Record<string, SchemaEntry>,
): void;
export function registerSchemaTool(
  server: McpServer,
  additionalSchemas?: Record<string, SchemaEntry>,
): void;
export function registerSchemaTool(
  server: McpServer,
  clientOrAdditionalSchemas?: SchemaClient | Record<string, SchemaEntry>,
  maybeAdditionalSchemas?: Record<string, SchemaEntry>,
): void {
  const client = isSchemaClient(clientOrAdditionalSchemas) ? clientOrAdditionalSchemas : undefined;
  const additionalSchemas = isSchemaClient(clientOrAdditionalSchemas)
    ? maybeAdditionalSchemas
    : clientOrAdditionalSchemas;
  const liveNames = liveSchemaNames(client);

  if (additionalSchemas) {
    for (const key of Object.keys(additionalSchemas)) {
      if (key in SCHEMAS) {
        throw new Error(`additionalSchemas key '${key}' conflicts with a built-in schema name`);
      }
      if (liveNames.includes(key)) {
        throw new Error(`additionalSchemas key '${key}' conflicts with a live schema name`);
      }
    }
  }
  const allSchemas: Record<string, JsonObject> = additionalSchemas
    ? { ...SCHEMAS, ...Object.fromEntries(Object.entries(additionalSchemas).map(([k, v]) => [k, v.schema])) }
    : { ...SCHEMAS };
  const availableSchemas = [...Object.keys(allSchemas), ...liveNames];
  const liveSchemaCache = new Map<string, JsonObject>();

  async function getSchema(resourceType: string): Promise<JsonObject | undefined> {
    const staticSchema = allSchemas[resourceType];
    if (staticSchema) return staticSchema;

    const liveDefinition = getLiveSchemaDefinition(resourceType);
    if (!client || !liveDefinition) return undefined;

    const cached = liveSchemaCache.get(resourceType);
    if (cached) return cached;

    log.debug("Fetching live Harness YAML schema", {
      resource_type: resourceType,
      entity_type: liveDefinition.entityType,
    });
    const response = await client.request<unknown>({
      method: "GET",
      path: "/ng/api/yaml-schema",
      params: { entityType: liveDefinition.entityType },
    });
    const schema = extractLiveSchema(response);
    liveSchemaCache.set(resourceType, schema);
    return schema;
  }

  server.registerTool(
    "harness_schema",
    {
      description:
        "Fetch Harness YAML schema or examples for a resource type. " +
        "Use without path for a summary of fields and available sections. " +
        "Use with path to drill into a specific section. " +
        "Use with example to fetch a named example YAML snippet. " +
        "Use with example_search to find examples by keyword. " +
        "Precedence: example > example_search > path > summary. " +
        `Available schemas: ${availableSchemas.join(", ")}.`,
      inputSchema: {
        resource_type: z
          .enum(availableSchemas as [string, ...string[]])
          .describe(`Schema to fetch. Available: ${availableSchemas.join(", ")}. Required for schema/path lookups, optional for example_search.`)
          .optional(),
        path: z
          .string()
          .optional()
          .describe(
            "Dot-separated path to drill into a specific definition section. " +
            "Omit for a top-level summary showing all available sections.",
          ),
        example: z
          .string()
          .optional()
          .describe("Fetch a specific example by name (e.g. 'minimal-ci'). Returns the full YAML snippet and description."),
        example_search: z
          .string()
          .optional()
          .describe("Search examples by keyword. Returns matching example names and descriptions. Optionally combine with resource_type to filter."),
      },
      annotations: {
        title: "Harness YAML Schema",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        // --- Example fetch mode ---
        if (args.example) {
          const ex = getExample(args.example);
          if (!ex) {
            const available = args.resource_type
              ? getExamplesForResource(args.resource_type).map((e) => e.name)
              : [];
            return jsonResult({
              error: `Example '${args.example}' not found.` +
                (available.length ? ` Available for ${args.resource_type}: ${available.join(", ")}` : " Use example_search to find examples."),
              available_examples: available,
            });
          }
          return jsonResult({
            name: ex.name,
            resourceType: ex.resourceType,
            description: ex.description,
            tags: ex.tags,
            yaml: ex.yaml,
          });
        }

        // --- Example search mode ---
        if (args.example_search) {
          const results = searchExamples(args.example_search, args.resource_type);
          return jsonResult({
            search: args.example_search,
            ...(args.resource_type ? { resource_type: args.resource_type } : {}),
            total: results.length,
            results: results.map((e) => ({
              name: e.name,
              resourceType: e.resourceType,
              description: e.description,
              tags: e.tags,
            })),
            hint: results.length > 0
              ? "Use example='<name>' to fetch the full YAML for any result."
              : "No matches. Try a broader keyword or omit resource_type to search globally.",
          });
        }

        // --- Schema mode (existing behavior) ---
        if (!args.resource_type) {
          return errorResult("resource_type is required for schema lookups. Use example_search to search examples without specifying a resource type.");
        }

        const schema = await getSchema(args.resource_type);
        if (!schema) {
          return errorResult(
            `Schema '${args.resource_type}' not found. Available schemas: ${availableSchemas.join(", ")}`,
          );
        }

        // No path → return summary with available examples
        if (!args.path) {
          const summary = getSummary(schema, args.resource_type);
          const examples = getExamplesForResource(args.resource_type);
          if (examples.length > 0) {
            (summary as Record<string, unknown>).examples_available = examples.map((e) => e.name);
          }
          return jsonResult(summary);
        }

        // Navigate to the requested path
        const node = navigateToPath(schema, args.resource_type, args.path);
        if (!node) {
          const available = getDefinitionSections(schema, args.resource_type);
          return errorResult(
            `Path '${args.path}' not found in ${args.resource_type} schema. ` +
            `Available sections: ${available.join(", ")}`,
          );
        }

        // Inline $ref references so the result is self-contained
        const resolved = inlineRefs(schema, node);

        return jsonResult({
          resource_type: args.resource_type,
          path: args.path,
          schema: resolved,
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
