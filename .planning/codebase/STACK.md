# Technology Stack

**Analysis Date:** 2025-04-03

## Languages

**Primary:**
- TypeScript 5.7.3 - Full application codebase (100% of src/)
- YAML 2.8.3 - Pipeline configuration parsing and serialization via `yaml` package

**Secondary:**
- Shell (Docker, bash scripts) - Build and deployment scripting

## Runtime

**Environment:**
- Node.js 20+ (ES2022 target, native ESM support)
- Dockerfile: Node 22-alpine for production images

**Package Manager:**
- pnpm 10.18.2 - Monorepo/workspace package management
- pnpm-lock.yaml - Lockfile present, frozen installs enforced
- Dependency overrides configured in `package.json` for security patches (picomatch, hono, path-to-regexp, express-rate-limit)

## Frameworks & Runtimes

**Core MCP Framework:**
- `@modelcontextprotocol/sdk` v1.27.1 - MCP protocol implementation, server types, transport adapters
  - Provides: `McpServer`, `StdioServerTransport`, `StreamableHTTPServerTransport`, Express adapter
  - Location: `src/index.ts` - Server entrypoint with dual transport (stdio/HTTP)

**Transport Layers:**
- Stdio transport - Single persistent connection for local clients (Claude Desktop, Cursor, Windsurf)
- Streamable HTTP transport - Session-based stateful transport with SSE (Server-Sent Events) for remote/shared deployments
- Express.js v5.2.1 - HTTP server framework for HTTP transport mode
  - Location: `src/index.ts` (lines 109-378) - Full session management, CORS, rate limiting

**Data Validation & Serialization:**
- Zod v4.0.0 - Schema validation and type inference
  - Location: `src/config.ts` - Environment variable validation with transforms
  - Pattern: `import * as z from "zod/v4"` (explicit v4 subpath throughout codebase)
  - Usage: All tool input schemas, config parsing, response validation
- YAML v2.8.3 - Pipeline YAML serialization/deserialization
  - Location: `src/registry/toolsets/pipelines.ts`, `src/utils/body-normalizer.ts`

## Key Dependencies

**Critical:**

- `@modelcontextprotocol/sdk` v1.27.1 - MCP core protocol, transport adapters, server lifecycle
- `@types/node` v22.13.5 - Node.js type definitions
- `zod` v4.0.0 - Schema validation (all input/output validation)
- `yaml` v2.8.3 - Pipeline YAML parsing (essential for CD/CI workflows)

**Infrastructure & Auth:**

- `jsonwebtoken` v9.0.3 - JWT parsing and validation for multi-tenant scenarios (HTTP transport session isolation)
  - Location: Used in session context for per-request account ID resolution
- `@types/jsonwebtoken` v9.0.10 - JWT type definitions

**HTTP & Networking:**

- `express` v5.2.1 - HTTP server framework, routing, middleware (HTTP transport mode)
- `@types/express` v5.0.6 - Express type definitions
- Fetch API (native Node 20+) - HTTP client for Harness API calls
  - Location: `src/client/harness-client.ts` (line 139) - Uses native `fetch()` for all outbound requests
  - Pattern: Automatic retry with exponential backoff, timeout handling, abort signals

**SVG & Rendering:**

- `@resvg/resvg-js` v2.6.2 - SVG rendering to PNG (used for diagram/chart exports)
  - Location: Likely in visualization/dashboard rendering paths

**Environment & Config:**

- `dotenv` v17.3.1 - Load .env files for local development
  - Location: Imported implicitly via Node's dotenv support or explicit calls in startup

## Build & Toolchain

**Compiler:**
- TypeScript 5.7.3 - Compiles src/ → build/ (ES2022, ESM output)
  - Config: `tsconfig.json` - strict mode, source maps, declarations enabled
  - Target: ES2022, Module: Node16, Strict null checks, no unchecked indexed access
  - Output: `build/` directory (excluded from git, generated on `pnpm build`)

**Testing:**
- Vitest 3.0.6 - Fast unit test runner (Jest-compatible)
  - Config: `vitest.config.ts` - Node environment, includes `tests/**/*.test.ts`
  - Assertion library: Vitest built-in (compatible with Jest)
  - Test files: `tests/` directory with structure mirroring `src/` (client, tools, registry, integration, prompts, resources)

**Development:**
- `@types/node` v22.13.5 - Type stubs for Node.js built-ins

## Configuration & Environment

**Environment Variables (Required):**
- `HARNESS_API_KEY` - Harness PAT token (`pat.<accountId>.<tokenId>.<secret>`) or Service Account token
  - Validation: Zod schema in `src/config.ts`, account ID auto-extraction from PAT format
  - Location: `src/config.ts` lines 18-20, extraction logic lines 8-14

**Environment Variables (Optional with Defaults):**
- `HARNESS_ACCOUNT_ID` - Manual account ID override (auto-extracted from PAT if omitted)
- `HARNESS_BASE_URL` - Default: `https://app.harness.io` (supports self-managed Harness deployments)
- `HARNESS_ORG` - Default org identifier (defaults to "default")
- `HARNESS_PROJECT` - Default project identifier (optional)
- `HARNESS_API_TIMEOUT_MS` - Default: 30000ms (request timeout)
- `HARNESS_MAX_RETRIES` - Default: 3 (exponential backoff retry count)
- `LOG_LEVEL` - Default: "info" (debug|info|warn|error)
- `HARNESS_TOOLSETS` - Comma-separated list of enabled toolsets (if unset, all enabled)
- `HARNESS_MAX_BODY_SIZE_MB` - Default: 10 (max HTTP body size for Express)
- `HARNESS_RATE_LIMIT_RPS` - Default: 10 requests/sec (client-side rate limiter)
- `HARNESS_READ_ONLY` - Default: false (disable write operations if true)
- `HARNESS_SKIP_ELICITATION` - Default: false (skip user confirmation prompts)
- `HARNESS_ALLOW_HTTP` - Default: false (allow non-HTTPS URLs for dev/testing)
- `HARNESS_FME_BASE_URL` - Default: `https://api.split.io` (Feature Management Engine base URL)

**Config Validation:**
- Location: `src/config.ts` - Zod schema `ConfigSchema` with transforms
- Pattern: `loadConfig()` function loads `process.env`, validates via Zod, throws on invalid config
- Deprecation handling: `HARNESS_DEFAULT_ORG_ID` / `HARNESS_DEFAULT_PROJECT_ID` mapped to new `HARNESS_ORG` / `HARNESS_PROJECT` names with warnings

**File Configuration:**
- `.env.example` - Documents all available env vars and their purposes
- `.env` - Local development config (not committed)
- `tsconfig.json` - TypeScript compiler options

## Production Build & Deployment

**Docker:**
- Multi-stage build (`Dockerfile`):
  - Build stage: Node 22-alpine, pnpm install, TypeScript compilation, output to `build/`
  - Runtime stage: Node 22-alpine, production deps only, non-root user (mcp), health check via HTTP
  - Exposed port: 3000 (HTTP transport mode)
  - Health endpoint: GET /health (returns `{ status: "ok", sessions: N }`)
  - Entrypoint: `node build/index.js http` (HTTP transport by default in containers)

**Package Distribution:**
- npm package: Published as `harness-mcp-v2` (see `package.json` name field)
- Binary: `bin/harness-mcp-v2` entry point executable script
- Main: `build/index.js` (ESM, requires Node 20+)
- Published files: `build/` directory only (files field in `package.json`)

**Pre-publish Hook:**
- `prepublishOnly` script runs `pnpm build` before npm publish (ensures built output included)

## Development Commands

```bash
# Build TypeScript → build/
pnpm build

# Watch mode (auto-recompile)
pnpm dev

# Start server — stdio transport (local)
pnpm start

# Start server — HTTP transport on port 3000
pnpm start:http

# Interactive MCP inspector (test tools/resources)
pnpm inspect

# Type check only (no emit)
pnpm typecheck

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Sync external schemas (if applicable)
pnpm sync-schemas

# Build Docker image
pnpm docker:build

# Run Docker container
pnpm docker:run
```

## Platform Requirements

**Development:**
- Node.js 20.0.0 or later (ES2022 features, native fetch, AbortSignal)
- pnpm 10.18.2 (corepack-managed)
- TypeScript 5.7.3 (via pnpm)
- 500MB+ disk for node_modules

**Production:**
- Node.js 20.0.0+ (runtime requirement in engines field)
- 100MB+ for `build/` + production `node_modules`
- Port 3000 (HTTP transport) or stdin/stdout (stdio transport)
- TLS/SSL for HTTPS (required by default, overridable via `HARNESS_ALLOW_HTTP=true`)

## Key Technical Decisions

**1. Fetch API (Native)**
- No external HTTP client (axios, node-fetch, undici)
- Uses native Node 20+ `fetch()` with `AbortController` for timeout + client disconnect handling
- Location: `src/client/harness-client.ts` line 139

**2. Zod v4 (Explicit Subpath)**
- All imports: `import * as z from "zod/v4"` (not bare `"zod"`)
- Ensures consistent schema API across versions
- Pattern enforced in codebase to avoid version ambiguity

**3. Dual Transport (Stdio + HTTP)**
- Stdio: Single persistent connection for local IDE plugins
- HTTP: Session-based stateful with SSE, ideal for cloud deployment
- Session TTL: 30 minutes, rate limited at 60 req/min per IP
- Location: `src/index.ts` lines 68-378

**4. Retry with Exponential Backoff**
- Retries: HTTP 429, 500-504 only (not 4xx except 429)
- Backoff: 1s → 2s → 4s with jitter (BASE_BACKOFF_MS = 1000)
- Max retries: Configurable (default 3)
- Location: `src/client/harness-client.ts` lines 109-114

**5. Rate Limiting (Client-side Token Bucket)**
- Token bucket algorithm: Refill at `HARNESS_RATE_LIMIT_RPS` (default 10/sec)
- Max wait: Configurable timeout per request
- Location: `src/utils/rate-limiter.ts`

**6. Structured Logging to stderr**
- NO console.log (breaks stdio JSON-RPC protocol)
- All logs: `console.error()` (structured logger writes to stderr)
- Critical for stdio transport compatibility
- Location: `src/utils/logger.ts`, used throughout

---

*Stack analysis complete: 2025-04-03*
