import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { createLogger } from "../utils/logger.js";
import { SCHEMAS, VALID_SCHEMAS, V0_SCHEMA_KEYS, V1_SCHEMA_KEYS } from "../data/schemas/index.js";

const log = createLogger("tool:harness-schema");

const V0_ONLY = new Set<string>(V0_SCHEMA_KEYS);
const V1_ONLY = new Set<string>(V1_SCHEMA_KEYS);

const MAX_RESPONSE_BYTES = 40_960;
const VARIANT_SUMMARY_THRESHOLD = 4;

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

function extractRefLabel(ref: string): string {
  const match = ref.match(/^#\/definitions\/[^/]+\/(.+)$/);
  return match?.[1] ?? ref.replace(/^#\//, "");
}

function summarizeVariants(
  variants: unknown[],
): Record<string, unknown> {
  const items: Array<Record<string, string>> = [];
  for (const v of variants) {
    if (!v || typeof v !== "object") continue;
    const obj = v as Record<string, unknown>;
    const entry: Record<string, string> = {};
    if (typeof obj["$ref"] === "string") {
      entry.ref = extractRefLabel(obj["$ref"]);
    }
    if (typeof obj.title === "string") {
      entry.title = obj.title;
    } else if (obj.properties && typeof obj.properties === "object") {
      const keys = Object.keys(obj.properties as Record<string, unknown>);
      const discriminator = keys.find((k) =>
        (((obj.properties as Record<string, unknown>)[k] as Record<string, unknown>)?.enum as unknown[])?.length === 1,
      );
      if (discriminator) {
        const enumVal = (((obj.properties as Record<string, unknown>)[discriminator] as Record<string, unknown>).enum as string[])[0];
        entry.title = String(enumVal);
      }
    }
    if (Object.keys(entry).length > 0) items.push(entry);
  }
  return {
    _summary: `${variants.length} variants — use a more specific path to drill into one`,
    variants: items,
  };
}

function compactSummary(
  node: unknown,
  resourceType: string,
  path: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    resource_type: resourceType,
    path,
    _note: "Response was too large; showing compact summary. Use a more specific path to see full detail.",
  };

  if (!node || typeof node !== "object" || Array.isArray(node)) return result;
  const obj = node as Record<string, unknown>;

  if (obj.properties && typeof obj.properties === "object") {
    const props = obj.properties as Record<string, unknown>;
    const required = (obj.required as string[]) ?? [];
    result.properties = Object.entries(props).map(([name, spec]) => {
      const s = spec as Record<string, unknown>;
      const entry: Record<string, unknown> = { name };
      if (s.type) entry.type = s.type;
      if (s["$ref"]) entry.type = "object ($ref)";
      if (s.enum) entry.enum = s.enum;
      if (required.includes(name)) entry.required = true;
      return entry;
    });
  }

  for (const unionKey of ["oneOf", "anyOf"] as const) {
    if (Array.isArray(obj[unionKey])) {
      result[unionKey] = summarizeVariants(obj[unionKey] as unknown[]);
    }
  }

  const subSections = Object.keys(obj).filter(
    (k) => !["properties", "type", "required", "title", "description", "oneOf", "anyOf", "allOf", "$schema"].includes(k)
      && typeof (obj[k]) === "object" && obj[k] !== null,
  );
  if (subSections.length > 0) result.available_sub_sections = subSections;

  return result;
}

/**
 * Inline $ref references so the returned schema fragment is self-contained.
 * Summarizes oneOf/anyOf arrays that exceed VARIANT_SUMMARY_THRESHOLD.
 */
function inlineRefs(
  schema: Record<string, unknown>,
  node: unknown,
  depth = 0,
  maxDepth = 2,
): unknown {
  if (depth > maxDepth) return node;
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map((item) => inlineRefs(schema, item, depth, maxDepth));
  }

  const obj = node as Record<string, unknown>;

  if (typeof obj["$ref"] === "string") {
    const resolved = resolveRef(schema, obj["$ref"]);
    if (resolved && typeof resolved === "object") {
      return inlineRefs(schema, resolved, depth + 1, maxDepth);
    }
    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "$schema") continue;
    if (
      (key === "oneOf" || key === "anyOf") &&
      Array.isArray(value) &&
      value.length > VARIANT_SUMMARY_THRESHOLD
    ) {
      result[key] = summarizeVariants(value);
    } else {
      result[key] = inlineRefs(schema, value, depth + 1, maxDepth);
    }
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

export function registerSchemaTool(server: McpServer, registry?: Registry): void {
  const registeredTypes = registry ? new Set(registry.getAllResourceTypes()) : undefined;

  // Determine which version set to exclude based on registry's pipeline version.
  // If pipeline_v1 is registered → v1 account → hide v0-only schemas.
  // If pipeline is registered → v0 account → hide v1-only schemas.
  // Local schemas (agent-pipeline) are always available.
  const excludeSet = registeredTypes?.has("pipeline_v1") ? V0_ONLY : V1_ONLY;

  const availableSchemas = VALID_SCHEMAS.filter((s) => {
    if (!registeredTypes) return true;
    if (V0_ONLY.has(s) || V1_ONLY.has(s)) return !excludeSet.has(s);
    return true; // local schemas always pass
  });

  server.registerTool(
    "harness_schema",
    {
      description:
        "Fetch Harness YAML schema for a resource type. Returns the JSON Schema definition " +
        "so you know the exact body structure for harness_create/harness_update. " +
        "Use without path for a summary of fields and available sections. " +
        "Use with path to drill into a specific section. " +
        "Large sections (stages, steps) return a compact summary with available_sub_sections — " +
        "drill into a specific sub-section for full detail. " +
        `Available schemas: ${availableSchemas.join(", ")}.`,
      inputSchema: {
        resource_type: z
          .enum(availableSchemas as [string, ...string[]])
          .describe(`Schema to fetch. Available: ${availableSchemas.join(", ")}`),
        path: z
          .string()
          .optional()
          .describe(
            "Dot-separated path to drill into a specific definition section. " +
            "Omit for a top-level summary showing all available sections.",
          ),
        max_depth: z
          .number()
          .min(1)
          .max(3)
          .default(2)
          .optional()
          .describe("How many levels deep to inline $ref references (1-3). Lower = smaller response. Default: 2."),
      },
      annotations: {
        title: "Harness YAML Schema",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const schema = SCHEMAS[args.resource_type as keyof typeof SCHEMAS] as Record<string, unknown>;

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

        const maxDepth = (args.max_depth as number | undefined) ?? 2;
        const resolved = inlineRefs(schema, node, 0, maxDepth);
        const serialized = JSON.stringify({ resource_type: args.resource_type, path: args.path, schema: resolved });

        if (serialized.length > MAX_RESPONSE_BYTES) {
          return jsonResult(compactSummary(node, args.resource_type, args.path));
        }

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
