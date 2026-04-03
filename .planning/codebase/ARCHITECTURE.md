# Architecture

**Analysis Date:** 2026-04-03

## Pattern Overview

**Overall:** Consolidated Registry-Based MCP Server (Dispatch Pattern)

Traditional MCP servers map one tool per API endpoint — over 240 for Harness alone. This server inverts that: 11 core tools (`harness_list`, `harness_get`, `harness_create`, `harness_update`, `harness_delete`, `harness_execute`, `harness_diagnose`, `harness_search`, `harness_describe`, `harness_status`, `harness_schema`) dispatch to a unified **Registry** containing 139 resource type definitions grouped into 34 toolsets.

**Key Characteristics:**
- **Registry-based dispatch:** Each tool receives a resource type and operation name, then the Registry routes to the appropriate endpoint spec and handlers
- **Declarative resource definitions:** Resources are pure data (not code) — adding a new Harness resource means adding a toolset file, not a new tool
- **Multi-product support:** Harness core APIs plus FME (Split.io) for feature flags via product selection in config
- **Session-based HTTP transport:** HTTP mode uses per-session MCP server instances; stdio mode uses a single persistent connection
- **URL-based auto-extraction:** Tools accept Harness UI URLs and auto-extract org, project, and resource identifiers — no manual parsing needed by agents

## Layers

**Config Layer:**
- Purpose: Validate and normalize environment variables into runtime config
- Location: `src/config.ts`
- Contains: Zod schema with validation, account ID extraction from PAT tokens, deprecated env var migration, product URL resolution
- Depends on: Zod 4 for schema validation
- Used by: HarnessClient, Server initialization

**HTTP Client Layer:**
- Purpose: Handle all HTTP communication with Harness APIs — auth, retry, error mapping, rate limiting
- Location: `src/client/harness-client.ts`
- Contains: Base URL normalization, per-request auth header injection, exponential backoff on 429/5xx, account ID resolution (static or dynamic via resolver)
- Depends on: Config, error utilities, rate limiter
- Used by: Registry dispatch functions, all tools indirectly

**Registry & Endpoint Mapping:**
- Purpose: Declare all Harness resources, their operations, and how to map tool inputs to API calls
- Location: `src/registry/` (core) + `src/registry/toolsets/` (all 34 toolsets)
- Contains: 
  - `index.ts` — Registry class that loads/filters toolsets and provides dispatch methods
  - `types.ts` — TypeScript types for toolsets, resources, operations, endpoint specs, body schemas, filter fields
  - `extractors.ts` — Response extraction functions (pageExtract, ngExtract, v1ListExtract, etc.)
  - `toolsets/*.ts` — 34 toolset files (pipelines, services, environments, connectors, pull-requests, etc.) each declaring resources and their CRUD operations
- Depends on: HarnessClient, Zod schemas (data validation), response extractors
- Used by: All tools (via dispatch), registry lookup methods

**Tool Layer (Dispatch Handlers):**
- Purpose: Implement the 11 public MCP tools — each tool invokes Registry dispatch
- Location: `src/tools/*.ts`
- Contains:
  - `index.ts` — Registers all tools with server
  - `harness-list.ts`, `harness-get.ts`, `harness-create.ts`, `harness-update.ts`, `harness-delete.ts` — CRUD operations
  - `harness-execute.ts` — Invoke actions (run pipelines, start processes)
  - `harness-diagnose.ts` — Analyze failures (execution logs, errors, step details, delegate health)
  - `harness-search.ts` — Full-text search across resources
  - `harness-describe.ts` — Introspection (list all resource types, operations, filter fields, body schemas)
  - `harness-status.ts` — Aggregate status across multiple resources (execution counts by status, health)
  - `harness-schema.ts` — Fetch JSON schemas for complex types (pipelines, templates, triggers)
- Depends on: Registry, HarnessClient, error handling, URL parsing, response formatting
- Used by: MCP Server directly (tool registration)

**Resource Layer (Optional Enhancements):**
- Purpose: Expose read-only data that LLMs can reference without tool invocation
- Location: `src/resources/`
- Contains: 
  - `pipeline-yaml.ts` — Pipeline YAML definitions as read-only resources
  - `execution-summary.ts` — Recent execution summaries
  - `harness-schema.ts` — JSON schemas as resources
- Depends on: Registry, HarnessClient
- Used by: MCP Server (resource registration)

**Prompt Layer:**
- Purpose: Pre-built prompts for common workflows — guide agents through multi-step tasks
- Location: `src/prompts/` (28 prompt templates)
- Contains: Category-organized prompts:
  - Core: debug-pipeline, create-pipeline, create-agent, optimize-costs, security-review, onboard-service
  - DevOps: dora-metrics, setup-gitops, chaos-resilience, feature-flag-rollout, delegate-health, developer-scorecard
  - FinOps: cloud-cost-breakdown, commitment-utilization, cost-anomaly, rightsizing
  - DevSecOps: vulnerability-triage, sbom-compliance, supply-chain-audit, exemption-review, access-control-audit
  - Code/PR: code-review, pr-summary, branch-cleanup
  - Approvals: pending-approvals
  - Workflows: build-deploy-app
- Depends on: MCP SDK (prompt registration)
- Used by: MCP Server (prompt registration)

**Utilities:**
- Purpose: Cross-cutting concerns
- Location: `src/utils/`
- Contains:
  - `logger.ts` — Stderr-only structured logging (critical for stdio MCP)
  - `errors.ts` — Error classification (user vs system) and MCP error mapping
  - `url-parser.ts` — Extract identifiers from Harness UI URLs (org, project, resource type, IDs)
  - `rate-limiter.ts` — Client-side rate limiting (default 10 req/s)
  - `deep-links.ts` — Generate Harness UI deep links for resources
  - `input-expander.ts` — Declarative input transformation rules (e.g., `{branch: "main"}` → full CI build structure)
  - `runtime-input-resolver.ts` — Resolve template variables at execution time
  - `body-normalizer.ts` — Normalize request bodies (e.g., wrap/unwrap for different API styles)
  - `response-formatter.ts` — Format tool responses (success, error, mixed)
  - `log-resolver.ts` — Download and parse execution logs
  - `compact.ts` — Strip verbose metadata from list items
  - `svg/` — Visualization rendering (charts, pipeline diagrams, status summaries)
  - `cli.ts` — Parse command-line arguments (transport type, port)
  - `elicitation.ts` — User confirmation prompts

**Data & Schemas:**
- Purpose: Pre-compiled JSON schemas for complex Harness types
- Location: `src/data/schemas/`
- Contains:
  - `pipeline.ts` — Pipeline JSON schema (3.0 MB)
  - `template.ts` — Pipeline template schema (3.7 MB)
  - `trigger.ts` — Trigger definition schema
  - `agent-pipeline.ts` — Agent pipeline schema
- Used by: `harness_schema` tool, prompt templates for generation guidance

**Server Entry Point:**
- Purpose: Bootstrap MCP server, choose transport, manage lifecycle
- Location: `src/index.ts`
- Contains:
  - `createHarnessServer()` — Instantiate fully-configured McpServer with all tools, resources, prompts
  - `startStdio()` — Stdio transport (single persistent connection)
  - `startHttp()` — HTTP transport with session management (30-min TTL per session, per-IP rate limiting 60 req/min, graceful shutdown, SSE streaming)
  - Global error handlers for unhandled rejections and exceptions
  - CLI argument parsing and config loading

## Data Flow

**Tool Invocation (All 11 tools follow this pattern):**

1. Agent calls `harness_list(resource_type="pipeline", project_id="proj-123", page=0, size=20)`
2. MCP SDK routes to tool handler in `harness-list.ts`
3. Tool handler:
   - Validates input against Zod schema
   - Applies URL parsing if URL provided (auto-extract identifiers)
   - Spreads caller params (additional identifiers for nested resources) and filters into input
   - Calls `registry.dispatch(client, resourceType, operation, input)`
4. Registry dispatcher:
   - Looks up resource definition for "pipeline"
   - Gets operation spec for "list" from pipelines toolset
   - Checks required scope params (org, project from config or input)
   - Calls endpoint spec's `bodyBuilder()` if POST/PUT to construct request body
   - Builds query params from input and endpoint spec mappings
   - Invokes `client.request()` with method, path, params, body
5. HarnessClient:
   - Injects `x-api-key` auth header
   - Injects scope query params (accountIdentifier, orgIdentifier, projectIdentifier)
   - Sends HTTP request to Harness API
   - On 429/5xx: exponential backoff (1s → 2s → 4s)
   - Parses response (handles both `{ status: "SUCCESS", data: ... }` and `{ status: "ERROR", ... }`)
   - Throws `HarnessApiError` on failure
6. Registry extracts useful data via response extractor (e.g., `pageExtract` unwraps pagination metadata)
7. Tool handler formats response and returns to agent

**Execution Tracing & Diagnostics:**

1. Agent calls `harness_diagnose(url="<Harness execution URL>")`
2. Tool extracts execution ID from URL
3. Calls `registry.dispatch()` which fetches full execution details + logs
4. Log resolver (`log-resolver.ts`) downloads raw logs from log service
5. Analyzer identifies failure point by examining:
   - Execution status and error messages
   - Which stage/step failed
   - Delegate health at time of execution
   - Log snippets around failure
   - For chained pipelines: recursively analyzes child execution failures
6. Formats output with suggested fixes and links to Harness UI

**HTTP Session Management:**

1. Client sends `POST /mcp` with initialize request (no session header)
2. Server creates new `McpServer` + `StreamableHTTPServerTransport` instance
3. Transport generates session ID (UUID)
4. Server stores in-memory: `sessions.set(sessionId, { server, transport, lastActivity })`
5. Response includes `mcp-session-id` header
6. Client sends `POST /mcp` with session header for subsequent calls
7. Server looks up session, routes to its transport
8. Idle sessions reaped after 30 minutes (checked every 60 seconds)

**State Management:**

- **Config:** Singleton, loaded once at startup
- **Registry:** Singleton per server instance (filtered by HARNESS_TOOLSETS if set)
- **HarnessClient:** Singleton per server instance
- **HTTP sessions:** Map keyed by session ID, entries are per-session (McpServer + transport)
- **Rate limiter:** Per-client (enforced before dispatch)
- **Log cache:** Transient (per-request, no persistent cache)

## Key Abstractions

**Registry Resource Definition:**
- Purpose: Declare a Harness entity (pipeline, service, connector, etc.) — how to list, get, create, update, delete, execute it
- Examples: `src/registry/toolsets/pipelines.ts` (resource type "pipeline"), `src/registry/toolsets/services.ts` (resource type "service")
- Pattern: Pure data structure (JSON-serializable) with operation specs, body schemas, filter fields, identifier fields. No code for CRUD — just declarative mappings from inputs to HTTP requests.

**Endpoint Spec:**
- Purpose: Define how a single CRUD operation maps to a Harness API endpoint
- Pattern: `{ method, path, pathParams, queryParams, bodyBuilder, responseExtractor, ... }`
  - `pathParams`: Map input field `pipeline_id` → URL segment `{pipelineIdentifier}`
  - `queryParams`: Map input field `page` → query param `?page=0`
  - `bodyBuilder`: Transform input into HTTP body (handles wrapping/unwrapping for different API styles)
  - `responseExtractor`: Pull useful data from nested API response (e.g., unwrap `{ data: { items: [...] } }` to `{ items: [...] }`)

**Body Schema:**
- Purpose: Describe the shape of a write operation's body (for `harness_create`, `harness_update`, `harness_execute`)
- Pattern: Lightweight field descriptors (pure data, not Zod) — serializable to JSON for introspection via `harness_describe`
  - Fields: name, type (string | number | boolean | object | array | yaml), required, description, nested fields

**Input Expansion Rule:**
- Purpose: Auto-transform shorthand inputs into full nested structures
- Pattern: Declarative (not procedural) — trigger key + template + optional skip-if-present guard
- Example: CI pipeline input `{branch: "main"}` auto-expands to `{branch: "main", ci_codebase: {...}}`

**Response Extractor:**
- Purpose: Normalize Harness API responses to a clean structure for tools
- Pattern: Pure functions like `pageExtract(raw) → { items, page, total }`, `ngExtract(raw) → raw.data`, `passthrough(raw) → raw`
- Location: `src/registry/extractors.ts`

## Entry Points

**Server Startup (`src/index.ts`):**
- Location: `src/index.ts` main()
- Triggers: `pnpm start` (stdio) or `pnpm start:http` (HTTP)
- Responsibilities:
  1. Load config from environment
  2. Set log level
  3. Parse CLI args (transport type, port)
  4. Create server instance with all tools, resources, prompts
  5. Connect transport (stdio or HTTP + session manager)
  6. Install global error handlers
  7. Listen for SIGINT/SIGTERM for graceful shutdown

**Tool Invocation (All tools follow this pattern):**
- Location: `src/tools/harness-*.ts`
- Triggers: Agent calls `harness_*(...)`
- Responsibilities:
  1. Register tool with MCP SDK
  2. Validate input schema
  3. Route to registry dispatch
  4. Format response
  5. Handle errors

**Registry Dispatch (`src/registry/index.ts`):**
- Location: Registry.dispatch() method
- Triggers: Tool calls `registry.dispatch(client, resourceType, operation, input)`
- Responsibilities:
  1. Look up resource definition
  2. Fetch operation spec
  3. Validate input (required fields, scopes)
  4. Build HTTP request (method, path, params, body)
  5. Invoke HTTP client
  6. Extract and return response

## Error Handling

**Strategy:** Fail loudly with actionable messages. Distinguish user errors (invalid input, auth failure, resource not found) from system errors (network, server bugs). Map Harness errors to MCP errors.

**Patterns:**

1. **User Error Detection** (`src/utils/errors.ts`):
   - `isUserError()` — 400, 401, 403, 404 (bad input, auth, permissions, not found)
   - `isUserFixableApiError()` — 400 + specific Harness error codes (validation failure, missing field)
   - LLMs get clear guidance: "API key is invalid" or "Project 'xyz' not found"

2. **Error Mapping** (HTTP status → MCP error code):
   - 400 → -32602 (Invalid params)
   - 401 → -32000 (Server error, generic "auth failed")
   - 403 → -32000 (Access denied)
   - 404 → -32001 (Not found)
   - 429 → Retry with backoff (not surfaced as error)
   - 5xx → -32000 (Server error, retry with backoff)

3. **Error Enrichment** (`enrichErrorWithHint()`):
   - Raw API error: `{ status: "ERROR", code: "INVALID_REQUEST", message: "..." }`
   - Enriched for LLM: `"Invalid pipeline YAML: syntax error at line 12. Check your stage definitions."`

4. **Logging** (all to stderr):
   - Request errors: method, path, status, correlation ID from Harness
   - User errors: "Invalid org_id 'badid'" (low verbosity)
   - System errors: full stack trace + context (high verbosity)

## Cross-Cutting Concerns

**Logging:** 
- Location: `src/utils/logger.ts`
- Pattern: Structured logging to stderr only (stdout reserved for JSON-RPC in stdio mode)
- Example: `log.error("API call failed", { method: "GET", path: "/pipeline/...", status: 401 })`

**Validation:** 
- Location: Zod schemas in each tool + Registry endpoint spec validation
- Pattern: Input validation first (before dispatch), then scope validation (org/project required?), then body validation (required fields?)

**Authentication:** 
- Location: HarnessClient auth header injection
- Pattern: Static account ID from config, optional dynamic account ID resolver for multi-tenant HTTP deployments

**Rate Limiting:**
- Location: `src/utils/rate-limiter.ts`
- Pattern: Per-client token bucket (default 10 req/s). Client-side enforcement before API call.

**URL Parsing:**
- Location: `src/utils/url-parser.ts`
- Pattern: Regex extraction of org, project, resource type, and identifiers from Harness UI URLs. Handles nested resources (e.g., PR comment inside repo inside project).

**Visualization:**
- Location: `src/utils/svg/`
- Pattern: SVG → PNG rendering for execution charts (timeseries, pie, bar), pipeline diagrams, status summaries. Optional in tools (`include_visual` param).

---

*Architecture analysis: 2026-04-03*
