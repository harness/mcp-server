# Coding Conventions

**Analysis Date:** 2026-04-03

## Naming Patterns

**Files:**
- `kebab-case` for source files: `harness-client.ts`, `harness-list.ts`, `response-formatter.ts`
- Tool files named `harness-{operation}.ts`: `harness-list.ts`, `harness-get.ts`, `harness-create.ts`, `harness-delete.ts`, etc.
- Utility files follow usage pattern: `logger.ts`, `errors.ts`, `type-guards.ts`, `response-formatter.ts`
- Registry/toolset files follow domain pattern: `pipelines.ts`, `services.ts`, `connectors.ts`

**Functions:**
- `camelCase` for regular functions: `createLogger()`, `jsonResult()`, `asString()`, `extractAccountIdFromToken()`
- Verb-prefix pattern for tool registration: `registerListTool()`, `registerCreateTool()`, `registerDeleteTool()`
- Verb-prefix pattern for utilities: `enrichErrorWithHint()`, `buildLogPrefixFromExecution()`, `stripHtml()`, `humanizeHttpError()`
- Type guards prefixed with `is` or `as`: `isRecord()`, `asString()`, `asNumber()`, `isUserError()`, `isUserFixableApiError()`

**Variables:**
- `camelCase` for all variables and parameters: `resourceType`, `orgIdentifier`, `projectIdentifier`, `toolName`
- Constants in `UPPER_SNAKE_CASE`: `RETRYABLE_STATUS_CODES`, `BASE_BACKOFF_MS`, `LOG_LEVELS`
- Private class members prefixed with `private readonly`: `private readonly baseUrl`, `private readonly token`

**Types:**
- PascalCase for interfaces and types: `Config`, `Logger`, `HarnessClient`, `Registry`, `ToolResult`
- Union types use `|` with full type names: `"list" | "get" | "create" | "update" | "delete"`
- Type aliases for complex unions: `type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"`

## Code Style

**Formatting:**
- ES2022 target with ESM modules (`"module": "ES2022"`, `"moduleResolution": "Node16"`)
- No active formatter configured (no `.eslintrc` or `.prettierrc` found)
- Consistent spacing: 2-space indentation observed throughout codebase
- Line breaks between logical sections within functions (see `src/client/harness-client.ts` for pattern)

**Linting:**
- TypeScript strict mode enabled: `"strict": true`
- Additional strictness flags:
  - `"noUncheckedIndexedAccess": true` — require checks when accessing records
  - `"forceConsistentCasingInFileNames": true` — enforce case consistency
  - `"declaration": true` — generate `.d.ts` files
  - `"declarationMap": true` — map `.d.ts` back to source
  - `"sourceMap": true` — source maps for debugging

## Import Organization

**Order:**
1. Node.js built-in modules: `import { randomUUID } from "node:crypto"`
2. Third-party libraries: `import * as z from "zod/v4"`, `import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"`
3. Local imports: `import type { Config } from "./config.js"`, `import { HarnessClient } from "./client/harness-client.js"`
4. Relative paths for local modules: `import { createLogger } from "./utils/logger.js"`

**Path Aliases:**
- No path aliases configured in `tsconfig.json` — all imports use relative paths from files
- Test files use `"../../src/..."` pattern for imports: `import { Registry } from "../../src/registry/index.js"`
- Explicit `zod/v4` import used throughout: `import * as z from "zod/v4"` (NOT `from "zod"`)

## Error Handling

**Patterns:**
- Custom error class `HarnessApiError` for API failures: `src/utils/errors.ts`
- Error classification into user-fixable (plain `Error` or `HarnessApiError` 400/404) vs infrastructure errors (401/403/429/5xx)
- Function `isUserError(err)` to identify errors LLM can act on
- Function `isUserFixableApiError(err)` to identify API 400/404 errors
- Function `toMcpError(err)` to map errors to MCP `McpError` for JSON-RPC
- Error enrichment pattern: `enrichErrorWithHint(message, diagnosticHint)` adds recovery tips to 404s

**Strategy:**
- Tool handlers use `return errorResult(msg)` for user-fixable problems (validation, missing fields, 400/404 API errors)
- Tool handlers use `throw toMcpError(err)` for infrastructure failures (auth, rate limits, 5xx)
- Errors always include context: status code, correlation ID, original message
- HTML stripping for non-JSON error responses: `stripHtml()` removes tags and collapses whitespace

## Logging

**Framework:** Custom stderr-only logger in `src/utils/logger.ts`

**Patterns:**
- CRITICAL: Never log to stdout — reserved for JSON-RPC in stdio transport
- All logging goes to stderr via `console.error(JSON.stringify(entry))`
- Structured logging: each entry has `ts`, `level`, `module`, `msg`, and optional data fields
- Four log levels: `"debug"`, `"info"`, `"warn"`, `"error"` with global level control
- Create module-specific logger: `const log = createLogger("module-name")`
- Call `setLogLevel("debug")` at startup to set global threshold

**Audit Logging:**
- Special audit entries via `logAudit()` function: `src/utils/logger.ts`
- Fields: `operation`, `resource_type`, `resource_id`, `action`, `org_id`, `project_id`, `outcome`, `error`
- Logged at `warn` level for failures, `info` level for success
- Audit called after tool execution: `logAudit({ operation: "create", resource_type: args.resource_type, outcome: "success" })`

## Comments

**When to Comment:**
- Multi-line comments for complex algorithms: `src/registry/toolsets/pipelines.ts` shows elaborate trigger body normalization with 3-case explanation
- Comments on non-obvious behavior: error mapping, retry logic, edge cases
- Comments on public APIs and exported functions explaining purpose and parameters
- NO comments on obvious one-liners or self-explanatory code

**JSDoc/TSDoc:**
- Full JSDoc blocks on exported functions and classes
- JSDoc parameter descriptions: `@param message - Description`
- JSDoc return descriptions: `@returns - Description`
- Example: `src/utils/errors.ts` documents `HarnessApiError` class and all exported functions
- No strict enforcement observed — not all functions have JSDoc

**Block Comments:**
- Multi-line comments use `/* ... */` for headers and explanations
- Single-line explanations use `//` with lowercase start

## Function Design

**Size:** 
- Most functions 20-50 lines of logic
- Tool handlers 30-70 lines including error handling
- Complex dispatch logic factored into separate functions
- No functions observed exceeding 150 lines (breaks are taken into utilities)

**Parameters:** 
- Use destructuring from single object parameter for tool handlers: `async (args) => { const { params, filters, ...rest } = args; }`
- Type all parameters explicitly: `path: string`, `options?: RequestOptions`
- Optional parameters use `?:` with type narrowing
- Default values use `??` operator for null coalescing

**Return Values:** 
- Tool handlers return `ToolResult` type from `src/utils/response-formatter.ts`
- Registry dispatch returns result from operation's `responseExtractor` function
- Functions throw typed errors when infrastructure fails, return error results for user fixable issues
- Response formatters ensure consistent structure: `jsonResult()`, `errorResult()`, `imageResult()`, `mixedResult()`

## Module Design

**Exports:**
- Named exports used throughout: `export function registerListTool()`, `export class HarnessClient`
- Index files aggregate exports: `src/tools/index.ts` calls individual register functions
- Type exports: `export type Config = z.infer<typeof ConfigSchema>`
- Re-exports in registry: `src/registry/index.ts` imports and re-exports toolsets

**Barrel Files:**
- `src/tools/index.ts` — aggregates all tool registrations
- `src/resources/index.ts` — aggregates all resource registrations
- `src/prompts/index.ts` — aggregates all prompt registrations
- `src/registry/toolsets/index.ts` — would aggregate toolset definitions (check if needed)

## Zod Schema Conventions

**Patterns:**
- Always import `import * as z from "zod/v4"` (NOT `from "zod"`)
- Use `.describe()` last in chain — Zod 4 creates new schema instances per method call
- Correct order: `z.string().min(1).describe("Label").optional()`
- Wrong order: `z.string().describe("Label").min(1).optional()` (description lost)
- Schema composition: `z.object({ key: z.string(), count: z.number() })`
- Union types: `z.enum(["list", "get", "create"])` or `z.union([z.string(), z.number()])`
- Optional handling: `.optional()` for optional fields, `.default(value)` for defaults
- Type inference: `export type ConfigType = z.infer<typeof ConfigSchema>`

**Validation Pattern:**
- Use `ConfigSchema.safeParse()` to validate without throwing
- Return typed result: `if (result.success) { return result.data; }`
- Surface parsing errors: `result.error.issues` array (Zod 4)

## Dependency Injection

**Pattern:**
- Client passed to tools and registry via function parameters
- Registry passed to tool registration functions
- Config passed once at startup: `const client = new HarnessClient(config)`
- No global state — all dependencies injected

**Tool Registration:**
```typescript
export function registerListTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.registerTool(/* ... tool definition ... */, async (args) => {
    // Use injected registry and client
    const result = await registry.dispatch(client, resourceType, "list", input);
  });
}
```

---

*Convention analysis: 2026-04-03*
