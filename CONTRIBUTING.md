# Contributing to Harness MCP Server

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable && corepack prepare pnpm@latest --activate`)
- A Harness API key for integration testing (optional for unit tests)

## Setup

```bash
git clone https://github.com/thisrohangupta/harness-mcp-v2.git
cd harness-mcp-v2
pnpm install
pnpm build
```

## Development Commands

```bash
pnpm build          # Compile TypeScript
pnpm dev            # Watch mode (recompile on change)
pnpm typecheck      # Type-check without emitting
pnpm test           # Run all tests
pnpm test:watch     # Run tests in watch mode
pnpm inspect        # Launch MCP Inspector for interactive testing
```

## Project Structure

```
src/
  index.ts                    # Server entrypoint, transport setup
  config.ts                   # Env var validation (Zod)
  client/
    harness-client.ts         # HTTP client (auth, retry, rate limiting)
  registry/
    index.ts                  # Registry class + dispatch logic
    types.ts                  # ResourceDefinition, ToolsetDefinition, etc.
    toolsets/                  # One file per toolset (declarative data)
  tools/                      # 10 generic MCP tools (thin dispatch wrappers)
  resources/                  # MCP resource providers
  prompts/                    # MCP prompt templates
  utils/                      # Errors, logger, rate limiter, deep links, etc.
tests/
  client/                     # HarnessClient tests
  registry/                   # Registry dispatch tests
  resources/                  # Resource provider tests
  utils/                      # Utility tests
```

## Adding a New Resource Type

This is the most common contribution. You don't need to touch any tool files — just add a declarative data definition.

### 1. Find or create a toolset file

Toolset files live in `src/registry/toolsets/`. Each file groups related resources (e.g. `pipelines.ts` has pipeline, execution, trigger). Either add to an existing toolset or create a new one.

### 2. Define the resource

```typescript
// src/registry/toolsets/my-module.ts
import type { ToolsetDefinition } from "../types.js";

export const myModuleToolset: ToolsetDefinition = {
  name: "my-module",
  displayName: "My Module",
  description: "Description of the module",
  resources: [
    {
      resourceType: "my_resource",           // unique key used in harness_list, harness_get, etc.
      displayName: "My Resource",
      description: "What this resource represents",
      toolset: "my-module",
      scope: "project",                      // "project" | "org" | "account"
      identifierFields: ["resource_id"],     // maps to harness_get's resource_id param
      listFilterFields: ["search_term"],
      operations: {
        list: {
          method: "GET",
          path: "/my-module/api/resources",
          queryParams: { search_term: "search", page: "page", size: "size" },
          responseExtractor: (raw) => {
            const r = raw as { data?: { content?: unknown[]; totalElements?: number } };
            return { items: r.data?.content ?? [], total: r.data?.totalElements ?? 0 };
          },
          description: "List resources",
        },
        get: {
          method: "GET",
          path: "/my-module/api/resources/{resourceId}",
          pathParams: { resource_id: "resourceId" },
          responseExtractor: (raw) => {
            const r = raw as { data?: unknown };
            return r.data ?? raw;
          },
          description: "Get resource details",
        },
      },
    },
  ],
};
```

### 3. Register the toolset

In `src/registry/index.ts`:

1. Add the import: `import { myModuleToolset } from "./toolsets/my-module.js";`
2. Add to `ALL_TOOLSETS` array: `myModuleToolset,`
3. Add the toolset name to `ToolsetName` union in `src/registry/types.ts`

### 4. Key concepts

**Scope** determines which query params are auto-injected:
- `"project"` — adds `accountIdentifier`, `orgIdentifier`, `projectIdentifier`
- `"org"` — adds `accountIdentifier`, `orgIdentifier`
- `"account"` — adds `accountIdentifier` only

**pathParams** maps tool input field names to URL placeholders. For `path: "/api/things/{thingId}"` and `pathParams: { resource_id: "thingId" }`, the user's `resource_id` value replaces `{thingId}`.

**responseExtractor** unwraps the Harness API response envelope. Most endpoints return `{ data: ... }` or `{ data: { content: [...] } }`. Extract just the useful part.

**deepLinkTemplate** generates clickable Harness UI URLs in responses. Use `{accountId}` (auto-filled) and path param placeholders.

**executeActions** add non-CRUD operations like "run pipeline" or "toggle feature flag". They work like operations but are dispatched via `harness_execute`.

## Adding a Prompt Template

Prompt templates live in `src/prompts/`. Each file exports a `register*Prompt(server)` function.

```typescript
// src/prompts/my-prompt.ts
import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerMyPrompt(server: McpServer): void {
  server.registerPrompt(
    "my-prompt-name",
    {
      description: "Short description of what this prompt does",
      argsSchema: {
        requiredParam: z.string().describe("What this param is"),
        optionalParam: z.string().describe("Optional context").optional(),
      },
    },
    async ({ requiredParam, optionalParam }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Your prompt instructions here. Use ${requiredParam} and ${optionalParam ?? "default"}.

Use harness_get, harness_list, and other tools to gather context.`,
        },
      }],
    }),
  );
}
```

Then import and call it in `src/prompts/index.ts`.

## Testing

### Running tests

```bash
pnpm test              # All tests
pnpm test:watch        # Watch mode
```

### Test structure

Tests mirror the source structure under `tests/`. Each test file tests one source module.

### Writing tests

- Mock `HarnessClient` for registry and tool tests — don't make real API calls
- Mock `fetch` for `HarnessClient` tests
- Use `makeConfig()` helper to create test configs with sensible defaults
- Test both success paths and error paths

### What to test for a new toolset

New toolsets are declarative data, so they're covered by the existing registry dispatch tests. You don't need to write tests unless your toolset has custom `responseExtractor` or `bodyBuilder` logic that warrants verification.

## Error Handling Convention

Tool handlers follow a consistent pattern:

- **`return errorResult(msg)`** — for user-fixable problems (bad resource_type, missing confirmation, unsupported operation). The LLM sees the message and can retry.
- **`throw toMcpError(err)`** — for infrastructure failures (HTTP 5xx, auth errors, timeouts). Surfaced as JSON-RPC errors.

Use `isUserError(err)` to distinguish: plain `Error` (from registry/validation) = user-fixable, `HarnessApiError` (from HTTP client) = infrastructure.

## Logging

All logs must go to **stderr**. The stdio transport uses stdout for JSON-RPC — writing to stdout corrupts the protocol.

```typescript
import { createLogger } from "../utils/logger.js";
const log = createLogger("my-module");

log.info("message");           // OK — goes to stderr
log.debug("details", { key }); // OK — goes to stderr
console.log("anything");       // NEVER — breaks stdio transport
```

## Code Style

- TypeScript with strict mode
- ESM (`"type": "module"` in package.json)
- Imports use `.js` extensions (required for ESM)
- Zod v4 imports: `import * as z from "zod/v4"`
- Tool names: `snake_case` (e.g. `harness_list`)
- Resource types: `snake_case` (e.g. `feature_flag`)

## Pull Request Guidelines

1. One concern per PR — don't mix features with refactors
2. `pnpm build` must pass with no errors
3. `pnpm test` must pass — all tests green
4. Add tests for new logic (custom extractors, bodyBuilders, utilities)
5. Update README.md if adding user-visible features (new config vars, resource types, prompts)

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
