# Tool Filtering Middleware

This package contains the HTTP middleware responsible for dynamic, license-aware tool filtering for the MCP server.

## Overview

The `HTTPToolFilteringMiddleware` intercepts incoming JSON-RPC requests over HTTP to ensure that clients can only see and execute tools they are authorized to use. Authorization is determined by a combination of:
1.  The modules requested by the client via the `X-Harness-Modules` HTTP header.
2.  The modules the client's account is licensed to use, fetched from the Harness License API.

To improve performance, license information is cached in-memory with a configurable TTL.

## How It Works

The middleware inspects the `method` of each incoming JSON-RPC request and takes action accordingly.

### 1. Request Enrichment (`enrichContextWithDynamicFiltering`)

For both `tools/list` and `tools/call` requests, the middleware first enriches the request context. This is the core logic hub:

1.  **Account ID Extraction**: It extracts the `accountID` from the request context (previously populated by the auth middleware).
2.  **License Fetching**: It calls `getLicensedModulesForAccount` to get a list of licensed modules for the account.
    - This function first checks a global, in-memory **License Cache**.
    - On a cache miss, it calls the Harness License API. The result is then cached for a configurable duration (default: 30 minutes).
    - If the API call fails, a fallback value of `["CORE"]` is cached to prevent repeated failed calls.
3.  **Module Scope Determination**:
    - It reads the `X-Harness-Modules` header, which is a comma-separated list of module names (e.g., `CI,CD,CCM`).
    - **If the header is empty or not present, it defaults to using all modules the account is licensed for.** This ensures clients see all their available tools by default.
4.  **Allowed Toolset Computation**: It computes the final set of `allowedToolsets` by:
    - Finding the intersection of the requested modules and the licensed modules.
    - Always including the `CORE` module.
    - Expanding each allowed module into its constituent toolsets (e.g., `CI` -> `harness_ci_pipelines`, `harness_ci_builds`) using the `ModuleRegistry`.
5.  **Context Population**: The `allowedToolsets` are stored in the request context for downstream use.

### 2. `tools/list` Filtering

When the method is `tools/list`, the middleware:
1.  Calls the downstream MCP server to get the full list of all registered tools.
2.  Captures the JSON-RPC response.
3.  Filters the `result.tools` array, keeping only the tools that belong to one of the `allowedToolsets` from the context.
4.  Returns the filtered JSON-RPC response to the client.

### 3. `tools/call` Authorization

When the method is `tools/call`, the middleware:
1.  Extracts the `name` of the tool being called from the request parameters.
2.  Determines which toolset that tool belongs to using `findToolGroup`.
3.  Checks if that toolset is present in the `allowedToolsets` from the context.
4.  If allowed, it passes the request to the downstream MCP server to execute the tool.
5.  If not allowed, it immediately returns a JSON-RPC authorization error, preventing the tool from being executed.

## Configuration

The license cache behavior can be configured via the server's main configuration file or environment variables.

- `license_cache_ttl`: The Time-To-Live for a cached license entry. (Default: `30m`)
- `license_cache_clean_interval`: The interval at which the cache is scanned for expired entries. (Default: `5m`)

Example `config.yaml`:
```yaml
license_cache_ttl: "1h"
license_cache_clean_interval: "10m"
```
