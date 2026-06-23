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
| **Toolset Definitions** | `src/registry/toolsets/*.ts` | Pure-data API endpoint specs (no logic beyond bodyBuilder) |
| **HTTP Client** | `src/client/harness-client.ts` | Auth, retry, rate limiting, URL construction |
| **Utilities** | `src/utils/*.ts` | Logger, errors, response formatting, compaction |
| **Resources** | `src/resources/*.ts` | MCP resource definitions (read-only data for LLMs) |
| **Prompts** | `src/prompts/*.ts` | MCP prompt templates |

---

## Rules for Every Commit

### 1. Never Add New MCP Tool Handlers

The consolidated tools are the only MCP tools. To add support for a new Harness API:

- **Add a new toolset file** in `src/registry/toolsets/` (or extend an existing one)
- **Define `ResourceDefinition`s** with `EndpointSpec` for each operation
- **Register the toolset** in `src/registry/index.ts` (`ALL_TOOLSETS` array)
- **Add the toolset name** to `ToolsetName` union in `src/registry/types.ts`

Do NOT create new `server.registerTool()` files. Do NOT add new handler files to `src/tools/`.

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

All Zod schemas in tool handlers must use `.describe()` on every parameter, optional scope params with config defaults, and `snake_case` names.

### 9. Safety and Security Rules

Never expose secret values. Write operations require `confirmation: true`. Rate limiting is enforced client-side.

### 10. HTTP Client Is Singleton

`HarnessClient` is instantiated once in `src/index.ts`. Do not create additional instances or bypass the client with raw `fetch()` (exceptions: presigned log URLs in `log-resolver.ts`, audit webhooks in `audit/sinks/webhook.ts`).

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
