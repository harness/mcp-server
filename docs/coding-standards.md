# MCP Server Coding Standards

This document defines the architecture and commit rules for the registry-driven Harness MCP server. CI enforces the critical rules via `pnpm standards:check`.

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

Do NOT create new `server.registerTool()` files. Do NOT add new handler files to `src/tools/`. Supporting modules under `src/tools/` (`diagnose/`, `entity-schema/`, shared schemas) are allowed.

### 2. Toolset Definitions Are Pure Data

Files in `src/registry/toolsets/*.ts` must export a `ToolsetDefinition` object. They should contain `EndpointSpec` objects, `bodyBuilder` functions, and `BodySchema` metadata.

They must NOT:

- Import `HarnessClient`, `McpServer`, or `Registry`
- Make HTTP calls directly (use `PreflightContext.client.request()` when preflight needs an API call)
- Use `console.log()` (or any stdout writes)

### 3. Use Shared Response Extractors

All response extractors live in `src/registry/extractors.ts`. Reuse `ngExtract`, `pageExtract`, `v1ListExtract`, `v1Unwrap`, `gqlExtract`, etc. Avoid `passthrough` on real endpoints — project to a stable shape.

### 4. Follow the Harness Scoping Model

Every `ResourceDefinition` declares a `scope`: `"project"`, `"org"`, or `"account"`. The `Registry.dispatch()` method handles scope injection automatically. Do NOT manually inject `accountIdentifier`, `orgIdentifier`, or `projectIdentifier` in toolset specs.

### 5. Identifier Fields and Deep Links

Every `ResourceDefinition` must declare `identifierFields` and `deepLinkTemplate` (when possible).

### 6. Error Handling Pattern

Tool handlers catch errors and use `errorResult()` for known failures or `throw toMcpError(err)` for unexpected failures. Never swallow errors. Never expose API tokens.

### 7. Logging Rules (CRITICAL)

**NEVER write to stdout.** Use `createLogger()` from `src/utils/logger.js` — it writes structured JSON to stderr.

### 8. Tool Input Schema Standards

All Zod schemas in tool handlers must use `.describe()` on every parameter, optional scope params with config defaults, and `snake_case` names. Import Zod 4: `import * as z from "zod/v4"`.

### 9. Safety and Security Rules

Never expose secret values. Write operations require `confirmation: true`. Rate limiting is enforced client-side.

### 10. HTTP Client Is Singleton

`HarnessClient` is instantiated once in `src/index.ts`. Do not create additional instances or bypass the client with raw `fetch()` (exceptions: presigned log URLs in `log-resolver.ts`, audit webhooks in `audit/sinks/webhook.ts`, live entity schema discovery in `entity-schema/live.ts`).

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

## Verification

```bash
pnpm build
pnpm typecheck
pnpm standards:check
pnpm test
pnpm docs:generate   # after build
pnpm docs:check
```

`pnpm standards:check` runs `scripts/check-standards.js` and fails CI on architectural violations.

### Automated checks (`pnpm standards:check`)

| Rule | Enforced |
|------|----------|
| No `console.log()` in `src/` | Yes |
| `registerTool()` only in 11 `harness-*.ts` handlers | Yes |
| No unexpected files under `src/tools/` | Yes |
| `fetch()` only in allowlisted paths | Yes |
| `HarnessClient` singleton in `src/index.ts` only | Yes |
| Toolsets must not import `HarnessClient`, `McpServer`, or `Registry` | Yes |
| Toolsets must not use `console.*` | Yes |
| `ToolsetName` union ↔ toolset files ↔ `ALL_TOOLSETS` in sync | Yes |

### Manual review (not yet automated)

- Response extractors project stable shapes (avoid `passthrough` on real endpoints)
- `identifierFields` and `deepLinkTemplate` on every resource
- Write operations gated by `operationPolicy.risk` and `confirmation: true`
- Zod `.describe()` on every tool input parameter

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
