# Coding Standards — Registry-Driven MCP Server

This document defines the architectural rules every commit must follow. Automated checks in `tests/coding-standards.test.ts` enforce the machine-verifiable rules; run `pnpm standards:check` before pushing.

---

## Architecture Overview

This is a **registry-driven MCP server**. Instead of one MCP tool per Harness API endpoint, we use **11 consolidated tool handlers** (`harness_list`, `harness_get`, `harness_create`, `harness_update`, `harness_delete`, `harness_execute`, `harness_diagnose`, `harness_search`, `harness_describe`, `harness_status`, `harness_schema`) that dispatch to a **declarative resource registry**. The registry maps `resource_type` + `operation` to Harness API endpoints via pure-data `EndpointSpec` definitions.

```
User → MCP Tool (e.g. harness_list) → Registry.dispatch() → HarnessClient.request() → Harness API
```

### Key Layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Tool Handlers** | `src/tools/harness-*.ts` | Zod schema, input normalization, error mapping |
| **Registry** | `src/registry/index.ts` | Dispatch, scope injection, deep links, path building |
| **Toolset Definitions** | `src/registry/toolsets/*.ts` | Pure-data API endpoint specs (no logic beyond bodyBuilder/preflight) |
| **HTTP Client** | `src/client/harness-client.ts` | Auth, retry, rate limiting, URL construction |
| **Utilities** | `src/utils/*.ts` | Logger, errors, response formatting, compaction |
| **Resources** | `src/resources/*.ts` | MCP resource definitions (read-only data for LLMs) |
| **Prompts** | `src/prompts/*.ts` | MCP prompt templates |

---

## Rules for Every Commit

### 1. Never Add New MCP Tool Handlers

The 11 consolidated tools are the only MCP tools. To add support for a new Harness API:

- **Add a new toolset file** in `src/registry/toolsets/` (or extend an existing one)
- **Define `ResourceDefinition`s** with `EndpointSpec` for each operation
- **Register the toolset** in `src/registry/index.ts` (`ALL_TOOLSETS` array)
- **Add the toolset name** to `ToolsetName` union in `src/registry/types.ts`

Do NOT create new `server.registerTool()` calls outside the existing `harness-*.ts` handlers. Do NOT add new top-level tool handler files to `src/tools/`.

Supporting modules under `src/tools/` (schemas, diagnose helpers, input/output schemas) are allowed.

### 2. Toolset Definitions Are Pure Data

Files in `src/registry/toolsets/*.ts` must export a `ToolsetDefinition` object. They may also export small helpers used by tests or body builders in the same file (e.g. `normalizePurl`, `buildFileStoreMultipartBody`). Companion description files (e.g. `chaos-descriptions.ts`) are allowed.

They should contain:

- `EndpointSpec` objects with `method`, `path`, `pathParams`, `queryParams`, `responseExtractor`
- `bodyBuilder` functions (simple input-to-body transformers)
- `preflight` hooks that use `PreflightContext` and `HarnessClientInterface` only
- `BodySchema` metadata for `harness_describe` output

They must NOT:

- Import `HarnessClient`, `McpServer`, or `Registry`
- Make raw `fetch()` calls directly
- Use `console.log()` (or any stdout writes)

### 3. Use Shared Response Extractors

All response extractors live in `src/registry/extractors.ts`. When adding a new toolset, pick the appropriate extractor. Only add a new extractor to `extractors.ts` if no existing one fits — and it must be generic enough to reuse.

| Extractor | Use Case |
|-----------|----------|
| `ngExtract` | Standard NG API: `{ status, data }` → `data` |
| `pageExtract` | Paginated NG API: `{ data: { content, totalElements } }` → `{ items, total }` |
| `v1ListExtract(key?)` | v1 beta arrays, optionally unwrapping items |
| `v1Unwrap(key)` | v1 single-item unwrap |
| `gqlExtract(field)` | GraphQL response field extraction |
| `passthrough` | Return raw response unchanged (avoid on real endpoints when a stable projection exists) |

### 4. Follow the Harness Scoping Model

Every `ResourceDefinition` declares a `scope`: `"project"`, `"org"`, or `"account"`.

- **Project scope**: requires `orgIdentifier` + `projectIdentifier` query params
- **Org scope**: requires `orgIdentifier` only
- **Account scope**: no scope params needed (just `accountIdentifier`, which the client injects automatically)

The `Registry.dispatch()` method handles scope injection automatically. Do NOT manually inject `accountIdentifier`, `orgIdentifier`, or `projectIdentifier` in toolset specs.

### 5. Identifier Fields and Deep Links

Every `ResourceDefinition` must declare:

- `identifierFields`: primary ID fields used by `harness_get`
- `deepLinkTemplate` (when possible): URL template for linking to the Harness UI

### 6. Error Handling Pattern

```
Tool Handler → catches Error
  ├── Known errors (unknown resource_type, unsupported operation) → errorResult()
  └── All other errors → toMcpError(err)
       ├── HarnessApiError → maps HTTP status to MCP ErrorCode
       └── Generic Error → ErrorCode.InternalError
```

Never swallow errors. Never expose API tokens in error messages.

### 7. Logging Rules (CRITICAL)

**NEVER write to stdout.** Stdio transport uses stdout for JSON-RPC.

```typescript
import { createLogger } from "../utils/logger.js";
const log = createLogger("my-module");
log.info("message", { key: "value" });
```

### 8. Tool Input Schema Standards

All Zod schemas in tool handlers must:

- Use `.describe("...")` on every parameter
- Make scope params (`org_id`, `project_id`) optional with defaults from config
- Keep pagination defaults: `page` default `0`, `size` default `20`, max `100`
- Use `snake_case` for all parameter names
- Import Zod 4: `import * as z from "zod/v4"`

### 9. Safety and Security Rules

- **Never** expose secret values — only metadata (name, type, scope)
- **Never** auto-execute destructive operations — require `confirmation: true`
- Write operations require explicit `confirmation: true`
- Rate limit enforced client-side via `RateLimiter`

### 10. HTTP Client Is Singleton

`HarnessClient` is instantiated once in `src/index.ts` and passed via dependency injection. Do NOT:

- Create additional `HarnessClient` instances in `src/`
- Make raw `fetch()` calls from tool handlers or toolset definitions
- Bypass the client's auth, retry, or rate-limiting

### 11. File Organization Rules

| Change Type | Where It Goes |
|-------------|---------------|
| New Harness API domain | New file in `src/registry/toolsets/` |
| New response extractor | `src/registry/extractors.ts` |
| New MCP resource | `src/resources/` |
| New MCP prompt | `src/prompts/` |
| Error handling changes | `src/utils/errors.ts` |
| Config changes | `src/config.ts` |
| HTTP client changes | `src/client/harness-client.ts` |

---

## Commit Checklist

Before every commit, verify:

- [ ] **No new `server.registerTool()` calls** — only toolset definitions added/modified
- [ ] **No `console.log()` in `src/`** — only `createLogger()` for stderr output
- [ ] **No direct `fetch()` in tools or toolsets** — all HTTP goes through `HarnessClient`
- [ ] **No new top-level tool handler files in `src/tools/`**
- [ ] **Toolset files don't import HarnessClient, McpServer, or Registry**
- [ ] **All Zod params have `.describe()`**
- [ ] **Response extractors are from `extractors.ts`**
- [ ] **Scope is declared correctly**
- [ ] **`identifierFields` are declared**
- [ ] **Write operations require `confirmation: true`**
- [ ] **`pnpm build` passes**
- [ ] **`pnpm typecheck` passes**
- [ ] **`pnpm test` passes**
- [ ] **`pnpm standards:check` passes**

Run the full guardrail suite:

```bash
pnpm build && pnpm docs:generate && pnpm typecheck && pnpm test && pnpm standards:check
```

---

## What NOT to Do

| Anti-Pattern | Why It Breaks Things |
|-------------|---------------------|
| Add a new `server.registerTool()` call | Breaks the consolidated tool model |
| Import `HarnessClient` in a toolset file | Toolsets are pure data — use `PreflightContext.client` |
| Use `console.log()` in `src/` | Corrupts stdio JSON-RPC transport |
| Make raw `fetch()` calls from tools/toolsets | Bypasses auth, retry, rate limiting |
| Create a new HTTP client instance in `src/` | Singleton pattern |
| Hardcode `accountIdentifier` | Client injects it automatically |
| Return raw API responses without extractors | Leaks backend envelope across tool boundary |
| Skip `.describe()` on Zod params | LLMs can't select tools without descriptions |
| Add a toolset but skip `ToolsetName` union | TypeScript won't catch the typo |

---

## Tech Stack (Do Not Change)

| Component | Choice | Locked? |
|-----------|--------|---------|
| Runtime | Node.js 20+ | Yes |
| Language | TypeScript (strict mode) | Yes |
| Module system | ESM (`"type": "module"`) | Yes |
| Build | `tsc` → `build/` | Yes |
| Package manager | pnpm | Yes |
| Schema validation | Zod v4 (`import * as z from "zod/v4"`) | Yes |
| MCP SDK | `@modelcontextprotocol/sdk` v1.x | Yes |
| Transport | Stdio + Streamable HTTP | Yes |
| Test runner | Vitest | Yes |
