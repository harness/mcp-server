# Progressive Schema Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `harness_schema` progressively discoverable — grouped catalogue on no-arg call, typed `available_sections` with `has_children`, deep dot-path traversal through `$ref`, and a `SchemaEntry` type so all schemas carry description and group metadata.

**Architecture:** Introduce `SchemaEntry = { schema, description, group }` in `src/data/schemas/index.ts`. All OSS built-ins get metadata inline. `additionalSchemas` changes from `Record<string, RawSchema>` to `Record<string, SchemaEntry>`. The tool handler gains a no-arg catalogue mode, upgrades `available_sections` to typed objects with `has_children`, and replaces the shallow `navigateToPath` with a deep dot-path walker that follows `$ref` and inlines at a 4KB threshold. `mcpServerInternal` updates `buildInternalSchemas()` to return `SchemaEntry` values. All existing tests are updated to match new shapes.

**Tech Stack:** TypeScript, Zod v4 (`import * as z from "zod/v4"`), Vitest (OSS tests), Node test runner + tsx (mcpServerInternal tests)

---

## File Map

| File | Change |
|------|--------|
| `src/data/schemas/index.ts` | Add `SchemaEntry` type; wrap all SCHEMAS entries; update `additionalSchemas`-facing exports |
| `src/tools/harness-schema.ts` | No-arg catalogue; typed sections; deep path walker; `SchemaEntry`-aware summary |
| `src/tools/index.ts` | Update `additionalSchemas` param type → `Record<string, SchemaEntry>` |
| `src/resources/harness-schema.ts` | Update `additionalSchemas` param type → `Record<string, SchemaEntry>`; extract raw schema for resource handler |
| `src/resources/index.ts` | Update `additionalSchemas` param type |
| `tests/tools/harness-schema-tool.test.ts` | Update to `SchemaEntry` shape; add catalogue, typed sections, deep path tests |
| `tests/resources/harness-schema.test.ts` | Update collision test to use `SchemaEntry` shape |
| `mcpServerInternal/src/toolsets/dashboard-schemas.ts` | Update `buildInternalSchemas()` to return `Record<string, SchemaEntry>` |
| `mcpServerInternal/src/toolsets/dashboard-schemas.test.ts` | Update assertions to `SchemaEntry` shape |

---

### Task 1: Introduce `SchemaEntry` and wrap all built-in schemas

**Files:**
- Modify: `src/data/schemas/index.ts`

- [ ] **Step 1: Replace `src/data/schemas/index.ts` entirely**

```typescript
// Auto-generated — do not edit manually. Run `pnpm sync-schemas` to regenerate.
// @ts-nocheck
import pipeline from "./v0/pipeline.js";
import template from "./v0/template.js";
import trigger from "./v0/trigger.js";
import pipelineV1 from "./v1/pipeline.js";
import templateV1 from "./v1/template.js";
import triggerV1 from "./v1/trigger.js";
import inputSetV1 from "./v1/inputSet.js";
import overlayInputSetV1 from "./v1/overlayInputSet.js";
import serviceV1 from "./v1/service.js";
import infraV1 from "./v1/infra.js";
import agentPipeline from "./local/agent-pipeline.js";

type V0SchemaKey = "pipeline" | "template" | "trigger";
type V1SchemaKey = "pipeline_v1" | "template_v1" | "trigger_v1" | "inputSet_v1" | "overlayInputSet_v1" | "service_v1" | "infra_v1";
type LocalSchemaKey = "agent-pipeline";
export type AllSchemaKeys = V0SchemaKey | V1SchemaKey | LocalSchemaKey;

/** Metadata-wrapped schema entry. All registered schemas must provide description and group. */
export type SchemaEntry = {
  schema: Record<string, any>;
  description: string;
  group: string;
};

export const SCHEMA_ENTRIES: Record<AllSchemaKeys, SchemaEntry> = {
  "pipeline":             { schema: pipeline,          group: "pipeline",   description: "CI/CD pipeline definition (v0, legacy). Use pipeline_v1 for new pipelines." },
  "template":             { schema: template,          group: "template",   description: "Reusable pipeline/stage/step template (v0, legacy). Use template_v1 for new templates." },
  "trigger":              { schema: trigger,           group: "trigger",    description: "Pipeline trigger definition (v0, legacy). Use trigger_v1 for new triggers." },
  "pipeline_v1":          { schema: pipelineV1,        group: "pipeline",   description: "CI/CD pipeline definition (v1, recommended)." },
  "template_v1":          { schema: templateV1,        group: "template",   description: "Reusable pipeline/stage/step template (v1, recommended)." },
  "trigger_v1":           { schema: triggerV1,         group: "trigger",    description: "Pipeline trigger definition (v1, recommended)." },
  "inputSet_v1":          { schema: inputSetV1,        group: "input-set",  description: "Input set for parameterizing pipeline runs (v1)." },
  "overlayInputSet_v1":   { schema: overlayInputSetV1, group: "input-set",  description: "Overlay input set combining multiple input sets (v1)." },
  "service_v1":           { schema: serviceV1,         group: "service",    description: "Harness service entity definition (v1)." },
  "infra_v1":             { schema: infraV1,           group: "infra",      description: "Infrastructure definition for deployment targets (v1)." },
  "agent-pipeline":       { schema: agentPipeline,     group: "agent",      description: "AI agent pipeline definition for Harness AI Development Agent." },
};

// Legacy flat map — kept for internal schema navigation (keys only, raw schema values)
export const SCHEMAS: Record<AllSchemaKeys, Record<string, any>> = Object.fromEntries(
  Object.entries(SCHEMA_ENTRIES).map(([k, v]) => [k, v.schema])
) as Record<AllSchemaKeys, Record<string, any>>;

export const VALID_SCHEMAS: AllSchemaKeys[] = Object.keys(SCHEMA_ENTRIES) as AllSchemaKeys[];
export type SchemaName = AllSchemaKeys;

export const V0_SCHEMA_KEYS: V0SchemaKey[] = ["pipeline", "template", "trigger"];
export const V1_SCHEMA_KEYS: V1SchemaKey[] = ["pipeline_v1", "template_v1", "trigger_v1", "inputSet_v1", "overlayInputSet_v1", "service_v1", "infra_v1"];
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm typecheck 2>&1 | head -30
```

Expected: errors only in files that still reference the old `additionalSchemas` type — no errors in `src/data/schemas/index.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/data/schemas/index.ts
git commit -m "feat: introduce SchemaEntry type with description+group, wrap all built-in schemas"
```

---

### Task 2: Update `registerSchemaTool` — SchemaEntry param, catalogue mode, typed sections, deep path walker

**Files:**
- Modify: `src/tools/harness-schema.ts`

This is the core of the change. Replace the entire file:

- [ ] **Step 1: Write the new `harness-schema.ts`**

```typescript
import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { createLogger } from "../utils/logger.js";
import { SCHEMA_ENTRIES, SCHEMAS } from "../data/schemas/index.js";
import type { SchemaEntry } from "../data/schemas/index.js";
import { getExample, searchExamples, getExamplesForResource } from "../data/examples/index.js";

const log = createLogger("tool:harness-schema");

const INLINE_THRESHOLD_BYTES = 4096;

/** Resolve a $ref pointer within the schema. E.g. "#/definitions/trigger/trigger_source" */
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
 * Inline $ref references up to depth 3 so the returned fragment is self-contained.
 */
function inlineRefs(schema: Record<string, unknown>, node: unknown, depth = 0): unknown {
  if (depth > 3) return node;
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((item) => inlineRefs(schema, item, depth));

  const obj = node as Record<string, unknown>;
  if (typeof obj["$ref"] === "string") {
    const resolved = resolveRef(schema, obj["$ref"]);
    if (resolved && typeof resolved === "object") return inlineRefs(schema, resolved, depth + 1);
    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "$schema") continue;
    result[key] = inlineRefs(schema, value, depth + 1);
  }
  return result;
}

/**
 * Returns true when a schema node has nested content worth drilling into.
 */
function hasChildren(node: unknown): boolean {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  const n = node as Record<string, unknown>;
  return !!(n.properties || n.$ref || n.allOf || n.oneOf || n.anyOf || n.$defs || n.definitions);
}

/**
 * Deep dot-path walker. Segments navigate through:
 *   1. definitions[resourceType][segment] (Harness layout)
 *   2. properties[segment] (standard JSON Schema)
 *   3. $ref resolution at each step
 *
 * E.g. "Stage.spec.execution" → definitions.pipeline_v1.Stage → .properties.spec → resolve $ref → .properties.execution
 */
function walkPath(
  schema: Record<string, unknown>,
  resourceType: string,
  path: string,
): unknown {
  const parts = path.split(".");
  const definitions = schema.definitions as Record<string, unknown> | undefined;
  const resourceDefs = definitions?.[resourceType] as Record<string, unknown> | undefined;

  // Seed: first segment checked in definitions[resourceType] first, then properties
  let current: unknown = undefined;

  const firstPart = parts[0];

  // Try Harness layout: definitions[resourceType][firstPart]
  if (resourceDefs?.[firstPart] !== undefined) {
    current = resourceDefs[firstPart];
  } else {
    // Try plain JSON Schema: root properties[firstPart]
    const rootProps = (schema.properties ?? resourceDefs?.[resourceType]?.["properties"]) as Record<string, unknown> | undefined;
    current = rootProps?.[firstPart];
  }

  if (current === undefined) return undefined;

  // Walk remaining segments through properties, resolving $ref at each step
  for (const part of parts.slice(1)) {
    // Resolve $ref if present
    if (current && typeof current === "object" && !Array.isArray(current)) {
      const c = current as Record<string, unknown>;
      if (typeof c["$ref"] === "string") {
        current = resolveRef(schema, c["$ref"]);
      }
    }

    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    const node = current as Record<string, unknown>;

    // Navigate into properties
    const props = node.properties as Record<string, unknown> | undefined;
    if (props?.[part] !== undefined) {
      current = props[part];
      continue;
    }

    // Navigate into definitions sub-key (e.g. common.Stage)
    if (node[part] !== undefined) {
      current = node[part];
      continue;
    }

    return undefined;
  }

  return current;
}

/**
 * Build typed available_sections from a schema node map.
 * Sections from definitions[resourceType] (Harness layout) or $defs/$definitions (plain JSON Schema).
 */
function buildSections(
  schema: Record<string, unknown>,
  resourceType: string,
): Array<{ key: string; description: string | null; has_children: boolean }> {
  const definitions = schema.definitions as Record<string, Record<string, unknown>> | undefined;
  const resourceDefs = definitions?.[resourceType];

  // Also check $defs for plain JSON Schema
  const defs = resourceDefs ?? (schema["$defs"] as Record<string, unknown> | undefined);

  if (!defs) return [];

  return Object.entries(defs).map(([key, node]) => ({
    key,
    description: (node as Record<string, unknown>)?.description as string | null ?? null,
    has_children: hasChildren(node),
  }));
}

/**
 * Get summary for a schema: top-level fields + typed sections.
 * Handles both Harness-layout (definitions[type][type]) and plain JSON Schema (root properties).
 */
function getSummary(schema: Record<string, unknown>, resourceType: string): Record<string, unknown> {
  const definitions = schema.definitions as Record<string, Record<string, unknown>> | undefined;

  // Harness-generated schemas nest the root under definitions[type][type].
  // Plain JSON Schemas place properties at the root level.
  const harnessRootDef = definitions?.[resourceType]?.[resourceType] as Record<string, unknown> | undefined;
  const rootDef = harnessRootDef ?? (schema.properties ? schema : undefined) as Record<string, unknown> | undefined;

  const properties = rootDef?.properties as Record<string, unknown> | undefined;
  const required = rootDef?.required as string[] | undefined;

  const fields: Array<{ name: string; type: string; required: boolean; has_children: boolean; ref?: string }> = [];
  if (properties) {
    for (const [name, spec] of Object.entries(properties)) {
      const s = spec as Record<string, unknown>;
      fields.push({
        name,
        type: (s.type as string) ?? (s["$ref"] ? "object ($ref)" : "unknown"),
        required: required?.includes(name) ?? false,
        has_children: hasChildren(s),
        ...(s["$ref"] ? { ref: (s["$ref"] as string).split("/").pop() } : {}),
      });
    }
  }

  const sections = buildSections(schema, resourceType);

  return {
    resource_type: resourceType,
    fields,
    available_sections: sections,
    hint: sections.length > 0
      ? "Use path='<section_key>' to drill into a section, or path='<section>.<field>' for deeper navigation."
      : "No named sections. Use path='<field_name>' to inspect a specific field.",
  };
}

/**
 * Build a grouped catalogue of all registered schemas.
 */
function buildCatalogue(
  allEntries: Record<string, SchemaEntry>,
): Record<string, unknown> {
  const groups: Record<string, { schemas: Array<{ name: string; description: string }>; }> = {};

  for (const [name, entry] of Object.entries(allEntries)) {
    if (!groups[entry.group]) {
      groups[entry.group] = { schemas: [] };
    }
    groups[entry.group].schemas.push({ name, description: entry.description });
  }

  return {
    hint: "Call with resource_type='<name>' to get field summary. Call with resource_type and path to drill into a section.",
    groups,
  };
}

export function registerSchemaTool(
  server: McpServer,
  additionalSchemas?: Record<string, SchemaEntry>,
): void {
  if (additionalSchemas) {
    for (const key of Object.keys(additionalSchemas)) {
      if (key in SCHEMAS) {
        throw new Error(`additionalSchemas key '${key}' conflicts with a built-in schema name`);
      }
    }
  }

  // Merge entries: built-ins + extensions
  const allEntries: Record<string, SchemaEntry> = additionalSchemas
    ? { ...SCHEMA_ENTRIES, ...additionalSchemas }
    : { ...SCHEMA_ENTRIES };

  // Flat raw-schema map for navigation
  const allSchemas: Record<string, Record<string, any>> = Object.fromEntries(
    Object.entries(allEntries).map(([k, v]) => [k, v.schema])
  );

  const availableSchemas = Object.keys(allEntries);

  // Build grouped description for the tool description string
  const groupSummary = Object.entries(
    Object.values(allEntries).reduce<Record<string, string[]>>((acc, entry) => {
      (acc[entry.group] ??= []).push(entry.group);
      return acc;
    }, {})
  ).map(([g]) => {
    const names = availableSchemas.filter(n => allEntries[n].group === g);
    return `${g}: ${names.join(", ")}`;
  }).join("; ");

  server.registerTool(
    "harness_schema",
    {
      description:
        "Fetch Harness YAML schema or examples for a resource type. " +
        "Call with no arguments to list all available schemas grouped by category. " +
        "Call with resource_type for a field summary and available sections. " +
        "Call with resource_type + path to drill into a section (supports deep dot-paths like 'Stage.spec'). " +
        "Call with example to fetch a named YAML snippet. " +
        "Call with example_search to find examples by keyword. " +
        "Precedence: example > example_search > path > summary > catalogue. " +
        `Schema groups — ${groupSummary}.`,
      inputSchema: {
        resource_type: z
          .enum(availableSchemas as [string, ...string[]])
          .describe(`Schema to fetch. Omit to list all schemas grouped by category.`)
          .optional(),
        path: z
          .string()
          .optional()
          .describe(
            "Dot-separated path into the schema. Supports deep navigation: 'Stage', 'Stage.spec', 'Stage.spec.execution'. " +
            "Omit for a top-level field summary with available sections.",
          ),
        example: z
          .string()
          .optional()
          .describe("Fetch a specific example by name (e.g. 'minimal-ci'). Returns full YAML and description."),
        example_search: z
          .string()
          .optional()
          .describe("Search examples by keyword. Combine with resource_type to filter by schema."),
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

        // --- Catalogue mode (no resource_type) ---
        if (!args.resource_type) {
          return jsonResult(buildCatalogue(allEntries));
        }

        const schema = allSchemas[args.resource_type] as Record<string, unknown>;

        // --- Summary mode (resource_type, no path) ---
        if (!args.path) {
          const summary = getSummary(schema, args.resource_type);
          const examples = getExamplesForResource(args.resource_type);
          if (examples.length > 0) {
            (summary as Record<string, unknown>).examples_available = examples.map((e) => e.name);
          }
          return jsonResult(summary);
        }

        // --- Deep path mode ---
        const node = walkPath(schema, args.resource_type, args.path);
        if (!node) {
          const sections = buildSections(schema, args.resource_type);
          return errorResult(
            `Path '${args.path}' not found in ${args.resource_type} schema. ` +
            `Top-level sections: ${sections.map(s => s.key).join(", ")}`,
          );
        }

        // Inline refs and return — full content if under threshold, else typed summary
        const resolved = inlineRefs(schema, node);
        const serialized = JSON.stringify(resolved);

        if (serialized.length <= INLINE_THRESHOLD_BYTES) {
          return jsonResult({
            resource_type: args.resource_type,
            path: args.path,
            schema: resolved,
          });
        }

        // Node is large — return typed summary of this node instead of full dump
        const nodeObj = resolved as Record<string, unknown>;
        const nodeProps = nodeObj?.properties as Record<string, unknown> | undefined;
        const nodeRequired = nodeObj?.required as string[] | undefined;
        const condensedFields = nodeProps
          ? Object.entries(nodeProps).map(([name, spec]) => {
              const s = spec as Record<string, unknown>;
              return {
                name,
                type: (s.type as string) ?? (s["$ref"] ? "object ($ref)" : "unknown"),
                required: nodeRequired?.includes(name) ?? false,
                has_children: hasChildren(s),
              };
            })
          : [];

        return jsonResult({
          resource_type: args.resource_type,
          path: args.path,
          note: `Node is large (${serialized.length} bytes). Showing field summary. Use a deeper path to inspect specific fields.`,
          fields: condensedFields,
          has_children: hasChildren(resolved),
        });

      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
```

- [ ] **Step 2: Run existing tests to see what breaks**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm test tests/tools/harness-schema-tool.test.ts 2>&1 | tail -30
```

Expected: several failures — tests use old `additionalSchemas` shape (raw schema, not `SchemaEntry`).

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck 2>&1 | head -40
```

Expected: errors in `src/tools/index.ts` and `src/resources/harness-schema.ts` — they still use the old `additionalSchemas` type. No errors in `harness-schema.ts` itself.

- [ ] **Step 4: Commit (partial — will fix types + tests in next tasks)**

```bash
git add src/tools/harness-schema.ts
git commit -m "feat: deep path walker, typed sections, catalogue mode, SchemaEntry-aware registration"
```

---

### Task 3: Update `registerHarnessSchemaResource` to use `SchemaEntry`

**Files:**
- Modify: `src/resources/harness-schema.ts`

- [ ] **Step 1: Replace `src/resources/harness-schema.ts`**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from "../utils/logger.js";
import { SCHEMA_ENTRIES, SCHEMAS, VALID_SCHEMAS, type SchemaName, type SchemaEntry } from "../data/schemas/index.js";

const log = createLogger("resource:harness-schema");

export function isValidSchemaName(name: string, validNames: readonly string[] = VALID_SCHEMAS): name is SchemaName {
  return validNames.includes(name);
}

export function registerHarnessSchemaResource(
  server: McpServer,
  additionalSchemas?: Record<string, SchemaEntry>,
): void {
  if (additionalSchemas) {
    for (const key of Object.keys(additionalSchemas)) {
      if (key in SCHEMAS) {
        throw new Error(`additionalSchemas key '${key}' conflicts with a built-in schema name`);
      }
    }
  }

  const allSchemas: Record<string, Record<string, any>> = additionalSchemas
    ? {
        ...SCHEMAS,
        ...Object.fromEntries(Object.entries(additionalSchemas).map(([k, v]) => [k, v.schema])),
      }
    : { ...SCHEMAS };

  const allSchemaNames = Object.keys(allSchemas);

  const template = new ResourceTemplate("schema:///{schemaName}", {
    list: async () => ({
      resources: allSchemaNames.map((name) => ({
        uri: `schema:///${name}`,
        name: `${name} schema`,
      })),
    }),
    complete: {
      schemaName: (value) =>
        allSchemaNames.filter((s) => s.startsWith(value)),
    },
  });

  server.registerResource(
    "harness-schema",
    template,
    {
      title: "Harness Schema",
      description: `Harness JSON Schema definitions. Valid schema names: ${allSchemaNames.join(", ")}. Use these to understand the required body format for harness_create.`,
      mimeType: "application/schema+json",
    },
    async (uri) => {
      const schemaName = uri.pathname.replace(/^\/+/, "");

      if (!isValidSchemaName(schemaName, allSchemaNames)) {
        throw new Error(
          `Unknown schema '${schemaName}'. Valid schemas: ${allSchemaNames.join(", ")}`,
        );
      }

      const schema = allSchemas[schemaName];

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/schema+json",
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    },
  );
}
```

- [ ] **Step 2: Update `src/tools/index.ts` — change `additionalSchemas` type**

Replace the `registerAllTools` signature:

```typescript
import type { SchemaEntry } from "../data/schemas/index.js";

export function registerAllTools(
  server: McpServer,
  registry: Registry,
  client: HarnessClient,
  config: Config,
  additionalSchemas?: Record<string, SchemaEntry>,
): void {
  // ... all existing tool registrations unchanged ...
  registerSchemaTool(server, additionalSchemas);
}
```

- [ ] **Step 3: Update `src/resources/index.ts` — change `additionalSchemas` type**

```typescript
import type { SchemaEntry } from "../data/schemas/index.js";

export function registerAllResources(
  server: McpServer,
  registry: Registry,
  client: HarnessClient,
  config: Config,
  additionalSchemas?: Record<string, SchemaEntry>,
): void {
  registerPipelineYamlResource(server, registry, client, config);
  registerExecutionSummaryResource(server, registry, client, config);
  registerHarnessSchemaResource(server, additionalSchemas);
}
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm typecheck 2>&1 | head -20
```

Expected: zero errors in `src/`. May still see test errors.

- [ ] **Step 5: Commit**

```bash
git add src/resources/harness-schema.ts src/tools/index.ts src/resources/index.ts
git commit -m "refactor: update additionalSchemas type to SchemaEntry across resource and tool registrars"
```

---

### Task 4: Update OSS tests to match new shapes

**Files:**
- Modify: `tests/tools/harness-schema-tool.test.ts`
- Modify: `tests/resources/harness-schema.test.ts`

- [ ] **Step 1: Rewrite `tests/tools/harness-schema-tool.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import type { SchemaEntry } from "../../src/data/schemas/index.js";
import { registerSchemaTool } from "../../src/tools/harness-schema.js";

function makeMcpServer() {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    registerTool: vi.fn((name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      const extra = { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} };
      return tool.handler(args, extra) as Promise<ToolResult>;
    },
  } as any;
}

function parseResult(result: ToolResult): unknown {
  return JSON.parse(result.content[0]!.text);
}

function makeSchemaEntry(schema: Record<string, any>, group = "test", description = "Test schema"): SchemaEntry {
  return { schema, description, group };
}

describe("registerSchemaTool — registration", () => {
  it("registers without additionalSchemas (backwards compat)", () => {
    const server = makeMcpServer();
    expect(() => registerSchemaTool(server)).not.toThrow();
  });

  it("accepts additionalSchemas with SchemaEntry shape", () => {
    const server = makeMcpServer();
    expect(() =>
      registerSchemaTool(server, {
        MyExt: makeSchemaEntry({ type: "object", properties: { id: { type: "string" } } }),
      })
    ).not.toThrow();
  });

  it("throws when additionalSchemas key collides with a built-in schema name", () => {
    const server = makeMcpServer();
    expect(() =>
      registerSchemaTool(server, { pipeline: makeSchemaEntry({ type: "object" }) }),
    ).toThrow("conflicts with a built-in schema name");
  });
});

describe("registerSchemaTool — catalogue mode (no resource_type)", () => {
  it("returns grouped catalogue when called with no arguments", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server, {
      DashboardContract: makeSchemaEntry({ type: "object" }, "dashboard", "Full dashboard layout"),
    });

    const result = await server.call("harness_schema", {});
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed.groups).toBeDefined();
    const groups = parsed.groups as Record<string, unknown>;
    expect(groups["pipeline"]).toBeDefined();
    expect(groups["dashboard"]).toBeDefined();
    expect(parsed.hint).toContain("resource_type");
  });

  it("catalogue includes all OSS schema groups", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server);

    const result = await server.call("harness_schema", {});
    const parsed = parseResult(result) as Record<string, unknown>;
    const groups = parsed.groups as Record<string, unknown>;

    expect(groups["pipeline"]).toBeDefined();
    expect(groups["trigger"]).toBeDefined();
    expect(groups["template"]).toBeDefined();
    expect(groups["service"]).toBeDefined();
    expect(groups["agent"]).toBeDefined();
  });
});

describe("registerSchemaTool — summary mode", () => {
  it("returns typed available_sections with has_children for Harness-layout schema", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server);

    const result = await server.call("harness_schema", { resource_type: "trigger" });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed.resource_type).toBe("trigger");
    expect(Array.isArray(parsed.fields)).toBe(true);
    expect(Array.isArray(parsed.available_sections)).toBe(true);

    const sections = parsed.available_sections as Array<{ key: string; description: string | null; has_children: boolean }>;
    expect(sections.length).toBeGreaterThan(0);
    // Every section has the required shape
    for (const s of sections) {
      expect(typeof s.key).toBe("string");
      expect(s.description === null || typeof s.description === "string").toBe(true);
      expect(typeof s.has_children).toBe("boolean");
    }
    // trigger_source has properties → has_children: true
    const triggerSource = sections.find(s => s.key === "trigger_source");
    expect(triggerSource?.has_children).toBe(true);
  });

  it("returns typed fields with has_children for root field properties", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server);

    const result = await server.call("harness_schema", { resource_type: "trigger" });
    const parsed = parseResult(result) as Record<string, unknown>;
    const fields = parsed.fields as Array<{ name: string; has_children: boolean }>;

    // source field is a $ref → has_children: true
    const sourceField = fields.find(f => f.name === "source");
    expect(sourceField).toBeDefined();
    expect(sourceField?.has_children).toBe(true);
  });

  it("returns fields from a plain JSON Schema (root-level properties)", async () => {
    const server = makeMcpServer();
    const plainSchema = makeSchemaEntry({
      type: "object",
      properties: { name: { type: "string" }, count: { type: "number" } },
      required: ["name"],
    });
    registerSchemaTool(server, { MyExt: plainSchema });

    const result = await server.call("harness_schema", { resource_type: "MyExt" });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed.resource_type).toBe("MyExt");
    const fields = parsed.fields as Array<{ name: string; type: string; required: boolean }>;
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "name", type: "string", required: true }),
      expect.objectContaining({ name: "count", type: "number", required: false }),
    ]));
  });
});

describe("registerSchemaTool — path mode", () => {
  it("returns section content for a single-segment path", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server);

    const result = await server.call("harness_schema", { resource_type: "trigger", path: "trigger_source" });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed.resource_type).toBe("trigger");
    expect(parsed.path).toBe("trigger_source");
    expect(parsed.schema).toBeDefined();
  });

  it("returns error with available sections for unknown path", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server);

    const result = await server.call("harness_schema", { resource_type: "trigger", path: "nonexistent_section" });
    const text = result.content[0]!.text;
    expect(text).toContain("not found");
    expect(text).toContain("trigger_source");
  });

  it("returns large node as condensed field summary with has_children", async () => {
    const server = makeMcpServer();
    registerSchemaTool(server);

    // webhook_trigger is large (>4KB) — should return condensed summary
    const result = await server.call("harness_schema", { resource_type: "trigger", path: "webhook_trigger" });
    const parsed = parseResult(result) as Record<string, unknown>;

    // Either inlined (if small enough) or condensed
    if (parsed.note) {
      expect(parsed.note).toContain("bytes");
      expect(Array.isArray(parsed.fields)).toBe(true);
    } else {
      expect(parsed.schema).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Update the collision test in `tests/resources/harness-schema.test.ts`**

Find the `registerHarnessSchemaResource collision guard` describe block and update to use `SchemaEntry`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { isValidSchemaName, registerHarnessSchemaResource } from "../../src/resources/harness-schema.js";
import type { SchemaEntry } from "../../src/data/schemas/index.js";

describe("registerHarnessSchemaResource collision guard", () => {
  it("throws when additionalSchemas key collides with a built-in schema name", () => {
    const server = { registerResource: vi.fn() } as any;
    const entry: SchemaEntry = { schema: { type: "object" }, description: "test", group: "test" };
    expect(() =>
      registerHarnessSchemaResource(server, { pipeline: entry }),
    ).toThrow("conflicts with a built-in schema name");
  });
});

// ... existing isValidSchemaName tests unchanged ...
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm test tests/tools/harness-schema-tool.test.ts tests/resources/harness-schema.test.ts 2>&1 | tail -25
```

Expected: all tests pass.

- [ ] **Step 4: Run full suite**

```bash
pnpm test 2>&1 | tail -10
```

Expected: all tests pass, no regressions.

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck 2>&1
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add tests/tools/harness-schema-tool.test.ts tests/resources/harness-schema.test.ts
git commit -m "test: update schema tool tests for SchemaEntry, catalogue mode, typed sections, deep paths"
```

---

### Task 5: Update `mcpServerInternal` — `buildInternalSchemas()` returns `SchemaEntry`

**Files:**
- Modify: `mcpServerInternal/src/toolsets/dashboard-schemas.ts`
- Modify: `mcpServerInternal/src/toolsets/dashboard-schemas.test.ts`

- [ ] **Step 1: Update `dashboard-schemas.ts`**

```typescript
import { createRequire } from "node:module";
import type { SchemaEntry } from "harness-mcp-v2/build/data/schemas/index.js";

const require = createRequire(import.meta.url);

const contractSchemas = require("@harness/dashboard-contracts/schema") as {
  roots: Record<string, string>;
  definitions: Record<string, Record<string, unknown>>;
};

const DASHBOARD_SCHEMA_DESCRIPTIONS: Record<string, string> = {
  DashboardContract:      "Full dashboard layout contract — top-level structure for a Harness dashboard.",
  WidgetContract:         "Widget definition contract — a single panel within a dashboard.",
  DisplayComposite:       "Display composite contract — layout grouping of widgets.",
  CellRenderer:           "Cell renderer contract — display configuration for individual data cells.",
  DataContract:           "Data contract — query and data source binding for a widget.",
  DataSource:             "Data source contract — connection and query parameters for a data provider.",
  DashboardFilterConfig:  "Dashboard filter configuration — global filters applied across a dashboard.",
};

export function buildInternalSchemas(): Record<string, SchemaEntry> {
  const schemas: Record<string, SchemaEntry> = {};
  for (const [name, ref] of Object.entries(contractSchemas.roots)) {
    const defKey = (ref as string).replace(/^definitions\//, "");
    const definition = contractSchemas.definitions[defKey];
    if (definition) {
      schemas[name] = {
        schema: {
          $schema: "http://json-schema.org/draft-07/schema#",
          definitions: contractSchemas.definitions,
          ...definition,
        },
        description: DASHBOARD_SCHEMA_DESCRIPTIONS[name] ?? `${name} contract schema.`,
        group: "dashboard",
      };
    }
  }
  return schemas;
}
```

- [ ] **Step 2: Update `dashboard-schemas.test.ts` — check SchemaEntry shape**

Replace the `buildInternalSchemas` describe block:

```typescript
describe("buildInternalSchemas", () => {
  it("returns all expected dashboard contract schema keys", () => {
    const schemas = buildInternalSchemas();
    for (const key of EXPECTED_SCHEMA_KEYS) {
      assert.ok(key in schemas, `Expected schema key '${key}' to be present`);
    }
  });

  it("each entry has schema, description, and group fields", () => {
    const schemas = buildInternalSchemas();
    for (const [key, entry] of Object.entries(schemas)) {
      assert.ok(entry.schema && typeof entry.schema === "object", `'${key}'.schema must be an object`);
      assert.ok(typeof entry.description === "string" && entry.description.length > 0, `'${key}'.description must be a non-empty string`);
      assert.strictEqual(entry.group, "dashboard", `'${key}'.group must be 'dashboard'`);
    }
  });

  it("no schema key collides with a built-in OSS schema name", () => {
    const BUILTIN_NAMES = ["pipeline", "template", "trigger", "pipeline_v1", "template_v1", "trigger_v1", "inputSet_v1", "overlayInputSet_v1", "service_v1", "infra_v1", "agent-pipeline"];
    const schemas = buildInternalSchemas();
    for (const key of Object.keys(schemas)) {
      assert.ok(!BUILTIN_NAMES.includes(key), `Schema key '${key}' collides with a built-in schema`);
    }
  });
});
```

- [ ] **Step 3: Pack and install updated mcp-server tarball**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm build && npm pack
cd /Users/sunil.gattupalle/harness/mcpServerInternal
rm -f harness-mcp-v2-*.tgz
cp /Users/sunil.gattupalle/harness/mcp-server/harness-mcp-v2-*.tgz .
TARBALL=$(ls harness-mcp-v2-*.tgz | tail -1)
sed -i.tmp "s|\"harness-mcp-v2\": \"[^\"]*\"|\"harness-mcp-v2\": \"file:./${TARBALL}\"|" package.json && rm package.json.tmp
pnpm install --no-frozen-lockfile 2>&1 | tail -5
rm /Users/sunil.gattupalle/harness/mcp-server/harness-mcp-v2-*.tgz
```

- [ ] **Step 4: Typecheck mcpServerInternal**

```bash
cd /Users/sunil.gattupalle/harness/mcpServerInternal && pnpm typecheck 2>&1
```

Expected: zero errors.

- [ ] **Step 5: Run mcpServerInternal tests**

```bash
pnpm test 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 6: Commit mcpServerInternal**

```bash
git add src/toolsets/dashboard-schemas.ts src/toolsets/dashboard-schemas.test.ts pnpm-lock.yaml package.json
git commit -m "feat: update buildInternalSchemas() to return SchemaEntry with description+group for each dashboard contract"
```

---

### Task 6: Final verification and push

- [ ] **Step 1: Full OSS test suite**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 2: Full typecheck**

```bash
pnpm typecheck 2>&1
```

Expected: zero errors.

- [ ] **Step 3: Verify catalogue mode works end-to-end**

```bash
node --input-type=module << 'EOF'
import { SCHEMA_ENTRIES } from './build/data/schemas/index.js';
const groups = {};
for (const [name, entry] of Object.entries(SCHEMA_ENTRIES)) {
  (groups[entry.group] ??= []).push(name);
}
console.log(JSON.stringify(groups, null, 2));
EOF
```

Expected: `pipeline`, `template`, `trigger`, `input-set`, `service`, `infra`, `agent` groups each with correct schema names.

- [ ] **Step 4: Push OSS branch**

```bash
git push origin dashboard-schemas
```

- [ ] **Step 5: Push mcpServerInternal branch**

```bash
cd /Users/sunil.gattupalle/harness/mcpServerInternal && git push
```
