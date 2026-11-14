# Issue 005: `HarnessClient.getCurrentUserId()` Credential-Blind Caching & HTTP Mode CORS Origin Handling

**Status:** Fixed in `fix/registry-taxonomy-and-dispatch-guardrails`
**Date:** 2026-11-13
**Related:** `src/client/harness-client.ts`, `src/index.ts`, `src/utils/http-hosts.ts`

---

## 1. Problem Statement

### 1.1 `HarnessClient.getCurrentUserId()` Caches User UUID Without Keying by Active Credential / Account (`src/client/harness-client.ts:314, 481-500`)

`HarnessClient.getCurrentUserId()` resolves the authenticated user's UUID via `GET /ng/api/user/currentUser` (used by preflight hooks such as STO exemption approve/reject/promote to stamp the actor UUID).

Previously, `HarnessClient` cached `this.currentUserId` and `this.currentUserPromise` in plain instance fields for the lifetime of the `HarnessClient` object:

```ts
private currentUserId?: string;
private currentUserPromise?: Promise<string>;

async getCurrentUserId(): Promise<string> {
  if (this.currentUserId) return this.currentUserId;
  if (this.currentUserPromise) return this.currentUserPromise;
  ...
```

However, `HarnessClient` supports dynamic per-request/per-session resolvers (`setAccountIdResolver` and `setBearerTokenResolver`, plus token refresh in OAuth / OAuth-proxy sessions via `refreshOAuthSessionCredential`). If the underlying account ID or bearer token changes on a client instance, `getCurrentUserId()` would return a cached UUID belonging to a previous credential/account.

### 1.2 HTTP Mode CORS `Access-Control-Allow-Origin` Emits `http://0.0.0.0:<port>` and Ignores `HARNESS_MCP_ALLOWED_HOSTS` (`src/index.ts:300-307`)

In `src/index.ts:300-307`:

```ts
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", `http://${host}:${port}`);
  ...
```

1. When `HOST=0.0.0.0` (standard in Docker and Kubernetes deployments) or `::`, the response header is literally `Access-Control-Allow-Origin: http://0.0.0.0:3000`, which is never a valid browser `Origin`.
2. Even when `HARNESS_MCP_ALLOWED_HOSTS` is configured (or when requests originate from `https://mcp.harness.io` or `http://localhost:<port>` while bound to `127.0.0.1`), a legitimate `Origin` whose hostname is already permitted by `resolveHttpHostValidationOptions(host, config)` is rejected by browser CORS checks if it doesn't byte-match `http://${host}:${port}`.

---

## 2. Solution Implemented in This Branch

1. **Credential-Keyed Cache in `HarnessClient.getCurrentUserId()` (`src/client/harness-client.ts`):**
   - Compute a cache key from the active account and credential (`${this.resolveAccountId()}:${this.bearerTokenResolver?.() ?? this.token}`) and invalidate `currentUserId` / `currentUserPromise` whenever the key changes.
2. **Allowed-Host-Aware CORS Origin Resolution (`src/utils/http-hosts.ts` & `src/index.ts`):**
   - Added `resolveCorsAllowOrigin(requestOrigin, host, port, allowedHosts)` in `src/utils/http-hosts.ts`:
     - Normalizes wildcard bind addresses (`0.0.0.0`, `::`, `[::]`) to `127.0.0.1` for the fallback origin.
     - If the request carries an `Origin` header whose parsed hostname is in the validated `allowedHosts` set (from `resolveHttpHostValidationOptions(host, config)`), reflects that origin (with `Vary: Origin`).
     - Never emits `Access-Control-Allow-Origin: *` or reflects untrusted origins.
