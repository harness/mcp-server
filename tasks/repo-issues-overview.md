# Open Issues Review — harness-mcp-server

> Reviewed: 2026-04-03

---

## Summary

There are **2 open issues** in the repository. Both are feature requests focused on improving how the MCP server identifies and authenticates requests to the Harness API.

| # | Title | Author | Created | Complexity | Status |
|---|-------|--------|---------|------------|--------|
| [#55](https://github.com/harness/mcp-server/issues/55) | Add "mcp" header | @rssnyder | 2026-04-02 | Low | Ready to implement |
| [#32](https://github.com/harness/mcp-server/issues/32) | SSO support or HTTP Header auth | @vrabbi | 2026-02-23 | High | In progress (per maintainer comment) |

---

## Issue #55: Add "mcp" header

**Author:** Riley Snyder (@rssnyder)
**Created:** 2026-04-02
**Labels:** None
**Comments:** 0

### Request

Add a distinguishing header to all Harness API requests made by the MCP server, so Harness can differentiate MCP-originated requests from human requests in the audit log.

### Current State

The `HarnessClient` (`src/client/harness-client.ts`) currently sets these headers on every request:

- `Harness-Account: <accountId>` (always)
- `x-api-key: <token>` (when no `Authorization` header is present)
- `Content-Type` (when there's a body)

There is no custom header identifying the request source as "mcp".

### Implementation Assessment

**Complexity: Low** — This is a straightforward change in one file.

**Recommended approach:**

1. Add a custom header (e.g., `X-Harness-Source: mcp` or `User-Agent: harness-mcp-server/<version>`) to the `headers` object in both `request()` and `requestStream()` methods in `src/client/harness-client.ts`.
2. The header name/value should be coordinated with the Harness backend team to ensure it's recognized and surfaced in the audit log.

**Affected files:**
- `src/client/harness-client.ts` — Add the header to the `headers` object in `request()` (line ~86) and `requestStream()` (line ~244).

**Considerations:**
- Header name convention: `X-Harness-Source: mcp` is clean, or the broader `User-Agent: harness-mcp-server/2.0.0` could serve dual purpose (identification + version tracking).
- The version could be pulled from `package.json` or hardcoded.
- Should allow user override (e.g., if Harness already defines a specific header name for this purpose).

---

## Issue #32: SSO support or HTTP Header auth

**Author:** Scott Rosenberg (@vrabbi)
**Created:** 2026-02-23
**Labels:** None
**Comments:** 1 (from @thisrohangupta, collaborator)

### Request

The MCP server currently requires a static API key (`HARNESS_API_KEY` env var), making it unsuitable for secure multi-user/team deployment. The request is for:

1. **OAuth/SSO support** — allowing users to authenticate via their existing Harness SSO identity.
2. **HTTP header-based credential passing** — when running in remote HTTP Streamable transport mode, allowing per-user auth credentials to be passed via HTTP headers instead of a shared static key.

### Current State

- **Authentication:** `HarnessClient` uses a single static `x-api-key` token from config, injected on all requests. The `AccountIdResolver` mechanism exists for per-request account ID resolution, but there's no per-request token resolution.
- **HTTP transport:** The server already supports session-based Streamable HTTP transport (`src/index.ts`, `startHttp()`). Each session creates its own `McpServer` + `StreamableHTTPServerTransport` instance, but they all share the same `Config` (and thus the same API key).
- **Existing infrastructure:** The code already has a guard (`if (!headers["Authorization"] && !headers["x-api-key"])`) that skips injecting the static API key when an `Authorization` header is already present — suggesting some groundwork for external auth was anticipated.

### Maintainer Response

@thisrohangupta (collaborator) commented:
> "We are working on this, we are working on a remote harness hosted mcp that supports OAuth for customers"

This suggests the Harness team is building a hosted MCP service with OAuth, which may supersede the need for the OSS server to implement OAuth directly.

### Implementation Assessment

**Complexity: High** — This is an architectural change affecting auth flow, session management, and client instantiation.

**Possible approaches for the OSS server:**

1. **Per-session API key injection (medium effort):** In HTTP mode, extract a bearer token or API key from the incoming HTTP request headers and inject it into a per-session `HarnessClient` instead of using the global config key. This preserves the existing PAT-based auth model while enabling per-user keys.
   - Requires: creating a new `HarnessClient` per session, or using `AsyncLocalStorage` to scope the token per-request.
   - The `AccountIdResolver` pattern already exists and could be extended to a `TokenResolver`.

2. **OAuth proxy mode (high effort):** Implement OAuth 2.0 authorization code flow where the MCP server acts as an OAuth client to Harness's identity provider, exchanging user tokens for API access.
   - Requires: OAuth client registration, token exchange, refresh token handling, session-to-token mapping.
   - This is likely what the Harness-hosted MCP is building.

3. **Header pass-through (low-medium effort):** In HTTP mode, pass the `Authorization` header from the MCP client request directly through to Harness API calls. This delegates auth entirely to the caller.
   - The auth guard in `HarnessClient.request()` already supports this pattern.
   - Requires: per-session client configuration, documentation of expected header format.

**Given the maintainer's comment that Harness is building a hosted OAuth solution, the pragmatic OSS approach would be option 1 or 3** — enabling per-user API keys in HTTP mode without building a full OAuth stack.

**Affected files (for option 1/3):**
- `src/index.ts` — Extract auth token from HTTP request, pass to per-session config.
- `src/client/harness-client.ts` — Support per-request token override (similar to existing `AccountIdResolver`).
- `src/config.ts` — Make `HARNESS_API_KEY` optional when running in HTTP mode with header-based auth.

---

## Recently Closed Issues (Context)

12 issues have been closed, covering topics like:
- **#54** — Rename "DEFAULT" options (closed 2026-04-03)
- **#47/#46** — Trigger creation body format and pipeline identifier bugs
- **#39** — TLS error for execution logs with non-default base URL
- **#38** — Feature request for `create_feature_flag`
- **#37** — Cross-org/project navigation
- **#31** — Logs and default toolsets rejected
- **#27** — Timestamp formatting in deployment details
- **#26** — npm/PyPI publishing
- **#21–23** — Various `download_execution_logs` issues

The project has been actively maintained with a good closure rate on reported issues.
