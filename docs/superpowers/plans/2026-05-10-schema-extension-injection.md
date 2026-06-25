# Schema Extension Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global-mutable `registerSchema()` pattern with explicit `additionalSchemas` parameter injection so extension servers can add schemas at registration time without ordering constraints or global state mutation.

**Architecture:** `registerSchemaTool()` and `registerHarnessSchemaResource()` each accept an optional `additionalSchemas` parameter. At registration time they merge `SCHEMAS` with `additionalSchemas` into a local object and build the Zod enum from its keys. `SCHEMAS` and `VALID_SCHEMAS` revert to their original static, typed form. `registerAllTools` and `registerAllResources` thread the optional parameter through.

**Tech Stack:** TypeScript, Zod v4 (`import * as z from "zod/v4"`), `@modelcontextprotocol/sdk`, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/data/schemas/index.ts` | Revert `SCHEMAS` to `Record<AllSchemaKeys, ...>`, revert `VALID_SCHEMAS` to `AllSchemaKeys[]`, revert `SchemaName` to `AllSchemaKeys`, remove `registerSchema()` |
| `src/tools/harness-schema.ts` | Add `additionalSchemas` param to `registerSchemaTool()`, merge locally, use merged object throughout |
| `src/resources/harness-schema.ts` | Add `additionalSchemas` param to `registerHarnessSchemaResource()`, merge locally, pass merged set to `isValidSchemaName` |
| `src/tools/index.ts` | Add `additionalSchemas` optional param to `registerAllTools()`, pass through to `registerSchemaTool()` |
| `src/resources/index.ts` | Add `additionalSchemas` optional param to `registerAllResources()`, pass through to `registerHarnessSchemaResource()` |
| `tests/resources/harness-schema.test.ts` | Update `isValidSchemaName` tests to use new signature; add test for extension schema injection |
| `tests/tools/harness-schema-tool.test.ts` | New file — tests for `registerSchemaTool` with `additionalSchemas` |

---

### Task 1: Revert `src/data/schemas/index.ts` to static form

**Files:**
- Modify: `src/data/schemas/index.ts`

- [ ] **Step 1: Replace the file content**

Replace the entire file with:

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

export const SCHEMAS: Record<AllSchemaKeys, Record<string, any>> = {
  "pipeline": pipeline,
  "template": template,
  "trigger": trigger,
  "pipeline_v1": pipelineV1,
  "template_v1": templateV1,
  "trigger_v1": triggerV1,
  "inputSet_v1": inputSetV1,
  "overlayInputSet_v1": overlayInputSetV1,
  "service_v1": serviceV1,
  "infra_v1": infraV1,
  "agent-pipeline": agentPipeline,
};

export const VALID_SCHEMAS: AllSchemaKeys[] = Object.keys(SCHEMAS) as AllSchemaKeys[];
export type SchemaName = AllSchemaKeys;

export const V0_SCHEMA_KEYS: V0SchemaKey[] = ["pipeline", "template", "trigger"];
export const V1_SCHEMA_KEYS: V1SchemaKey[] = ["pipeline_v1", "template_v1", "trigger_v1", "inputSet_v1", "overlayInputSet_v1", "service_v1", "infra_v1"];
```

Note: `AllSchemaKeys` is now exported (needed by consumers building merged schema maps).

- [ ] **Step 2: Typecheck**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm typecheck 2>&1 | head -40
```

Expected: errors only in files we haven't updated yet (`harness-schema.ts` references to `registerSchema`). No errors in `src/data/schemas/index.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/data/schemas/index.ts
git commit -m "refactor: revert schemas/index.ts to static typed form, remove registerSchema()"
```

---

### Task 2: Update `src/tools/harness-schema.ts` to accept `additionalSchemas`

**Files:**
- Modify: `src/tools/harness-schema.ts` (lines 5, 127–143)

- [ ] **Step 1: Write a failing test**

Create `tests/tools/harness-schema-tool.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSchemaTool } from "../../src/tools/harness-schema.js";

function makeServer() {
  return new McpServer({ name: "test", version: "0.0.0" });
}

describe("registerSchemaTool additionalSchemas", () => {
  it("accepts additionalSchemas without throwing", () => {
    const server = makeServer();
    const extra = {
      DashboardContract: { type: "object", properties: { id: { type: "string" } } },
    };
    expect(() => registerSchemaTool(server, extra)).not.toThrow();
  });

  it("registers without additionalSchemas (backwards compat)", () => {
    const server = makeServer();
    expect(() => registerSchemaTool(server)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm test tests/tools/harness-schema-tool.test.ts 2>&1 | tail -20
```

Expected: FAIL — `registerSchemaTool` doesn't accept a second argument yet.

- [ ] **Step 3: Update `registerSchemaTool` signature and internals**

In `src/tools/harness-schema.ts`, change the import on line 5 and the function starting at line 127:

```typescript
// line 5 — update import
import { SCHEMAS, VALID_SCHEMAS } from "../data/schemas/index.js";
```

Replace the `registerSchemaTool` function signature and the first two lines inside it (lines 127–143):

```typescript
export function registerSchemaTool(
  server: McpServer,
  additionalSchemas?: Record<string, Record<string, any>>,
): void {
  const allSchemas: Record<string, Record<string, any>> = additionalSchemas
    ? { ...SCHEMAS, ...additionalSchemas }
    : { ...SCHEMAS };
  const availableSchemas = Object.keys(allSchemas);

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
        // ... rest unchanged
```

Also update line 216 (the schema lookup inside the handler):

```typescript
// Before:
const schema = SCHEMAS[args.resource_type as keyof typeof SCHEMAS] as Record<string, unknown>;

// After:
const schema = allSchemas[args.resource_type] as Record<string, unknown>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm test tests/tools/harness-schema-tool.test.ts 2>&1 | tail -20
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm typecheck 2>&1 | head -40
```

Expected: no errors in `src/tools/harness-schema.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/tools/harness-schema.ts tests/tools/harness-schema-tool.test.ts
git commit -m "feat: add additionalSchemas param to registerSchemaTool()"
```

---

### Task 3: Update `src/resources/harness-schema.ts` to accept `additionalSchemas`

**Files:**
- Modify: `src/resources/harness-schema.ts`
- Modify: `tests/resources/harness-schema.test.ts`

- [ ] **Step 1: Write a failing test for extension schema injection**

Add to `tests/resources/harness-schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isValidSchemaName } from "../../src/resources/harness-schema.js";

// existing tests stay unchanged...

describe("isValidSchemaName with extension schemas", () => {
  it("returns false for an extension schema name when no extensions passed", () => {
    expect(isValidSchemaName("DashboardContract")).toBe(false);
  });

  it("returns true for an extension schema name when passed in merged set", () => {
    const mergedNames = ["pipeline", "DashboardContract"];
    // isValidSchemaName should accept an optional set to check against
    expect(isValidSchemaName("DashboardContract", mergedNames)).toBe(true);
  });

  it("returns false for unknown name even with merged set", () => {
    const mergedNames = ["pipeline", "DashboardContract"];
    expect(isValidSchemaName("unknown", mergedNames)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm test tests/resources/harness-schema.test.ts 2>&1 | tail -20
```

Expected: FAIL — `isValidSchemaName` doesn't accept a second argument yet.

- [ ] **Step 3: Update `src/resources/harness-schema.ts`**

Replace the entire file:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from "../utils/logger.js";
import { SCHEMAS, VALID_SCHEMAS, type SchemaName } from "../data/schemas/index.js";

const log = createLogger("resource:harness-schema");

export function isValidSchemaName(name: string, validNames: readonly string[] = VALID_SCHEMAS): name is SchemaName {
  return validNames.includes(name);
}

export function registerHarnessSchemaResource(
  server: McpServer,
  additionalSchemas?: Record<string, Record<string, any>>,
): void {
  const allSchemas: Record<string, Record<string, any>> = additionalSchemas
    ? { ...SCHEMAS, ...additionalSchemas }
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

// Exported for testing
export { isValidSchemaName };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm test tests/resources/harness-schema.test.ts 2>&1 | tail -20
```

Expected: all tests pass including the 3 new extension schema tests.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm typecheck 2>&1 | head -40
```

Expected: no errors in `src/resources/harness-schema.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/resources/harness-schema.ts tests/resources/harness-schema.test.ts
git commit -m "feat: add additionalSchemas param to registerHarnessSchemaResource()"
```

---

### Task 4: Thread `additionalSchemas` through `registerAllTools` and `registerAllResources`

**Files:**
- Modify: `src/tools/index.ts`
- Modify: `src/resources/index.ts`

- [ ] **Step 1: Update `src/tools/index.ts`**

Replace the `registerAllTools` signature and `registerSchemaTool` call:

```typescript
export function registerAllTools(
  server: McpServer,
  registry: Registry,
  client: HarnessClient,
  config: Config,
  additionalSchemas?: Record<string, Record<string, any>>,
): void {
  registerListTool(server, registry, client);
  registerGetTool(server, registry, client);
  registerCreateTool(server, registry, client);
  registerUpdateTool(server, registry, client);
  registerDeleteTool(server, registry, client);
  registerExecuteTool(server, registry, client);
  registerDiagnoseTool(server, registry, client, config);
  registerSearchTool(server, registry, client);
  registerDescribeTool(server, registry);
  registerStatusTool(server, registry, client, config);
  registerSchemaTool(server, additionalSchemas);
}
```

- [ ] **Step 2: Update `src/resources/index.ts`**

Replace the `registerAllResources` signature and `registerHarnessSchemaResource` call:

```typescript
export function registerAllResources(
  server: McpServer,
  registry: Registry,
  client: HarnessClient,
  config: Config,
  additionalSchemas?: Record<string, Record<string, any>>,
): void {
  registerPipelineYamlResource(server, registry, client, config);
  registerExecutionSummaryResource(server, registry, client, config);
  registerHarnessSchemaResource(server, additionalSchemas);
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm typecheck 2>&1 | head -40
```

Expected: no errors. `src/index.ts` calls `registerAllTools(server, registry, client, config)` and `registerAllResources(server, registry, client, config)` — the new `additionalSchemas` param is optional so existing callers are unaffected.

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm test 2>&1 | tail -30
```

Expected: all tests pass, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/tools/index.ts src/resources/index.ts
git commit -m "feat: thread additionalSchemas through registerAllTools and registerAllResources"
```

---

### Task 5: Final verification

- [ ] **Step 1: Full typecheck**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm typecheck 2>&1
```

Expected: zero errors.

- [ ] **Step 2: Full test suite**

```bash
cd /Users/sunil.gattupalle/harness/mcp-server && pnpm test 2>&1 | tail -40
```

Expected: all tests pass.

- [ ] **Step 3: Verify `registerSchema` is gone**

```bash
grep -rn "registerSchema" /Users/sunil.gattupalle/harness/mcp-server/src/
```

Expected: no matches.

- [ ] **Step 4: Verify `SCHEMAS` is back to typed form**

```bash
grep "Record<string" /Users/sunil.gattupalle/harness/mcp-server/src/data/schemas/index.ts
```

Expected: no matches — should only show `Record<AllSchemaKeys, ...>`.
