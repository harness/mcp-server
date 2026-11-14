# Coding Standards — Harness MCP Server

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

The 11 consolidated tools are the only MCP tools. To add support for a new Harness API:

- **Add a new toolset file** in `src/registry/toolsets/` (or extend an existing one)
- **Define `ResourceDefinition`s** with `EndpointSpec` for each operation
- **Register the toolset** in `src/registry/index.ts` (`ALL_TOOLSETS` array)
- **Add the toolset name** to `ToolsetName` union in `src/registry/types.ts`

Do NOT create new `server.registerTool()` calls. Do NOT add new `harness-*.ts` handler files to `src/tools/`.

### 2. Toolset Definitions Are Pure Data

Files in `src/registry/toolsets/*.ts` must export a `ToolsetDefinition` object (helper modules like `chaos-descriptions.ts` and `scopes.ts` are exceptions). They should contain:

- `EndpointSpec` objects with `method`, `path`, `pathParams`, `queryParams`, `responseExtractor`, `operationPolicy`
- `bodyBuilder` functions (simple input-to-body transformers)
- `BodySchema` metadata for `harness_describe` output

They must NOT:

- Import `HarnessClient`, `McpServer`, or `Registry`
- Import or call `createLogger` (logging belongs in tool handlers and infrastructure modules, not toolsets)
- Make HTTP calls directly (use `preflight` hooks with structural client interfaces from `PreflightContext` when needed)
- Contain business logic beyond field mapping
- Use `console.log()` (or any stdout writes)

### 3. Use Shared Response Extractors

All response extractors live in `src/registry/extractors.ts`. When adding a new toolset, pick the appropriate extractor. Only add a new extractor to `extractors.ts` if no existing one fits — and it must be generic enough to reuse.

Prefer named extractors over `passthrough` on real endpoints. `passthrough` is acceptable only when the API response is already a stable, agent-facing shape.

### 4. Follow the Harness Scoping Model

Every `ResourceDefinition` declares a `scope`: `"project"`, `"org"`, or `"account"`.

- **Project scope**: requires `orgIdentifier` + `projectIdentifier` query params
- **Org scope**: requires `orgIdentifier` only
- **Account scope**: no scope params needed (just `accountIdentifier`, which the client injects automatically)

When an individual operation's backend endpoint has a different scope than the resource's default `scope` (for example, a project-scoped `list` endpoint paired with an account-scoped `get`-by-UUID endpoint on the same entity), set `scope: "account"` (or `"org"` / `"project"`) directly on that operation's `EndpointSpec` rather than splitting the entity into a separate `*_detail` resource type.

The `Registry.dispatch()` method handles scope injection automatically based on the definition (and per-operation `EndpointSpec.scope` / `EndpointSpec.scopeParams` overrides). Do NOT manually inject `accountIdentifier`, `orgIdentifier`, or `projectIdentifier` in toolset specs.

### 5. Identifier Fields and Deep Links

Every `ResourceDefinition` must declare:

- `identifierFields`: primary ID fields used by `harness_get` (e.g., `["pipeline_id"]`)
- `deepLinkTemplate` (when possible): URL template for linking to the Harness UI

**Exception:** analytics, dashboard, and other filter/body-based `get` operations that do not target a single resource by ID may use `identifierFields: []`. Callers pass filters via `listFilterFields`, `params`, or the get `bodyBuilder` instead of `resource_id`. Metadata-only resource types with `operations: {}` may also use an empty array.

Tool handlers use `identifierFields[0]` to map the generic `resource_id` param to the resource-specific field. Deep links are auto-generated by the registry.

### 6. Error Handling Pattern

```
Tool Handler → catches Error
  ├── Known errors (unknown resource_type, unsupported operation) → errorResult()
  └── All other errors → toMcpError(err)
       ├── HarnessApiError → maps HTTP status to MCP ErrorCode
       └── Generic Error → ErrorCode.InternalError
```

- `HarnessApiError` is thrown by `HarnessClient` for all API failures
- `toMcpError()` in `src/utils/errors.ts` maps to MCP-compatible errors
- Tool handlers use `errorResult()` for graceful user-facing messages
- Tool handlers use `throw toMcpError(err)` for unexpected failures

Never swallow errors. Never expose API tokens in error messages.

### 7. Logging Rules (CRITICAL)

**NEVER write to stdout.** Stdio transport uses stdout for JSON-RPC — any `console.log()` will corrupt the protocol.

```typescript
// FORBIDDEN — breaks the server
console.log("anything");

// REQUIRED — all logging goes to stderr
import { createLogger } from "../utils/logger.js";
const log = createLogger("my-module");
log.info("message", { key: "value" });
```

The logger writes structured JSON to `stderr` via `console.error()`.

### 8. Tool Input Schema Standards

All Zod schemas in tool handlers must:

- Use `.describe("...")` on every parameter — LLMs depend on these descriptions for tool selection
- In Zod 4, call `.describe()` **last** in the chain (after `.optional()`, `.default()`, `.min()`, etc.) — otherwise MCP clients see no description
- Make scope params (`org_id`, `project_id`) optional with defaults from config
- Keep pagination defaults: `page` default `0`, `size` default `20`, max `100`
- Use `snake_case` for all parameter names

### 9. Safety and Security Rules

- **Never** expose secret values — only metadata (name, type, scope)
- **Never** auto-execute destructive operations — require `confirm: true` (or client elicitation when supported)
- **Never** auto-run pipelines — present the execution plan first
- Write operations (`harness_create`, `harness_update`, `harness_delete`, `harness_execute`) gate on operation risk via elicitation; pass `confirm: true` only when the client cannot prompt
- Rate limit enforced client-side via `RateLimiter`
- Every `EndpointSpec` must declare `operationPolicy` with appropriate `risk` and `retryPolicy`

### 10. Error Handling Principles

- **Fail loudly** — never swallow errors. Surface Harness API errors with full context (status code, message, correlationId). Use `toMcpError()` to convert `HarnessApiError` to a typed MCP error, and `enrichErrorWithHint()` to attach diagnostic context.
- **Idempotent reads** — all read operations (`harness_list`, `harness_get`, `harness_search`) must be safe to call repeatedly with identical results. No side effects on GET-equivalent paths.
- **No `any` in error paths** — catch blocks must type-narrow before accessing properties. Use `instanceof HarnessApiError` (from `src/utils/errors.ts`) rather than accessing `.message` on unknown values directly.

### 11. HTTP Client Is Singleton

`HarnessClient` is instantiated once in `src/index.ts` and passed via dependency injection to the registry and tool handlers. Do NOT:

- Create additional `HarnessClient` instances
- Make raw `fetch()` calls from tool handlers or toolset definitions
- Bypass the client's auth, retry, or rate-limiting

**Documented exceptions** for global `fetch()` outside `HarnessClient` (enforced by `pnpm standards:check`):

| File | Reason |
|------|--------|
| `src/client/harness-client.ts` | Core HTTP transport |
| `src/utils/log-resolver.ts` | Pre-signed CDN/S3 blob URLs must not receive API auth headers (would invalidate signatures) |
| `src/utils/oauth-auth.ts` | Fetches HarnessID JWKS from the configured identity-provider host without attaching Harness API credentials |
| `src/utils/oauth-proxy.ts` | OAuth proxy token exchange and JWKS against the configured IdP (not Harness API traffic) |
| `src/utils/oauth-broker.ts` | Upstream discovery and token exchange for the embedded OAuth broker (not Harness API traffic) |
| `src/audit/sinks/webhook.ts` | Best-effort POST to a user-configured external audit webhook URL |
| `src/search/remote-provider.ts` | Calls an external semantic-search service (not the Harness API) |

**Documented exceptions** for `client.request()` in tool handlers (bypass registry dispatch for multi-step workflows):

| File | Reason |
|------|--------|
| `src/tools/harness-execute.ts` | Pipeline input-set materialization and runtime-input resolution before execute |
| `src/tools/entity-schema/live.ts` | Live schema fetch from Harness schema registry endpoints |
| `src/tools/diagnose/pipeline.ts` | Multi-step pipeline failure forensics (execution + logs) |

### 12. File Organization Rules

| Change Type | Where It Goes |
|-------------|---------------|
| New Harness API domain | New file in `src/registry/toolsets/` |
| New response extractor | `src/registry/extractors.ts` |
| New MCP resource | `src/resources/` |
| New MCP prompt | `src/prompts/` |
| Error handling changes | `src/utils/errors.ts` |
| Config changes | `src/config.ts` (Zod schema + `Config` type) |
| HTTP client changes | `src/client/harness-client.ts` |
| API-specific error shapes (new APIs) | Register an `ErrorParser` in `src/client/error-parsers.ts`, gated by path and status. Prefer this over inline checks in `parseApiError` or new `ERROR_FIELD_ENRICHMENTS` entries |
| OAuth proxy / broker HTTP routes | `src/utils/oauth-proxy.ts`, `src/utils/oauth-broker.ts` |
| OAuth token vault backends | `src/utils/oauth-proxy-vault.ts`, `src/utils/oauth-proxy-redis-vault.ts` |

Do NOT add new `harness-*.ts` handler files to `src/tools/` — the 11 handlers are fixed.

### 13. Resource Taxonomy and Consolidation (No Endpoint-per-`resource_type` Sprawl)

Model `ResourceDefinition`s around **cohesive domain entities**, never 1:1 with backend REST endpoints:

- **Keep `list` and `get` on the same `resourceType`**: Never create a separate `*_detail` resource type for single-item retrieval. If `get` is account-scoped while `list` is project-scoped, set `scope: "account"` on the `get` `EndpointSpec`.
- **Attach RPCs and batch/stat queries to the parent entity's `executeActions`**: Never create a standalone `resource_type` that only has a single `execute` action (e.g. `foo_resume`, `foo_evaluate`), and avoid standalone `*_stats` / `*_count` resource types when they can be `executeActions.stats` (`operationPolicy: { risk: "read", retryPolicy: "safe" }`) on the parent resource. Read-risk execute actions are allowed in `HARNESS_READ_ONLY=true` mode and never prompt for confirmation.
- **Consolidate hierarchical sub-routes with `pathBuilder`**: When a domain has nested drill-down paths determined by which parent IDs are provided, prefer a single resource with a `pathBuilder` over separate resource types per path depth.
- **Never suffix `resource_type` with backend URL route versions (`_v1`, `_v2`, `_v3`)**: Name resources after domain capabilities (`chaos_experiment` for `/v3/experiments`, `security_exemption` for `/v2/exemptions`, `lifecycle_rule` for `/v3/lifecycle/rules`). A version suffix is only permitted when an older resource with the **exact same `resource_type` name** already coexists in the registry (`pipeline_v1`, `template_v1`, `runtime_input_template_v1`).

### 14. What Belongs in a Toolset Definition (Content Boundaries)

Toolset files (`src/registry/toolsets/*.ts`) are **declarative API dispatch tables**, not prompt-engineering playbooks or application controllers:

1. **Keep `ResourceDefinition.description` concise (≤ 500 chars, 1–2 sentences)**: State what the entity is and any key scope/identifier rule. Multi-step workflows, onboarding wizards, and reasoning playbooks belong in **MCP Prompt templates (`src/prompts/*.ts`)**, never in resource or toolset `description` strings.
2. **Never corrupt `items[]` arrays with prompt-engineering objects**: Response extractors for `list` operations must return `{ items: [...], total }` where every element of `items` is a real entity. Never push `{ _summary }`, `{ _reminder }`, or `{ _next_step }` objects onto the end of a list array (which corrupts `items[]` and inflates `total` by +1).
3. **Do not expose internal UI dropdown / filter-panel BFF endpoints as resources**: Endpoints that only populate web UI `<select>` dropdowns (e.g. `/frontend/*/filters`, `/filter-panel`) or duplicate `list` with incompatible IDs (`/list-metadata`) should not be exposed as separate MCP resources or actions. Declare known filter values in `listFilterFields.enum` instead.
4. **Never use `bodyBuilder` on `GET` operations**: `GET` requests have no HTTP body. Do not use `bodyBuilder` returning `undefined` on a `GET` spec as a side-effect hook to mutate `input` query parameters.

### 15. Agent Context Cost and Discovery

Every response is read by an LLM, and the agent loop owns the context. Tools must be designed so they do not bloat it.

1. **Return what an agent will act on.** Do not return a full backend object because it is available. Ask whether each field helps the next call.
2. **Keep default `list` items small.** Project bulky fields (steps, scripts, full specs, large nested arrays) out with `compactItem` or the response extractor. `get` returns what the agent needs for its next step.
3. **Truncate, offload, or isolate large output** (logs, execution output, payloads) behind a dedicated action. Do not inline it.
4. **Pagination is not discovery.** If an agent must page through a whole catalog to find one item, discovery is missing. Support `search_term` where the API allows it, and prefer the shared search path (search-service / UDP) for resources an agent must find by meaning.
5. **One search path.** Before adding a per-resource search mechanism, check whether the resource belongs in search-service / UDP. If a stopgap is needed, link the follow-up in the PR.
6. **Caps must keep the rest reachable.** A list cap or truncation must not make items past the first N unreachable. `page`, `size`, and `search_term` are honoured, or the response says how to get the rest.
7. **Measure it.** A change to `list`, `harness_describe`, or tool-schema payloads states before/after bytes or tokens, and schema changes run the evals (`docs/schema-budget.md`).

### 16. Credentials, Auth, and Trust Boundaries (Server and Operator Surface)

These rules protect the server and its operators and are not visible to agents. They apply only to changes that touch auth. Applies to anything that touches tokens, sessions, redirects, upstream identity providers, or stored secrets: `src/config.ts`, `src/client/harness-client.ts`, and the auth code in `src/utils/` (`http-auth.ts`, `oauth-auth.ts`, `oauth-broker.ts`, `oauth-proxy.ts`, `oauth-proxy-vault.ts`, `oauth-proxy-redis-vault.ts`).

1. **Allowlists default closed.** A wildcard (`*`) is an explicit, narrow opt-in (for example HTTP loopback only for local development), never the default. Custom URL schemes belong on an explicit list.
2. **Only accept credentials this server issued or can verify.** Do not proxy refresh or exchange requests for tokens whose origin the server has not checked. Bind issued tokens and codes to the client and flow that created them.
3. **Pin discovered endpoints before sending secrets.** Require `https` and the expected origin for any `authorization_endpoint`, `token_endpoint`, or JWKS URL taken from a discovery document before a redirect or a POST that carries a client secret or code.
4. **Link identity on stable, verified claims.** Use `sub` (or an explicitly verified email on an allowlisted domain). Never treat an unverified `email`, `preferred_username`, `upn`, or `unique_name` as proof of identity. Re-check the link whenever a new token is stored, not only at first login.
5. **Bind encrypted records to their identity.** Stored ciphertext must authenticate the logical record it belongs to (for example AES-GCM additional authenticated data), so swapping two stored values fails to decrypt.
6. **Never log token contents.** Do not log JWT claims, tokens, or raw upstream response bodies. Log metadata only (`iss`, `sub`, `exp`, `kid`, HTTP status, grant type). Decide on structured fields (the OAuth `error` code and status), not on substring matches in a response body.
7. **Apply the same limits on every path.** Scope and audience checks done at authorization also apply on refresh and any other re-entry path.
8. **No dead or half-wired configuration.** Every public env var is read by code and documented. New secrets and URLs go through `Config` with multi-user / oauth / oauth-proxy rejection and HTTPS validation. Harness credentials are never sent to a non-Harness host; a third-party backend gets its own dedicated, opt-in credential that fails closed in hosted modes, and the README, `.env.example`, and manifests are updated together.

### 17. Correctness and Public Contract of New Code Paths

Check every path a change adds, not only the headline endpoint (history and examples: `tasks/lessons.md`).

1. **Scope on every call.** Raw `client.request()` calls bypass registry scope injection. `HarnessClient` adds the account ID only, so pass org and project explicitly. For writes, list/get/create/update use the same scope params (§4).
2. **Units and budgets.** Match the API's units (milliseconds versus unix seconds, pages versus offsets). Fit timeouts to the number of calls, and abort in-flight requests when falling back.
3. **Act on the requested change.** Evaluate or score the state after the change, not only the current state.
4. **Falsy values are values.** Body builders and input handling use `!= null` checks, not truthiness, so `0` and `false` reach the API or fail loudly.
5. **Published names match their source.** A published field must be filled from the field it names, not a display label. List-only metadata (`listFilterFields`) is only declared where a `list` exists.
6. **Gate by risk.** Read-only and confirmation gating follows `operationPolicy.risk`, not the tool family. Classify risk by behavior.
7. **Do not leak backend envelopes.** No `passthrough` on a real endpoint unless the response is already a stable, agent-facing shape (§3).
8. **Guard silent overwrites.** Registry keys, aliases, and canonical names must be checked for collisions, not overwritten silently. A new key that already exists should fail loudly. (Today `Registry` does not check duplicate canonical `resourceType`s across toolsets; the last one wins, so verify manually until a guard exists.)
9. **Pin the contract with tests.** New or changed extractors and body builders have request-shape and response-shape tests (envelopes, empty results, falsy values, failure paths), and at least one test goes through the real entry path (for example session initialize), not only the unit. "No focused coverage" is a finding.
10. **Keep the public surface in sync.** A new env var, tool surface, or removed resource updates the README, manifests, prompts, and the PR description. Removals are called out as breaking and pinned with a test.
11. **Advertised surface matches behaviour.** Schema enums, descriptions, and `harness_describe` metadata list only what the code handles. A documented type or option that fails at runtime wastes agent calls.
12. **Agent-supplied input is untrusted.** Validate values interpolated into expressions, paths, or queries (for example require a UUID). A raw query passthrough (free-form GraphQL or SQL) must not allow mutations in read-only mode.

---

## Adding a New Harness Resource (Step-by-Step)

This is the only supported pattern for extending the server's capabilities.

### Step 1: Create or Extend a Toolset

```typescript
// src/registry/toolsets/my-domain.ts
import type { ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract } from "../extractors.js";

export const myDomainToolset: ToolsetDefinition = {
  name: "my-domain",
  displayName: "My Domain",
  description: "Brief description of this Harness domain",
  resources: [
    {
      resourceType: "my_resource",
      displayName: "My Resource",
      description: "What this resource represents",
      toolset: "my-domain",
      scope: "project",          // or "org" or "account"
      identifierFields: ["my_resource_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter my resources by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/...",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/my-resources",
          queryParams: { search_term: "searchTerm", page: "page", size: "size" },
          responseExtractor: pageExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List my resources",
        },
        get: {
          method: "GET",
          path: "/ng/api/my-resources/{myResourceId}",
          pathParams: { my_resource_id: "myResourceId" },
          responseExtractor: ngExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get my resource details",
        },
      },
    },
  ],
};
```

### Step 2: Register in the Registry

```typescript
// src/registry/index.ts — add to imports and ALL_TOOLSETS array
import { myDomainToolset } from "./toolsets/my-domain.js";

const ALL_TOOLSETS: ToolsetDefinition[] = [
  // ... existing toolsets
  myDomainToolset,
];
```

### Step 3: Add to ToolsetName Union

```typescript
// src/registry/types.ts
export type ToolsetName =
  | "pipelines"
  // ... existing names
  | "my-domain";
```

### Step 4: Add List Filter Params (If Needed)

If your resource uses list filter params not already in `harness_list`'s Zod schema, add them to `src/tools/harness-list.ts`. Keep the naming convention: `snake_case`, with `.describe()`.

### Step 5: Verify

```bash
pnpm build          # Must compile without errors
pnpm typecheck      # Must pass strict type checking
pnpm test           # Must not break existing tests
pnpm standards:check # Architecture/coding-standards guardrails
```

Use the MCP Inspector to manually verify your new resource type:

```bash
pnpm inspect
```

---

## Where to Put New Agent Guidance

The MCP server exposes an `instructions` string in `src/index.ts` sent to every agent on session init — keep it under ~20 lines. For anything more specific, use structured metadata on `EndpointSpec` or `ResourceDefinition` instead of expanding the global instructions block.

| Guidance type | Where it goes |
|---|---|
| Universal pattern (applies to ALL tools) | `instructions` in `src/index.ts` |
| Resource-specific operation details | `description` on the `EndpointSpec` |
| Execute action usage | `actionDescription` + `executeHint` on the resource |
| Input shorthands / expansions | `inputExpansions` on `EndpointSpec` (surfaced by `harness_describe` as `inputShorthands`) |
| Required fields / body format | `bodySchema` on the `EndpointSpec` |
| Debugging / troubleshooting | `diagnosticHint` on the resource |
| Filter fields for list operations | `listFilterFields` on the resource |

The `harness_describe` tool surfaces `inputExpansions` (as `inputShorthands`), `bodySchema`, `diagnosticHint`, and `listFilterFields` — prefer data over prose in the instructions block.

---

## Commit Checklist

Before every commit, verify:

- [ ] **No new `server.registerTool()` calls** — only toolset definitions added/modified
- [ ] **No `console.log()`** — only `createLogger()` for stderr output
- [ ] **No direct `fetch()` calls** — all Harness API HTTP goes through `HarnessClient` (exceptions: log blob CDN URLs, audit webhooks — see rule 11)
- [ ] **No new `harness-*.ts` handler files** — the 11 handlers are fixed
- [ ] **Toolset files are pure data** — no imports of `HarnessClient`, `McpServer`, `Registry`, or `createLogger`
- [ ] **All Zod params have `.describe()` after `.optional()`/`.default()`** — Zod 4 chaining order matters for MCP
- [ ] **Response extractors are from `extractors.ts`** — reuse shared extractors
- [ ] **Scope is declared correctly** — `"project"`, `"org"`, or `"account"`
- [ ] **`identifierFields` are declared** — required for `harness_get` dispatch
- [ ] **`operationPolicy` on every endpoint** — risk + retryPolicy set correctly
- [ ] **Write operations require confirmation** — via client elicitation or `confirm: true` when needed
- [ ] **No secrets exposed** — only metadata, never values
- [ ] **`pnpm build` passes** — no type errors
- [ ] **`pnpm typecheck` passes** — strict mode
- [ ] **`pnpm test` passes** — no regressions
- [ ] **`pnpm standards:check` passes** — automated architecture guardrails
- [ ] **Agent context cost and discovery considered** — small default list items, bulky fields projected out, a way to find the right item (§15)
- [ ] **Auth/credential changes follow §16** — closed-by-default allowlists, pinned endpoints, no token contents in logs
- [ ] **New code paths checked against §17** — scope, units, falsy values, risk gating, and request/response-shape tests

---

## What NOT to Do

| Anti-Pattern | Why It Breaks Things |
|-------------|---------------------|
| Add a new `server.registerTool()` call | Breaks the consolidated tool model — use the registry instead |
| Import `HarnessClient` in a toolset file | Toolsets are pure data — they don't execute HTTP directly |
| Import `createLogger` in a toolset file | Toolsets are pure data — logging belongs in handlers/infrastructure |
| Use `console.log()` | Corrupts stdio JSON-RPC transport |
| Make raw `fetch()` calls | Bypasses auth, retry, rate limiting |
| Create a new HTTP client instance | Singleton pattern — one client, injected everywhere |
| Hardcode `accountIdentifier` | Client injects it automatically |
| Return raw API responses | Always use response extractors to normalize |
| Skip `.describe()` on Zod params | LLMs can't select tools without descriptions |
| Put `.describe()` before `.optional()` / `.default()` | Zod 4 drops descriptions from the registered MCP schema |
| Add optional scope params without defaults | Breaks the config-based default fallback pattern |
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

Do not introduce new runtime dependencies without explicit approval. The server must remain lightweight.
