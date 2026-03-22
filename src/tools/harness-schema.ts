import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("tool:harness-schema");

const VALID_SCHEMAS = ["pipeline", "template", "trigger"] as const;
type SchemaName = (typeof VALID_SCHEMAS)[number];

const SCHEMA_BASE_URL =
  "https://raw.githubusercontent.com/harness/harness-schema/main/v0";

const SCHEMA_FETCH_TIMEOUT_MS = 10_000;

const schemaCache = new Map<SchemaName, Record<string, unknown>>();

async function fetchSchema(name: SchemaName): Promise<Record<string, unknown>> {
  const cached = schemaCache.get(name);
  if (cached) return cached;

  const url = `${SCHEMA_BASE_URL}/${name}.json`;
  log.info("Fetching schema from GitHub", { name, url });

  const response = await fetch(url, { signal: AbortSignal.timeout(SCHEMA_FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Failed to fetch schema '${name}': HTTP ${response.status} ${response.statusText}`);
  }

  const schema = (await response.json()) as Record<string, unknown>;
  schemaCache.set(name, schema);
  return schema;
}

/**
 * Resolve a $ref pointer within the schema.
 * E.g. "#/definitions/trigger/trigger_source" → schema.definitions.trigger.trigger_source
 */
function resolveRef(schema: Record<string, unknown>, ref: string): unknown {
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
function inlineRefs(schema: Record<string, unknown>, node: unknown, depth = 0): unknown {
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
  schema: Record<string, unknown>,
  resourceType: string,
  path: string,
): unknown {
  const definitions = schema.definitions as Record<string, unknown> | undefined;
  if (!definitions) return undefined;

  const resourceDefs = definitions[resourceType] as Record<string, unknown> | undefined;
  if (!resourceDefs) return undefined;

  // Try direct key first
  if (resourceDefs[path]) return resourceDefs[path];

  // Try dot-separated path
  const parts = path.split(".");
  let current: unknown = resourceDefs;
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
 * Get a compact summary of the top-level structure: property names, types,
 * required fields, and available definition sections.
 */
function getSummary(schema: Record<string, unknown>, resourceType: string): Record<string, unknown> {
  const definitions = schema.definitions as Record<string, Record<string, unknown>> | undefined;
  const sections = definitions ? Object.keys(definitions[resourceType] ?? {}) : [];

  // Get the root resource definition
  const rootDef = definitions?.[resourceType]?.[resourceType] as Record<string, unknown> | undefined;
  const properties = rootDef?.properties as Record<string, unknown> | undefined;
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

export function registerSchemaTool(server: McpServer): void {
  server.registerTool(
    "harness_schema",
    {
      description:
        "Fetch Harness YAML schema for a resource type. Returns the JSON Schema definition " +
        "so you know the exact body structure for harness_create/harness_update. " +
        "Use without path for a summary of fields and available sections. " +
        "Use with path to drill into a specific section (e.g. path='scheduled_trigger' for cron trigger spec). " +
        `Available schemas: ${VALID_SCHEMAS.join(", ")}.`,
      inputSchema: {
        resource_type: z
          .enum(VALID_SCHEMAS)
          .describe("Schema to fetch: pipeline, template, or trigger"),
        path: z
          .string()
          .describe(
            "Dot-separated path to drill into a specific definition section. " +
            "E.g. 'trigger_source' for source types, 'scheduled_trigger' for cron spec, " +
            "'webhook_trigger' for webhook spec. Omit for a top-level summary.",
          )
          .optional(),
      },
      annotations: {
        title: "Harness YAML Schema",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const schema = await fetchSchema(args.resource_type);

        // No path → return summary
        if (!args.path) {
          return jsonResult(getSummary(schema, args.resource_type));
        }

        // Navigate to the requested path
        const node = navigateToPath(schema, args.resource_type, args.path);
        if (!node) {
          const definitions = schema.definitions as Record<string, Record<string, unknown>> | undefined;
          const available = definitions ? Object.keys(definitions[args.resource_type] ?? {}) : [];
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
