import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { SCHEMAS } from "../data/schemas/index.js";
import type { SchemaEntry } from "../data/schemas/types.js";
import { getExample, searchExamples, getExamplesForResource } from "../data/examples/index.js";
import { createLogger } from "../utils/logger.js";
import { schemaOutputSchema } from "./output-schemas.js";
import {
  createLiveSchemaFetcher,
  getDefinitionSections,
  getEntitySchemaSummary,
  navigateEntitySchemaPath,
  LIVE_ENTITY_RESOURCE_TYPES,
  type HarnessYamlScope,
} from "./entity-schema/live.js";
import type { JsonObject } from "./entity-schema/normalize.js";

const log = createLogger("schema");

const scopeSchema = z
  .enum(["account", "org", "project"])
  .optional()
  .describe(
    "Harness YAML scope for live entity schemas (connector, environment, service, secret, infrastructure). " +
      "Defaults to account. Org/project scoped entities require org_id and/or project_id.",
  );

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

function inlineRefs(schema: Record<string, unknown>, node: unknown, depth = 0): unknown {
  if (depth > 3) return node;
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    return node.map((item) => inlineRefs(schema, item, depth));
  }

  const obj = node as Record<string, unknown>;

  if (typeof obj["$ref"] === "string") {
    const resolved = resolveRef(schema, obj["$ref"]);
    if (resolved && typeof resolved === "object") {
      return inlineRefs(schema, resolved, depth + 1);
    }
    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "$schema") continue;
    result[key] = inlineRefs(schema, value, depth + 1);
  }
  return result;
}

function isSchemaNode(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    "title" in v ||
    "type" in v ||
    "$ref" in v ||
    "properties" in v ||
    "oneOf" in v ||
    "anyOf" in v ||
    "allOf" in v ||
    "enum" in v
  );
}

/**
 * Recursively search for a definition by key name within a resource's
 * definitions tree. Harness schemas nest reusable definitions under group
 * keys (e.g. EnvironmentV1 lives at stages.unified.EnvironmentV1), so a bare
 * name lookup must walk the tree. Returns the node plus its dotted path.
 *
 * A schema-node match (the value looks like a definition, per isSchemaNode)
 * wins. Failing that, the first key-name match of any shape is returned so a
 * bare wrapper definition still resolves rather than reporting "not found".
 */
function findDefinitionByName(
  root: Record<string, unknown>,
  name: string,
  maxDepth = 8,
): { node: unknown; path: string } | undefined {
  const stack: Array<{ node: unknown; path: string[] }> = [{ node: root, path: [] }];
  let fallback: { node: unknown; path: string } | undefined;
  let truncated = false;
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) continue;
    const { node, path } = entry;
    // Cap traversal depth as a guard against pathological/cyclic structures.
    // Record truncation so a too-deep definition surfaces a signal rather
    // than a silent miss — current bundled schemas nest only ~3 levels.
    if (path.length > maxDepth) {
      truncated = true;
      continue;
    }
    if (!node || typeof node !== "object" || Array.isArray(node)) continue;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === name) {
        if (isSchemaNode(value)) {
          return { node: value, path: [...path, key].join(".") };
        }
        if (!fallback) fallback = { node: value, path: [...path, key].join(".") };
      }
      if (value && typeof value === "object") {
        stack.push({ node: value, path: [...path, key] });
      }
    }
  }
  if (!fallback && truncated) {
    log.warn(`Schema search for '${name}' hit max depth ${maxDepth} without a match; a deeper definition may exist`);
  }
  return fallback;
}

/**
 * Resolution order: direct key -> literal dot-path -> recursive name search.
 * Returns the matched node and the dotted path it resolved to (which may
 * differ from the requested path when a bare nested name was supplied,
 * e.g. "EnvironmentV1" -> "stages.unified.EnvironmentV1").
 */
function navigateStaticPath(
  schema: Record<string, unknown>,
  resourceType: string,
  path: string,
): { node: unknown; path: string } | undefined {
  const definitions = schema.definitions as Record<string, unknown> | undefined;
  if (!definitions) return undefined;

  const resourceDefs = definitions[resourceType] as Record<string, unknown> | undefined;
  if (!resourceDefs) return undefined;

  if (resourceDefs[path]) return { node: resourceDefs[path], path };

  const parts = path.split(".");
  let current: unknown = resourceDefs;
  let dotPathValid = true;
  for (const part of parts) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      dotPathValid = false;
      break;
    }
  }
  if (dotPathValid && current !== undefined) return { node: current, path };

  // Fall back to a recursive search by the final path segment. Handles bare
  // definition names that are nested (e.g. "EnvironmentV1").
  const finalSegment = parts[parts.length - 1] ?? path;
  const found = findDefinitionByName(resourceDefs, finalSegment);
  if (found) return { node: found.node, path: found.path };

  return undefined;
}

function getStaticSummary(schema: Record<string, unknown>, resourceType: string): Record<string, unknown> {
  const definitions = schema.definitions as Record<string, Record<string, unknown>> | undefined;
  const harnessRootDef = definitions?.[resourceType]?.[resourceType] as Record<string, unknown> | undefined;
  const rootDef = harnessRootDef ?? (schema.properties ? schema : undefined) as Record<string, unknown> | undefined;

  const sections = definitions ? Object.keys(definitions[resourceType] ?? {}) : [];
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
    source: "harness-schema",
    fields,
    available_sections: sections,
    hint: "Use path parameter to drill into a section. E.g. path='trigger_source' for source structure, path='scheduled_trigger' for cron spec.",
  };
}

function listAvailableSchemaNames(
  staticSchemaKeys: string[],
  liveFetcher: ReturnType<typeof createLiveSchemaFetcher> | undefined,
): string[] {
  // Expose every bundled static key in the Zod enum so harness_schema({ resource_type: "pipeline" })
  // still validates when pipeline_v1 is also registered (schemas remain in allSchemas).
  const live = liveFetcher?.listResourceTypes() ?? LIVE_ENTITY_RESOURCE_TYPES;
  return [...staticSchemaKeys, ...live];
}

export function registerSchemaTool(
  server: McpServer,
  _registry: Registry | undefined,
  client: HarnessClient | undefined,
  additionalSchemas?: Record<string, SchemaEntry>,
): void {
  if (additionalSchemas) {
    for (const key of Object.keys(additionalSchemas)) {
      if (key in SCHEMAS) {
        throw new Error(`additionalSchemas key '${key}' conflicts with a built-in schema name`);
      }
    }
  }

  const allSchemas: Record<string, Record<string, unknown>> = additionalSchemas
    ? {
        ...SCHEMAS,
        ...Object.fromEntries(Object.entries(additionalSchemas).map(([k, v]) => [k, v.schema])),
      }
    : { ...SCHEMAS };

  const liveFetcher = client ? createLiveSchemaFetcher(client) : undefined;
  const availableSchemas = listAvailableSchemaNames(Object.keys(allSchemas), liveFetcher);
  const hasLiveEntities = liveFetcher !== undefined;

  server.registerTool(
    "harness_schema",
    {
      description:
        "Fetch Harness YAML schema or examples for a resource type. " +
        "Pipeline/template schemas are bundled from harness-schema; connector, environment, service, " +
        "secret, and infrastructure schemas are fetched live from NG /yaml-schema (pass scope, org_id, project_id). " +
        "Use without path for a summary of fields and available sections. " +
        "Use with path to drill into a specific section. " +
        "Use with example to fetch a named example YAML snippet. " +
        "Use with example_search to find examples by keyword. " +
        "Precedence: example > example_search > path > summary. " +
        `Available schemas: ${availableSchemas.join(", ")}.`,
      inputSchema: {
        resource_type: z
          .enum(availableSchemas as [string, ...string[]])
          .describe(
            `Schema to fetch. Available: ${availableSchemas.join(", ")}. Required for schema/path lookups, optional for example_search.`,
          )
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
          .describe(
            "Search examples by keyword. Returns matching example names and descriptions. Optionally combine with resource_type to filter.",
          ),
        scope: scopeSchema,
        org_id: z
          .string()
          .optional()
          .describe("Organization identifier — required when scope is org or project (live entity schemas)."),
        project_id: z
          .string()
          .optional()
          .describe("Project identifier — required when scope is project (live entity schemas)."),
      },
      outputSchema: schemaOutputSchema,
      annotations: {
        title: "Harness YAML Schema",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: hasLiveEntities,
      },
    },
    async (args) => {
      try {
        if (args.example) {
          const ex = getExample(args.example);
          if (!ex) {
            const available = args.resource_type
              ? getExamplesForResource(args.resource_type).map((e) => e.name)
              : [];
            return jsonResult({
              error: `Example '${args.example}' not found.` +
                (available.length
                  ? ` Available for ${args.resource_type}: ${available.join(", ")}`
                  : " Use example_search to find examples."),
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
            hint:
              results.length > 0
                ? "Use example='<name>' to fetch the full YAML for any result."
                : "No matches. Try a broader keyword or omit resource_type to search globally.",
          });
        }

        if (!args.resource_type) {
          return errorResult(
            "resource_type is required for schema lookups. Use example_search to search examples without specifying a resource type.",
          );
        }

        const isLive = liveFetcher?.isLiveEntity(args.resource_type) ?? false;

        if (isLive) {
          if (!liveFetcher) {
            return errorResult(
              "Live entity schemas require an authenticated Harness client. Configure HARNESS_API_KEY.",
            );
          }

          const fetched = await liveFetcher.fetch(args.resource_type, {
            scope: args.scope as HarnessYamlScope | undefined,
            orgId: args.org_id,
            projectId: args.project_id,
          });

          if (!fetched) {
            return errorResult(`Unknown live entity schema: ${args.resource_type}`);
          }

          const { schema, source } = fetched;

          if (!args.path) {
            return jsonResult(getEntitySchemaSummary(schema, args.resource_type, source));
          }

          const node = navigateEntitySchemaPath(schema, args.resource_type, args.path);
          if (!node) {
            const available = getDefinitionSections(schema, args.resource_type);
            return errorResult(
              `Path '${args.path}' not found in ${args.resource_type} schema. ` +
                `Available sections: ${available.join(", ")}`,
            );
          }

          const resolved = inlineRefs(schema as JsonObject, node);
          return jsonResult({
            resource_type: args.resource_type,
            path: args.path,
            source,
            schema: resolved,
          });
        }

        const schema = allSchemas[args.resource_type];
        if (!schema) {
          return errorResult(`Unknown schema: ${args.resource_type}`);
        }

        if (!args.path) {
          const summary = getStaticSummary(schema, args.resource_type);
          const examples = getExamplesForResource(args.resource_type);
          if (examples.length > 0) {
            (summary as Record<string, unknown>).examples_available = examples.map((e) => e.name);
          }
          return jsonResult(summary);
        }

        const match = navigateStaticPath(schema, args.resource_type, args.path);
        if (!match) {
          const definitions = schema.definitions as Record<string, Record<string, unknown>> | undefined;
          const available = definitions ? Object.keys(definitions[args.resource_type] ?? {}) : [];
          return errorResult(
            `Path '${args.path}' not found in ${args.resource_type} schema. ` +
              `Available sections: ${available.join(", ")}`,
          );
        }

        const resolved = inlineRefs(schema, match.node);
        return jsonResult({
          resource_type: args.resource_type,
          // Resolved path may be a nested dotted path when a bare definition
          // name was supplied (e.g. "EnvironmentV1").
          path: match.path,
          ...(match.path !== args.path ? { requested_path: args.path } : {}),
          source: "harness-schema",
          schema: resolved,
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
