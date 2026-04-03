# Codebase Concerns

**Analysis Date:** 2026-04-03

## Tech Debt

**Incomplete Agent Pipeline Execute Endpoint:**
- Issue: Agent execution endpoint is commented out pending backend readiness. Two TODOs block execution.
- Files: `src/registry/toolsets/agent-pipelines.ts` (lines 39, 120)
- Impact: Users cannot execute agents through the MCP server. Only list, get, create, update, delete operations work.
- Fix approach: Uncomment lines 38-136 in `executeActions` block when backend endpoint stabilizes. Verify endpoint contract matches OpenAPI spec.

**Deprecated Environment Variable Names:**
- Issue: Old config names `HARNESS_DEFAULT_ORG_ID` and `HARNESS_DEFAULT_PROJECT_ID` still supported for backward compatibility but trigger deprecation warnings to stderr.
- Files: `src/config.ts` (lines 58-62, 25-26, 64-65)
- Impact: Legacy code paths remain and must be maintained. Console errors leak to stderr, potentially visible in CI logs.
- Fix approach: Set a deprecation timeline (e.g., next major version), then remove old name support entirely. Update all documentation and examples to use `HARNESS_ORG` and `HARNESS_PROJECT`.

---

## Security Considerations

**API Key Extraction from PAT Token:**
- Risk: Function `extractAccountIdFromToken()` splits PAT tokens by `.` to extract account ID. If token format changes or parser receives malformed token, extraction silently returns `undefined`.
- Files: `src/config.ts` (lines 8-15)
- Current mitigation: Fallback to explicit `HARNESS_ACCOUNT_ID` env var required. Token structure validated via split length check.
- Recommendations: 
  1. Add explicit validation that PAT token parts[1] matches account ID format (alphanum + hyphens)
  2. Log warnings when extraction fails (currently silent)
  3. Document that only PAT tokens are supported for auto-extraction; Service Account tokens require explicit `HARNESS_ACCOUNT_ID`

**Insufficient Authorization Validation:**
- Risk: HTTP client sets `Harness-Account` header but doesn't validate that all API calls respect org/project scoping. An agent could theoretically craft requests to org/projects outside their default scope.
- Files: `src/client/harness-client.ts` (lines 86-89)
- Current mitigation: `common.FetchScope()` function exists in harness-code but is not imported here. Registry layer doesn't validate scope consistency on write operations.
- Recommendations:
  1. Add pre-request validation in `HarnessClient.request()` to ensure `orgIdentifier` and `projectIdentifier` match config defaults or are whitelisted
  2. Log scope changes with WARNING level to audit trail
  3. Add test for cross-org/project operation prevention

**HTTPS-Only Enforcement with Escape Hatch:**
- Risk: `HARNESS_ALLOW_HTTP=true` disables HTTPS enforcement for development. If accidentally set in production, API calls go over unencrypted HTTP.
- Files: `src/config.ts` (lines 50-54)
- Current mitigation: Configuration validation in Zod schema. Clear error message if HTTPS missing.
- Recommendations:
  1. Add startup warning if `HARNESS_ALLOW_HTTP=true` (never should be prod)
  2. Check for HTTP URLs in HARNESS_BASE_URL and log critical warning
  3. Add env var `HARNESS_REQUIRE_HTTPS=true` (default) to make HTTPS mandatory by default

---

## Performance Bottlenecks

**Unbounded Memory Growth in HTTP Session Manager:**
- Problem: Rate-limit tracking map (`ipHits`) and session store (`sessions`) grow indefinitely if reaper interval doesn't trigger or clients don't properly disconnect.
- Files: `src/index.ts` (lines 125-176, 150)
- Cause: Sessions marked `lastActivity` but no forced timeout enforced if client hangs. Rate-limit map evicts on-read but if stale entries never expire after reap cycle, memory accumulates.
- Improvement path:
  1. Add maxSessions cap (e.g., 1000). Reject new sessions if exceeded.
  2. Reduce SESSION_TTL_MS from 30 min to 15 min for production deployments
  3. Add Prometheus metrics: `mcp_sessions_active`, `mcp_rate_limit_entries`, `mcp_session_reaps` to detect reaper failures
  4. Force close sessions after 3 consecutive failed requests to clean up zombie connections

**List Operations Without Pagination Limits:**
- Problem: Execution summary API hard-capped at 10,000 records max. Other list endpoints may not enforce limits, allowing unbounded result sets.
- Files: `src/registry/toolsets/pipelines.ts`, `src/registry/toolsets/chaos.ts`, others (40+ toolsets)
- Cause: API pagination params optional. No client-side size validation before response processing.
- Improvement path:
  1. Add `maxResultsAllowed: 10000` to all list operation specs
  2. Registry layer validates `page` and `size` params before API call
  3. Warn in logs if `size * page >= 5000` (approaching high-volume threshold)
  4. Return pagination metadata to agent with `_hint: "Results truncated. Use page=2 to continue."`

**Concurrent SVG Rendering Without Resource Pooling:**
- Problem: SVG generation (`src/utils/svg/`) uses synchronous `resvg-js` rendering. Multiple concurrent visualizations block Node event loop.
- Files: `src/utils/svg/render-png.ts` (line 30), visualization responses in tools
- Cause: No worker pool or async SVG renderer. Each `renderPng()` call blocks main thread.
- Improvement path:
  1. Add optional worker pool for SVG rendering (using Node.js `worker_threads`)
  2. Or, cache SVG generation results by execution ID / pipeline ID to reduce redundant renders
  3. Add timeout (e.g., 5s) for SVG rendering — if SVG too complex, return text summary instead

---

## Fragile Areas

**Type Safety Gaps in Response Extractors:**
- Files: `src/registry/extractors.ts` (lines 10-50, 63-79)
- Why fragile: Extractors use unsafe type casts: `const r = raw as { data?: ... }`. If Harness API changes response shape, extractors fail silently and return `undefined` or empty arrays.
- Safe modification:
  1. Create branded types for expected API response shapes (e.g., `type NgApiResponse<T>`)
  2. Add Zod schema validation in each extractor before casting
  3. Log warnings when extraction results in empty/falsy values
  4. Write tests for each extractor with real Harness API responses (integration tests)
- Test coverage: None. No tests for extractors.

**Registry Dispatch Logic Relies on String Matching:**
- Files: `src/registry/index.ts` (lines 102-129, 134-142, 150-176)
- Why fragile: Toolset names and resource types are plain strings with no compile-time validation. Misspelling a resource type returns a runtime error. No IDE autocomplete.
- Safe modification:
  1. Convert `ToolsetName` and resource types to branded string types or enums
  2. Auto-generate TypeScript enums from toolset definitions
  3. Add `getResource()` overload that accepts typed resource keys
  4. Create CLI command to validate all toolsets load without errors
- Test coverage: No tests for registry dispatch logic.

**Harness API Response Structure Assumptions:**
- Files: Nearly all toolset files import extractors and assume API returns expected shape.
- Why fragile: If Harness API adds/removes fields or restructures pagination, many tools simultaneously break.
- Safe modification:
  1. Create central API schema definitions (currently stored as inline extractors)
  2. Add response validation in `HarnessClient.request()` for critical endpoints
  3. Log mismatches: `warn("Unexpected API response shape", { expected, got })`
  4. Consider using `zod` schemas for all API responses
- Test coverage: 12 test files but none test live Harness API contract.

**Incomplete Error Classification:**
- Files: `src/utils/errors.ts` (lines 40-52)
- Why fragile: `isUserFixableApiError()` only catches 400/404. Other 4xx codes (429 too many requests, 422 validation) are treated as system errors even though they're user-fixable.
- Safe modification:
  1. Expand classification: `400 | 404 | 409 | 422 | 429` are user-fixable
  2. Test each error code path (410 Gone, 413 Payload Too Large, etc.)
  3. Add error code mapping to specific recovery hints
- Test coverage: No tests for error classification logic.

**Runtime Input Expansion Without Validation:**
- Files: `src/utils/input-expander.ts` (referenced but not fully reviewed)
- Why fragile: Input expansion rules can create malformed nested structures if expansion templates don't match pipeline input schema.
- Safe modification:
  1. Validate expanded inputs against pipeline's `inputSetTemplateYaml` before execution
  2. Log warnings if expansion creates unknown fields
  3. Add dry-run mode to preview expanded inputs
- Test coverage: Limited.

---

## Scaling Limits

**HTTP Session Store Has No Horizontal Scaling:**
- Current capacity: In-memory map. Single Node process. Max ~1000 concurrent sessions before memory pressure.
- Limit: When deployed across multiple processes/containers, sessions stored on one instance are invisible to others (load balancer could route client to different instance, breaking session continuity).
- Scaling path:
  1. Add Redis session store option (env var `HARNESS_SESSION_STORE=redis`)
  2. Implement session serialization/deserialization
  3. Use distributed lock for session destruction (prevent double-delete race)
  4. Add migration guide for production deployments with multiple instances

**Monolithic Tool Registration:**
- Current capacity: All 30+ toolsets loaded at startup. Server initialization time increases with each new toolset.
- Limit: Startup time will become noticeable with 50+ toolsets. ~228K lines of TypeScript across all toolsets.
- Scaling path:
  1. Lazy-load toolsets by demand (only register tools for enabled toolsets)
  2. Implement toolset plugins to load from separate packages
  3. Add startup time metrics and SLA (e.g., max 2s startup)
  4. Consider splitting into multiple specialized MCP servers

**No Caching Layer for Expensive Calls:**
- Problem: Every `harness_list()` call queries the Harness API. No caching of pipeline lists, connector lists, etc.
- Impact: High-frequency agent queries (e.g., "list pipelines", "get project") hammer the API.
- Scaling path:
  1. Add optional Redis caching for read-only operations with TTL
  2. Implement cache invalidation on write operations (create/update/delete)
  3. Add cache metrics: hit/miss rate, evictions
  4. Document cache implications for agents (eventual consistency)

---

## Testing Coverage Gaps

**No Unit Tests for Core HTTP Client:**
- What's not tested: Request retry logic, backoff calculation, auth header injection, error parsing
- Files: `src/client/harness-client.ts` (180+ lines, no tests)
- Risk: Retry logic or error handling changes can silently break without failing tests. Backoff calculation error could cause exponential delays.
- Priority: High

**No Integration Tests for API Contracts:**
- What's not tested: Live Harness API responses match expected extractors. Pagination parity across toolsets.
- Files: All extractors and toolsets rely on assumed response structure
- Risk: API changes in Harness backend break tools without warning. Breaking changes discovered in production.
- Priority: High

**Minimal Prompt/Resource Testing:**
- What's not tested: Prompt argument passing, resource URI parsing, prompt execution end-to-end
- Files: `src/prompts/` (30+ prompt files), `src/resources/` (no tests visible)
- Risk: Prompts fail silently or return wrong content. Resources return malformed URIs.
- Priority: Medium

**No Error Path Testing:**
- What's not tested: 401 unauthorized, 403 forbidden, 404 not found, 429 rate limit, network timeout scenarios
- Files: `src/utils/errors.ts`, tool handlers
- Risk: Error handling code untested. Production errors may not be classified or presented to user correctly.
- Priority: Medium

**Session Manager Never Tested:**
- What's not tested: Session TTL expiration, concurrent session creation/destruction, rate limit per-IP, connection cleanup
- Files: `src/index.ts` (HTTP mode, lines 87-250+)
- Risk: Memory leaks, zombie connections, rate limit bypass in production.
- Priority: High

**No Tests for Registry Dispatch Logic:**
- What's not tested: Unknown resource type handling, operation not supported errors, filter validation
- Files: `src/registry/index.ts` (200+ lines)
- Risk: Registry errors unclear or silently ignored. LLM receives confusing "unknown operation" errors without guidance.
- Priority: Medium

---

## Dependency Management

**Zod 4 Version Constraint:**
- Issue: Project pins `zod@^4.0.0` but Zod 4 schema creation has quirk: `.describe()` must be called LAST or description is lost.
- Files: Documented in `CLAUDE.md` and `tasks/lessons.md` but not in code comments
- Recommendations:
  1. Add ESLint rule to flag `.describe()` followed by other methods
  2. Create utility function `field(name, description, ...validators)` to enforce order
  3. Add test suite for common Zod 4 patterns to catch regressions

**Express v5 (Very Recent):**
- Issue: Express 5.2.1 is very recent. API changes still possible.
- Files: `src/index.ts` (line 49), HTTP mode
- Recommendations:
  1. Pin major version: `express@^5.2.1` (currently OK)
  2. Test periodically against latest Express 5.x minor releases
  3. Monitor Express GitHub for breaking change announcements

**@modelcontextprotocol/sdk v1.27+ Required:**
- Issue: SDK recent, but server code assumes specific type signatures. Any SDK update could break tool registration.
- Files: Throughout, especially `src/tools/index.ts`
- Recommendations:
  1. Add type validation test to ensure MCP SDK interfaces haven't changed
  2. Document minimum SDK version more clearly in README
  3. Run tests against min/max supported SDK versions

**Resvg-js SVG Rendering (Native Binary):**
- Issue: `@resvg/resvg-js@^2.6.2` includes platform-specific native bindings. Could fail at install time on unusual architectures.
- Files: `src/utils/svg/render-png.ts`
- Recommendations:
  1. Add optional flag to disable PNG output if resvg fails to load
  2. Fallback to text-only visualization if PNG rendering unavailable
  3. Document supported platforms in README

---

## Missing Critical Features

**No Live Progress Streaming for Long Operations:**
- Problem: Large log downloads, bulk operations don't report progress back to the client.
- Files: `src/tools/harness-execute.ts`, `src/utils/log-resolver.ts`
- Impact: Agent sees no progress for operations that take >5 seconds. Appears hung.
- Blocker: None technical (API supports server-initiated messages), but elicitation flow may not trigger correctly.

**Read-Only Mode Incomplete:**
- Problem: `HARNESS_READ_ONLY=true` blocks DELETE/CREATE/UPDATE but doesn't prevent URL parsing from extracting sensitive resource IDs.
- Files: `src/registry/index.ts` (lines 205, 240), `src/tools/harness-*.ts`
- Impact: In read-only mode, agent can still see all resource identifiers and structure (low risk but incomplete).

**No Audit Logging of Operations:**
- Problem: No record of which agent performed which operation (execute, create, update, delete).
- Files: No audit layer found
- Impact: Cannot track who ran a pipeline, who created a connector, etc.
- Recommendations:
  1. Add optional audit logger that records operation, resource, agent ID, timestamp
  2. Wire Harness audit APIs to report MCP operations back to platform

---

## Known Bugs & Quirks

**Deprecated Env Vars Print to stderr, Not Structured Logs:**
- Bug: Config deprecation warnings use `console.error()` instead of structured logger
- Files: `src/config.ts` (lines 59, 62)
- Impact: Warnings aren't captured by log aggregation if stderr redirected differently
- Fix: Use `createLogger("config").warn()` instead

**Silent Failure in Log Parsing:**
- Bug: If log blob download fails after retries, error message truncated to 200 chars
- Files: `src/utils/log-resolver.ts` (line 382)
- Impact: Useful error context lost for debugging
- Fix: Store full error in separate field, expose truncated version only in user-facing message

**Rate Limiter Blocks Indefinitely on Timeout:**
- Bug: Rate limiter throws after MAX_WAIT_MS but doesn't log which code path acquired the token late
- Files: `src/utils/rate-limiter.ts` (line 33)
- Impact: Hard to debug which tool operation triggered rate limit timeout
- Fix: Add log line with call stack when timeout occurs

---

## Architectural Concerns

**Monolithic Tool Handlers Without Clear Layering:**
- Issue: Tools (`harness-list.ts`, `harness-get.ts`, etc.) mix concerns: input validation, registry dispatch, error mapping, response formatting.
- Files: `src/tools/harness-*.ts` (7 main tool files, each 100-200+ lines)
- Impact: Hard to add new features (e.g., caching, observability hooks) without modifying all tools.
- Fix: Extract common patterns into middleware layer.

**Extractors Tightly Coupled to Toolset Definitions:**
- Issue: Each toolset imports extractors and uses them inline. Changing an extractor could break multiple toolsets.
- Files: `src/registry/extractors.ts` (150+ lines), imported in 30+ toolset files
- Impact: Ripple effects from extractor changes. No single place to validate all API response structures.
- Fix: Create extractor registry that toolsets reference by name (similar to MCP SDK tools concept).

**No Observability Hooks for Debugging Agent Behavior:**
- Issue: Cannot trace an agent's decision path: which tool it called, which fields it used, why it chose that operation.
- Impact: When an agent makes a mistake, hard to understand why. No visibility into agent reasoning.
- Fix: Add optional OpenTelemetry tracing that captures tool invocations, inputs, outputs, latencies.

---

## Deployment & Operations

**No Health Check for Harness Backend Connectivity:**
- Issue: `/health` endpoint returns `ok` even if Harness API is unreachable
- Files: `src/index.ts` (line 182-184)
- Impact: Load balancer routes traffic to unhealthy server. No early warning.
- Fix: Add optional Harness backend health check to `/health` response (e.g., call account list endpoint)

**Session IDs Not Validated for Format:**
- Issue: Session ID from client header used directly. No validation that it's a valid UUID.
- Files: `src/index.ts` (line 188)
- Impact: Malformed session ID could cause crashes or security issues.
- Fix: Validate session ID format before using as map key.

**No Log Rotation for Stderr Logging:**
- Issue: All logs written to stderr. In Docker/Kubernetes, unbounded stderr can exhaust disk.
- Files: `src/utils/logger.ts` (line 70)
- Impact: Server crashes when log buffer full.
- Fix: Integrate with external log aggregation (e.g., structured logs to CloudLogging, DataDog, etc.)

---

*Concerns audit: 2026-04-03*
