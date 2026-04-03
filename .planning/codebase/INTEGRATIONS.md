# External Integrations

**Analysis Date:** 2025-04-03

## APIs & External Services

**Harness Platform (Primary):**
- Harness.io REST API - Core integration target
  - Base URL: `https://app.harness.io` (configurable via `HARNESS_BASE_URL`, supports self-managed)
  - Auth: PAT (Personal Access Token) or Service Account token via `x-api-key` header
  - Auth config env var: `HARNESS_API_KEY` (required)
  - SDK/Client: Native HTTP `fetch()` API, custom `HarnessClient` class
  - Location: `src/client/harness-client.ts` - Handles auth headers, retry logic, error mapping
  - Scope header: `Harness-Account` (always injected), optional `accountIdentifier` query param
  - 139 resource types exposed: pipelines, services, environments, connectors, secrets, delegates, executions, pull requests, feature flags, CCM data, chaos experiments, STO findings, GitOps apps, and more
  - Endpoints: `/ng/api/...` (NG/next-gen), `/pipeline/api/...` (CI/CD), `/gateway/log-service/...` (execution logs), `/v1/...` (v1 beta)

**Feature Management Engine (FME / Split.io):**
- Split.io API - Feature flag management via Split.io backend
  - Base URL: `https://api.split.io` (hardcoded, not configurable per CLAUDE.md)
  - Auth: Token-based (delegated via Harness → Split.io)
  - SDK/Client: Same native `fetch()` client with `product: "fme"` flag in requests
  - Location: `src/registry/toolsets/feature-flags.ts` - Feature flag CRUD, split creation, rule-based segment management, rollout status
  - Request pattern: Skips Harness-specific headers when `product: "fme"` is set
  - Endpoints: Feature flags, segments, treatments, rollout definitions, audience analytics

## Data Storage

**Databases:**
- No embedded database - Harness MCP server is stateless
- All data persists in Harness backend (account-scoped)
- Multi-tenant routing: Session-based account ID resolution for HTTP transport
- Per-request account ID resolver: `HarnessClient.setAccountIdResolver()` for JWT/header-based scoping in multi-tenant scenarios
  - Location: `src/client/harness-client.ts` lines 63-70

**File Storage:**
- Local filesystem only (no cloud storage integration)
- Docker container: Non-root user (`mcp`) for security
- Build artifacts: `build/` directory (generated on compile, not committed)

**Caching:**
- None - Server is stateless, all requests hit Harness API
- Session storage (HTTP transport only): In-memory map of session → (server instance, transport)
  - TTL: 30 minutes per session, evicted when idle
  - Location: `src/index.ts` lines 150-176 (session store, reaper)

## Authentication & Identity

**Auth Provider:**
- Custom - Direct API key auth (PAT/Service Account tokens)
- No OAuth2, OIDC, or federated identity
- Account ID extraction from PAT token format: `pat.<accountId>.<tokenId>.<secret>`
  - Location: `src/config.ts` lines 8-14 (`extractAccountIdFromToken()`)
  - Pattern: Auto-extract account ID from PAT, only require manual `HARNESS_ACCOUNT_ID` for non-PAT tokens

**Multi-Tenant Support (HTTP Transport):**
- JWT claims parsing for per-request account ID override
- AsyncLocalStorage compatible for account ID context propagation
- Location: `src/client/harness-client.ts` lines 39-65 (`AccountIdResolver` interface)

**RBAC Scoping:**
- Harness RBAC enforced server-side (3-tier: Account → Org → Project)
- Client sends `accountIdentifier`, `orgIdentifier`, `projectIdentifier` in query params or body
- Default org/project from config: `HARNESS_ORG`, `HARNESS_PROJECT` (optional)
- Location: `src/config.ts` lines 22-23, 64-65 (config loading with fallback to deprecated names)

## Monitoring & Observability

**Error Tracking:**
- None - Errors logged to stderr only
- Error mapping: Harness API errors → MCP-friendly messages
  - Location: `src/utils/errors.ts` - `HarnessApiError` class with status, code, correlationId
  - HTTP error humanization: Status codes (401, 403, 404) with actionable hints
  - Location: `src/client/harness-client.ts` lines 18-31 (`humanizeHttpError()`)

**Logs:**
- Stderr logging only (critical for stdio JSON-RPC protocol)
- Structured logging with `console.error()`, never `console.log()`
- Logger interface: `createLogger(namespace)` returns `{ debug(), info(), warn(), error() }`
- Location: `src/utils/logger.ts`
- Log level control: `LOG_LEVEL` env var (debug|info|warn|error, default info)
- Request/response logging: Debug level includes URL, method, status, body snippets (first 1000 chars)

**Metrics & Tracing:**
- None - No OpenTelemetry, Prometheus, or APM integration
- Health check (HTTP transport): `GET /health` returns `{ status: "ok", sessions: N }`
  - Location: `src/index.ts` line 182

## CI/CD & Deployment

**Hosting:**
- Stdio transport: Local clients (Claude Desktop, Cursor, Windsurf) via stdin/stdout
- HTTP transport: Cloud deployments, Kubernetes, Docker, shared servers
  - Port: Configurable, default 3000
  - Host: Configurable, default 127.0.0.1 (localhost)
  - DNS rebinding protection: Via MCP SDK Express adapter (Host header validation when bound to localhost)

**Container Orchestration:**
- Docker multi-stage build: Node 22-alpine (build + runtime)
- Kubernetes ready: Stateless design, session-based HTTP transport supports horizontal scaling
- Health check: HTTP GET /health with 30s interval, 5s timeout, 10s start-period, 3 retries

**CI Pipeline (Harness Internal):**
- `.github/workflows/` - GitHub Actions CI (likely)
- `.harness/` - Harness CI/CD pipeline definitions (internal dogfooding)
- Pre-publish hook: `pnpm build` before npm publish

**Deployment Targets:**
- npm registry: Published as `harness-mcp-v2` (npx-installable)
- Docker Hub / registries: Multi-stage optimized image
- Self-hosted: Any environment with Node.js 20+

## Environment Configuration

**Required env vars:**
- `HARNESS_API_KEY` - PAT or Service Account token (auto-extracts account ID)

**Optional env vars (with defaults):**
- `HARNESS_ACCOUNT_ID` - Manual override for non-PAT tokens
- `HARNESS_BASE_URL` - `https://app.harness.io` (self-managed support)
- `HARNESS_ORG` - Default org identifier, defaults to "default"
- `HARNESS_PROJECT` - Default project identifier (optional)
- `HARNESS_API_TIMEOUT_MS` - 30000ms (30 seconds)
- `HARNESS_MAX_RETRIES` - 3 retries with exponential backoff
- `LOG_LEVEL` - info (debug|info|warn|error)
- `HARNESS_RATE_LIMIT_RPS` - 10 requests/sec client-side token bucket
- `HARNESS_TOOLSETS` - Comma-separated filter (if omitted, all 30+ toolsets enabled)
- `HARNESS_MAX_BODY_SIZE_MB` - 10MB (Express body parser limit)
- `HARNESS_ALLOW_HTTP` - false (enforce HTTPS unless overridden)
- `HARNESS_FME_BASE_URL` - `https://api.split.io` (read-only, hardcoded)

**Secrets location:**
- Environment variables only (.env files for local dev, env secrets in production)
- No secret files committed (.gitignore excludes .env, credentials, keys)
- Harness API key never logged or exposed in error messages
  - Pattern: Redacted in debug logs, safe error messages sanitize tokens

## Webhooks & Callbacks

**Incoming:**
- None - MCP server is request-response only
- MCP protocol is bidirectional via transport but no webhook listeners

**Outgoing:**
- None - MCP server does not make unsolicited outbound calls
- All calls are request-driven (tool execution, resource fetch, prompt evaluation)

**Server-Initiated Messages (HTTP Transport):**
- SSE (Server-Sent Events) stream for progress updates
- Location: `src/index.ts` line 252 (GET /mcp endpoint with SSE support)
- Pattern: Used for long-running operations (e.g., scanning large artifact lists, progress tracking)
- Elicitation prompts: Interactive confirmation for write/delete operations
  - Location: `src/utils/elicitation.ts` - Sends elicitation messages via MCP transport

## API Endpoint Categories

**Pipeline Management:**
- `/pipeline/api/pipelines/list` - List pipelines
- `/pipeline/api/pipelines/{pipelineId}` - Get pipeline YAML
- `/pipeline/api/pipelines/v2` - Create/update pipelines (YAML or JSON)
- `/pipeline/api/pipeline/execute/{pipelineId}` - Execute pipeline with inputs
- `/pipeline/api/pipeline/execute/interrupt/{planExecutionId}` - Interrupt running execution

**Execution & Logs:**
- `/pipeline/api/pipelines/execution/summary` - List executions with filtering
- `/pipeline/api/pipelines/execution/{planExecutionId}` - Get execution details
- `/gateway/log-service/blob/download` - Download execution logs (ZIP format)

**Code & Version Control:**
- `/code/api/v1/repos` - List repositories (Harness Code)
- `/code/api/v1/repos/{repoId}/pullrequests` - List pull requests
- `/code/api/v1/repos/{repoId}/pullrequests/{prNumber}` - Get PR details
- `/code/api/v1/repos/{repoId}/pullrequests/{prNumber}/comments` - PR comments

**Entity Management:**
- `/ng/api/projects` - List/get projects
- `/ng/api/servicesV2` - Services (deployable entities)
- `/ng/api/environmentsV2` - Environments (deployment targets)
- `/ng/api/connectors` - Connectors (external integrations: Git, Docker, K8s, etc.)

**Secrets & Configuration:**
- `/ng/api/v2/secrets` - List secret metadata (read-only, values not exposed)

**Feature Flags (via FME/Split.io):**
- `https://api.split.io/api/v2/splits` - Feature flags
- `https://api.split.io/api/v2/segments` - Rule-based segments
- `https://api.split.io/api/v2/workspaces/{workspace}/environments/{env}/features/{flag}` - Feature definition

**Cloud Cost Management (CCM):**
- `/ccm/api/trends/cost` - Cost trends
- `/ccm/api/cost-categories` - Cost category definitions
- `/ccm/api/budgets` - Budget management

**Chaos Engineering:**
- `/chaos/api/experiments` - Chaos experiments
- `/chaos/api/hubs` - Chaos experiment hubs

**Security Testing Orchestration (STO):**
- `/sto/api/v1/scans` - Security scan results
- `/sto/api/v1/vulnerabilities` - Vulnerability findings

**Other:**
- `/ng/api/delegates` - Delegate health/status
- `/cf/admin/features` - Feature flag toggles (Harness native CF module)
- `/idp/api/` - Internal Developer Portal
- `/sei/api/` - Software Engineering Insights

## Rate Limiting & Quotas

**Client-side Rate Limiting:**
- Token bucket algorithm: `HARNESS_RATE_LIMIT_RPS` tokens/sec (default 10)
- Per-session enforcement: Each session acquires tokens before requests
- Location: `src/utils/rate-limiter.ts`
- Max wait per token: Configurable (default high timeout)

**Server-side (HTTP Transport):**
- Per-IP rate limiting: 60 requests/minute
- Returns HTTP 429 if exceeded
- Location: `src/index.ts` lines 125-147

**Harness API Quotas:**
- Pagination limits: Most list endpoints max 100 items per page
- Execution summary API: Hard limit 10,000 records
- Retry on 429: Automatic exponential backoff (1s → 2s → 4s)

## Data Flows

**Typical Request Flow (HTTP Transport):**
1. Client POSTs JSON-RPC method call to `/mcp` with `mcp-session-id` header
2. Session lookup in in-memory map (TTL 30min)
3. Route to registered tool handler (e.g., `harness_list`, `harness_get`, `harness_create`)
4. Tool calls `Registry.dispatch()` → resolves resource type + operation
5. Registry calls `HarnessClient.request()` with appropriate Harness API endpoint
6. Client injects auth headers, account ID, rate limiter token, retry logic
7. Harness API responds; client maps Harness error codes → MCP errors
8. Tool formats response (JSON, stripped of unnecessary metadata)
9. MCP server returns JSON-RPC result to client
10. Client optionally streams SSE updates (progress, elicitation) via GET /mcp

**Authentication Flow:**
1. Load config, extract/validate account ID from PAT token
2. Per-request: Resolve current account ID (static config or JWT claim via `AccountIdResolver`)
3. Inject `x-api-key` header (unless `Authorization` already set for service routing)
4. Inject `Harness-Account` header (always)
5. Inject `accountIdentifier` query param (unless `headerBasedScoping: true` for SEI/other header-only APIs)

---

*Integration audit: 2025-04-03*
