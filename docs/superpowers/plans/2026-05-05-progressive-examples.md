# Progressive-Discovery Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browsable, searchable example YAML snippets to `harness_schema` so agents can progressively discover how to construct resources without being overwhelmed by full schemas.

**Architecture:** Examples are stored as typed TS arrays in `src/data/examples/`. The `harness_schema` tool gains two new optional params (`example` for exact fetch, `example_search` for keyword search). `harness_describe` surfaces the list of available example names per resource type. A shared registry module indexes all examples for search.

**Tech Stack:** TypeScript, Zod 4, existing MCP tool registration patterns.

---

## File Structure

| File | Purpose |
|------|---------|
| `src/data/examples/types.ts` | `ResourceExample` interface definition |
| `src/data/examples/index.ts` | Example registry: loads all example files, exports lookup/search functions |
| `src/data/examples/pipeline.ts` | V0 pipeline examples (minimal-ci, deploy-k8s, docker-build) |
| `src/data/examples/pipeline-v1.ts` | V1 pipeline examples (minimal-v1, agent-pipeline) |
| `src/tools/harness-schema.ts` | Add `example` and `example_search` params, dispatch to example registry |
| `src/tools/harness-describe.ts` | Add `examples_available` field to resource detail output |
| `tests/tools/harness-schema-examples.test.ts` | Tests for the new example fetch/search behavior |

---

### Task 1: Define the ResourceExample type

**Files:**
- Create: `src/data/examples/types.ts`

- [ ] **Step 1: Write the type definition file**

```typescript
// src/data/examples/types.ts
export interface ResourceExample {
  /** Unique name for this example, used to fetch it (e.g. 'minimal-ci') */
  name: string;
  /** Which resource_type this example belongs to (e.g. 'pipeline', 'pipeline_v1') */
  resourceType: string;
  /** One-line human description shown in search results */
  description: string;
  /** Searchable tags — matched during example_search */
  tags: string[];
  /** The actual YAML content */
  yaml: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/examples/types.ts
git commit -m "feat(examples): add ResourceExample type definition"
```

---

### Task 2: Create the example registry module

**Files:**
- Create: `src/data/examples/index.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/harness-schema-examples.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getExample, searchExamples, getExamplesForResource } from "../../src/data/examples/index.js";

describe("example registry", () => {
  it("getExample returns undefined for non-existent example", () => {
    expect(getExample("nonexistent")).toBeUndefined();
  });

  it("searchExamples returns empty array for no matches", () => {
    expect(searchExamples("zzz_no_match_zzz")).toEqual([]);
  });

  it("getExamplesForResource returns empty array for unknown resource type", () => {
    expect(getExamplesForResource("unknown_type")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/tools/harness-schema-examples.test.ts`
Expected: FAIL — module `../../src/data/examples/index.js` not found

- [ ] **Step 3: Write the example registry**

```typescript
// src/data/examples/index.ts
import type { ResourceExample } from "./types.js";

const ALL_EXAMPLES: ResourceExample[] = [];

/** Register examples from a module. Called by each example file. */
export function registerExamples(examples: ResourceExample[]): void {
  ALL_EXAMPLES.push(...examples);
}

/** Fetch a single example by exact name. */
export function getExample(name: string): ResourceExample | undefined {
  return ALL_EXAMPLES.find((e) => e.name === name);
}

/** Search examples by keyword. Matches against name, description, tags, and resourceType. */
export function searchExamples(query: string, resourceType?: string): ResourceExample[] {
  const q = query.toLowerCase();
  return ALL_EXAMPLES.filter((e) => {
    if (resourceType && e.resourceType !== resourceType) return false;
    return (
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.resourceType.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

/** Get all example names for a specific resource type. */
export function getExamplesForResource(resourceType: string): ResourceExample[] {
  return ALL_EXAMPLES.filter((e) => e.resourceType === resourceType);
}

/** Get all unique resource types that have examples. */
export function getResourceTypesWithExamples(): string[] {
  return [...new Set(ALL_EXAMPLES.map((e) => e.resourceType))];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/tools/harness-schema-examples.test.ts`
Expected: PASS (all three tests pass with empty registry)

- [ ] **Step 5: Commit**

```bash
git add src/data/examples/index.ts tests/tools/harness-schema-examples.test.ts
git commit -m "feat(examples): add example registry with lookup/search functions"
```

---

### Task 3: Add pipeline v0 examples

**Files:**
- Create: `src/data/examples/pipeline.ts`

- [ ] **Step 1: Write tests for v0 examples**

Add to `tests/tools/harness-schema-examples.test.ts`:

```typescript
import "../setup-examples.js"; // ensures examples are loaded

describe("pipeline v0 examples", () => {
  it("getExample('minimal-ci') returns a valid example", () => {
    const ex = getExample("minimal-ci");
    expect(ex).toBeDefined();
    expect(ex!.resourceType).toBe("pipeline");
    expect(ex!.yaml).toContain("pipeline:");
  });

  it("searchExamples('docker') finds docker-build example", () => {
    const results = searchExamples("docker");
    expect(results.some((r) => r.name === "docker-build")).toBe(true);
  });

  it("getExamplesForResource('pipeline') returns all v0 examples", () => {
    const results = getExamplesForResource("pipeline");
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.every((r) => r.resourceType === "pipeline")).toBe(true);
  });

  it("searchExamples with resourceType filter limits results", () => {
    const all = searchExamples("pipeline");
    const v0Only = searchExamples("pipeline", "pipeline");
    expect(v0Only.length).toBeLessThanOrEqual(all.length);
    expect(v0Only.every((r) => r.resourceType === "pipeline")).toBe(true);
  });
});
```

Create `tests/setup-examples.ts`:

```typescript
// Ensures all example modules are imported (side-effect: registers examples)
import "../src/data/examples/pipeline.js";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/tools/harness-schema-examples.test.ts`
Expected: FAIL — `../src/data/examples/pipeline.js` not found

- [ ] **Step 3: Write the v0 pipeline examples**

```typescript
// src/data/examples/pipeline.ts
import { registerExamples } from "./index.js";
import type { ResourceExample } from "./types.js";

const examples: ResourceExample[] = [
  {
    name: "minimal-ci",
    resourceType: "pipeline",
    description: "Minimal CI pipeline with a single build stage running tests",
    tags: ["ci", "build", "test", "minimal", "starter"],
    yaml: `pipeline:
  name: Build and Test
  identifier: build_and_test
  projectIdentifier: <+input>
  orgIdentifier: <+input>
  stages:
    - stage:
        name: Build
        identifier: build
        type: CI
        spec:
          cloneCodebase: true
          execution:
            steps:
              - step:
                  type: Run
                  name: Run Tests
                  identifier: run_tests
                  spec:
                    shell: Sh
                    command: |
                      npm install
                      npm test`,
  },
  {
    name: "deploy-k8s",
    resourceType: "pipeline",
    description: "Deploy to Kubernetes with rolling update strategy",
    tags: ["cd", "deploy", "kubernetes", "k8s", "rolling"],
    yaml: `pipeline:
  name: Deploy to K8s
  identifier: deploy_k8s
  projectIdentifier: <+input>
  orgIdentifier: <+input>
  stages:
    - stage:
        name: Deploy
        identifier: deploy
        type: Deployment
        spec:
          deploymentType: Kubernetes
          service:
            serviceRef: <+input>
          environment:
            environmentRef: <+input>
            infrastructureDefinitions:
              - identifier: <+input>
          execution:
            steps:
              - step:
                  type: K8sRollingDeploy
                  name: Rolling Deploy
                  identifier: rolling_deploy
                  spec:
                    skipDryRun: false
            rollbackSteps:
              - step:
                  type: K8sRollingRollback
                  name: Rollback
                  identifier: rollback
                  spec: {}`,
  },
  {
    name: "docker-build",
    resourceType: "pipeline",
    description: "Build and push Docker image to a container registry",
    tags: ["ci", "docker", "build", "push", "image", "container"],
    yaml: `pipeline:
  name: Docker Build and Push
  identifier: docker_build_push
  projectIdentifier: <+input>
  orgIdentifier: <+input>
  stages:
    - stage:
        name: Build Image
        identifier: build_image
        type: CI
        spec:
          cloneCodebase: true
          execution:
            steps:
              - step:
                  type: BuildAndPushDockerRegistry
                  name: Build and Push
                  identifier: build_and_push
                  spec:
                    connectorRef: <+input>
                    repo: <+input>
                    tags:
                      - latest
                      - <+pipeline.sequenceId>
                    caching: true`,
  },
];

registerExamples(examples);
export default examples;
```

- [ ] **Step 4: Update setup-examples.ts and run tests**

Run: `pnpm test tests/tools/harness-schema-examples.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/examples/pipeline.ts tests/setup-examples.ts
git commit -m "feat(examples): add v0 pipeline examples (minimal-ci, deploy-k8s, docker-build)"
```

---

### Task 4: Add pipeline v1 examples

**Files:**
- Create: `src/data/examples/pipeline-v1.ts`
- Modify: `tests/setup-examples.ts`

- [ ] **Step 1: Write tests for v1 examples**

Add to `tests/tools/harness-schema-examples.test.ts`:

```typescript
describe("pipeline v1 examples", () => {
  it("getExample('minimal-v1') returns a valid v1 example", () => {
    const ex = getExample("minimal-v1");
    expect(ex).toBeDefined();
    expect(ex!.resourceType).toBe("pipeline_v1");
    expect(ex!.yaml).toContain("pipeline:");
  });

  it("getExample('agent-pipeline') returns an agent pipeline example", () => {
    const ex = getExample("agent-pipeline");
    expect(ex).toBeDefined();
    expect(ex!.resourceType).toBe("pipeline_v1");
    expect(ex!.tags).toContain("agent");
  });

  it("searchExamples('agent') finds agent-pipeline", () => {
    const results = searchExamples("agent");
    expect(results.some((r) => r.name === "agent-pipeline")).toBe(true);
  });

  it("getExamplesForResource('pipeline_v1') returns only v1 examples", () => {
    const results = getExamplesForResource("pipeline_v1");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every((r) => r.resourceType === "pipeline_v1")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/tools/harness-schema-examples.test.ts`
Expected: FAIL — `getExample('minimal-v1')` returns undefined

- [ ] **Step 3: Write the v1 pipeline examples**

```typescript
// src/data/examples/pipeline-v1.ts
import { registerExamples } from "./index.js";
import type { ResourceExample } from "./types.js";

const examples: ResourceExample[] = [
  {
    name: "minimal-v1",
    resourceType: "pipeline_v1",
    description: "Minimal v1 pipeline with a single run step",
    tags: ["v1", "minimal", "starter", "ci", "simplified"],
    yaml: `pipeline:
  name: Simple Build
  identifier: simple_build
  stages:
    - name: build
      steps:
        - type: run
          spec:
            shell: sh
            command: |
              echo "Building..."
              npm install
              npm test`,
  },
  {
    name: "agent-pipeline",
    resourceType: "pipeline_v1",
    description: "AI agent pipeline with tools, MCP servers, and skills",
    tags: ["v1", "agent", "ai", "mcp", "tools", "agentic"],
    yaml: `pipeline:
  name: Code Review Agent
  identifier: code_review_agent
  version: 1
  stages:
    - name: review
      steps:
        - type: agent
          spec:
            model: claude-sonnet-4-6
            prompt: "Review the PR for correctness, security, and performance issues"
            tools:
              - name: read_file
              - name: search_code
            mcp_servers:
              - url: https://mcp.harness.io
            rules:
              - "Focus on security vulnerabilities"
              - "Check for breaking API changes"`,
  },
];

registerExamples(examples);
export default examples;
```

- [ ] **Step 4: Update setup-examples.ts**

```typescript
// tests/setup-examples.ts
import "../src/data/examples/pipeline.js";
import "../src/data/examples/pipeline-v1.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/tools/harness-schema-examples.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/data/examples/pipeline-v1.ts tests/setup-examples.ts
git commit -m "feat(examples): add v1 pipeline examples (minimal-v1, agent-pipeline)"
```

---

### Task 5: Wire examples into harness_schema tool

**Files:**
- Modify: `src/tools/harness-schema.ts`
- Modify: `src/data/examples/index.ts` (add auto-load)

- [ ] **Step 1: Write tests for schema tool example params**

Add to `tests/tools/harness-schema-examples.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSchemaTool } from "../../src/tools/harness-schema.js";

describe("harness_schema example params", () => {
  let server: McpServer;
  let callTool: (name: string, args: Record<string, unknown>) => Promise<any>;

  beforeAll(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    registerSchemaTool(server);
    // Extract the tool handler for direct invocation
    callTool = async (name, args) => {
      const tools = (server as any)._registeredTools;
      const tool = tools.get(name);
      return tool.handler(args);
    };
  });

  it("example param returns the named example YAML", async () => {
    const result = await callTool("harness_schema", {
      resource_type: "pipeline",
      example: "minimal-ci",
    });
    const content = JSON.parse(result.content[0].text);
    expect(content.name).toBe("minimal-ci");
    expect(content.yaml).toContain("pipeline:");
    expect(content.description).toBeDefined();
  });

  it("example param returns error for non-existent example", async () => {
    const result = await callTool("harness_schema", {
      resource_type: "pipeline",
      example: "nonexistent",
    });
    const content = JSON.parse(result.content[0].text);
    expect(content.error).toBeDefined();
    expect(content.available_examples).toBeDefined();
  });

  it("example_search returns matching examples", async () => {
    const result = await callTool("harness_schema", {
      resource_type: "pipeline",
      example_search: "docker",
    });
    const content = JSON.parse(result.content[0].text);
    expect(content.results.length).toBeGreaterThan(0);
    expect(content.results[0].name).toBeDefined();
    expect(content.results[0].description).toBeDefined();
  });

  it("example_search without resource_type searches globally", async () => {
    const result = await callTool("harness_schema", {
      example_search: "agent",
    });
    const content = JSON.parse(result.content[0].text);
    expect(content.results.some((r: any) => r.resourceType === "pipeline_v1")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/tools/harness-schema-examples.test.ts`
Expected: FAIL — `example` param not recognized

- [ ] **Step 3: Add auto-loading to example registry index**

Update `src/data/examples/index.ts` — add at the bottom:

```typescript
// Auto-load all example modules (side-effect imports)
import "./pipeline.js";
import "./pipeline-v1.js";
```

- [ ] **Step 4: Update harness_schema tool**

Modify `src/tools/harness-schema.ts` to add example/example_search params and dispatch logic:

```typescript
import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { createLogger } from "../utils/logger.js";
import { SCHEMAS, VALID_SCHEMAS } from "../data/schemas/index.js";
import { getExample, searchExamples, getExamplesForResource } from "../data/examples/index.js";

const log = createLogger("tool:harness-schema");

// ... (existing helper functions unchanged: resolveRef, inlineRefs, navigateToPath, getSummary)

export function registerSchemaTool(server: McpServer, registry?: Registry): void {
  const availableSchemas = VALID_SCHEMAS;

  server.registerTool(
    "harness_schema",
    {
      description:
        "Fetch Harness YAML schema or examples for a resource type. " +
        "Use without path for a summary of fields and available sections. " +
        "Use with path to drill into a specific section. " +
        "Use with example to fetch a named example YAML snippet. " +
        "Use with example_search to find examples by keyword. " +
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

        const schema = SCHEMAS[args.resource_type as keyof typeof SCHEMAS] as Record<string, unknown>;

        if (!args.path) {
          const summary = getSummary(schema, args.resource_type);
          // Add available examples to summary
          const examples = getExamplesForResource(args.resource_type);
          if (examples.length > 0) {
            (summary as any).examples_available = examples.map((e) => e.name);
          }
          return jsonResult(summary);
        }

        const node = navigateToPath(schema, args.resource_type, args.path);
        if (!node) {
          const definitions = schema.definitions as Record<string, Record<string, unknown>> | undefined;
          const available = definitions ? Object.keys(definitions[args.resource_type] ?? {}) : [];
          return errorResult(
            `Path '${args.path}' not found in ${args.resource_type} schema. ` +
            `Available sections: ${available.join(", ")}`,
          );
        }

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
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/tools/harness-schema-examples.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/tools/harness-schema.ts src/data/examples/index.ts
git commit -m "feat(examples): wire example/example_search params into harness_schema tool"
```

---

### Task 6: Surface examples in harness_describe

**Files:**
- Modify: `src/tools/harness-describe.ts`

- [ ] **Step 1: Write test for describe output**

Add to `tests/tools/harness-schema-examples.test.ts`:

```typescript
describe("harness_describe examples_available", () => {
  it("describe(resource_type='pipeline') includes examples_available", async () => {
    // This test validates the integration at the describe tool level.
    // The describe tool reads from the example registry, so after examples are loaded
    // the output should include the list of available example names.
    const examples = getExamplesForResource("pipeline");
    expect(examples.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Update harness-describe.ts**

In `src/tools/harness-describe.ts`, add the import and include examples in the resource detail response:

Add import at top:
```typescript
import { getExamplesForResource } from "../data/examples/index.js";
```

In the `args.resource_type` branch, after `executeHint`, add:

```typescript
const examplesForType = getExamplesForResource(def.resourceType);
```

And include in the returned object:
```typescript
...(examplesForType.length > 0
  ? { examples_available: examplesForType.map((e) => ({ name: e.name, description: e.description })) }
  : {}),
```

The full return in the `args.resource_type` block becomes:

```typescript
return jsonResult({
  resource_type: def.resourceType,
  displayName: def.displayName,
  description: def.description,
  toolset: def.toolset,
  scope: def.scope,
  identifierFields: def.identifierFields,
  listFilterFields: def.listFilterFields,
  operations: Object.entries(def.operations).map(([op, spec]) => ({
    operation: op,
    method: spec.method,
    description: spec.description,
    bodySchema: spec.bodySchema ?? undefined,
  })),
  executeActions: def.executeActions
    ? Object.entries(def.executeActions).map(([action, spec]) => ({
        action,
        method: spec.method,
        description: spec.actionDescription,
        bodySchema: spec.bodySchema ?? undefined,
        ...(spec.inputExpansions?.length
          ? { inputShorthands: buildShorthands(spec.inputExpansions) }
          : {}),
      }))
    : undefined,
  diagnosticHint: def.diagnosticHint ?? undefined,
  relatedResources: def.relatedResources ?? undefined,
  executeHint: def.executeHint ?? undefined,
  ...(examplesForType.length > 0
    ? { examples_available: examplesForType.map((e) => ({ name: e.name, description: e.description })) }
    : {}),
  hint: examplesForType.length > 0
    ? `Use harness_schema(resource_type='${def.resourceType}', example='<name>') to fetch a full example.`
    : undefined,
});
```

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/tools/harness-describe.ts
git commit -m "feat(examples): surface examples_available in harness_describe output"
```

---

### Task 7: Verify end-to-end with typecheck and full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: Clean — no errors

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Manually verify the schema tool input schema accepts new params**

Run: `pnpm build && node -e "import('./build/data/examples/index.js').then(m => { console.error('Examples loaded:', m.getResourceTypesWithExamples()); })"`
Expected: Prints resource types with examples (pipeline, pipeline_v1)

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address any issues from verification"
```

---

## Notes for Future Extension

To add examples for any new resource type:

1. Create `src/data/examples/<resource-type>.ts`
2. Export an array of `ResourceExample` objects with `registerExamples(examples)` call
3. Add the import to `src/data/examples/index.ts` auto-load section
4. Done — `harness_describe` and `harness_schema` automatically pick them up

No other files need modification. The registry auto-discovers via the import side-effect pattern.
