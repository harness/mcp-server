# Lessons Learned

## MCP SDK v1.27+ Type Compatibility
- **Issue**: `server.tool()` callback return type requires `[key: string]: unknown` index signature on the result object.
- **Fix**: Add `[key: string]: unknown` to the ToolResult interface.
- **Rule**: Always check MCP SDK type expectations for return types before defining custom interfaces.

## MCP SDK Prompt API
- **Issue**: `server.prompt()` does NOT accept an array of `{ name, description, required }` for args. It uses a Zod schema object.
- **Fix**: Use `{ paramName: z.string().describe("...").optional() }` format for prompt argument schemas.
- **Rule**: Check the actual SDK `.d.ts` types, not just documentation examples that may be outdated.

## Harness Artifact Registry (HAR) BuildAndPush Step
- **Issue**: HAR uses a different spec shape than third-party Docker registries in `BuildAndPushDockerRegistry` steps. Initially assumed HAR just swaps `connectorRef` to `account.harnessImage` — wrong.
- **Correct HAR spec**: Uses `registryRef` (NOT `connectorRef`). There is NO `connectorRef` at all. `repo` and `registryRef` are both typically `<+input>`.
- **Correct third-party spec**: Uses `connectorRef` (NOT `registryRef`). There is NO `registryRef`.
- **Rule**: HAR and third-party Docker registries are the same step type (`BuildAndPushDockerRegistry`) but mutually exclusive field sets: `registryRef` for HAR, `connectorRef` for third-party. Never mix them.

## LLM Prompt Reliability: Use Exact YAML Templates, Not Prose
- **Issue**: Prose instructions like "use registryRef instead of connectorRef" are unreliable — LLMs still mix up fields ~50% of the time.
- **Fix**: Embed exact copy-paste YAML templates (labeled TEMPLATE A / TEMPLATE B) directly in prompts. LLMs reliably copy from concrete examples.
- **Rule**: When a prompt needs the LLM to generate YAML with variant configurations, always provide the complete YAML snippet for each variant. Prose descriptions of field differences are insufficient.

## Chaos API Base Path
- **Issue**: Chaos toolset previously returned HTTP 404 for all requests (experiments, probes, infrastructures) across projects.
- **History**: The `/gateway` prefix was originally required but has since been removed. The correct base path is now `/chaos/manager/api`.
- **Fix**: Use `/chaos/manager/api` as the chaos API base path.
- **Rule**: When adding new Harness module toolsets, verify the API base path. Modules such as SEI and log-service use `/gateway/` prefix; chaos, ng, pipeline, code, cf, etc. do not.

## Pagination Parity Testing (v1 vs v2)
- **Methodology**: Use the same scope for both v1 and v2 (either both account-level OR both project-level). Compare the first element of page 2 from v1 with the first element of page 2 from v2.
- **Pass criteria**: If the first element of page 2 matches across both servers → pagination parity ✓
- **Fail criteria**: If they differ (same scope) → investigate (API params, sort order, date filters, etc.)
- **Rule**: Apply this pattern to all tools when testing pagination across MCP v1 and v2.

## Multi-Tenant Account Scoping
- **Issue**: Hosted/internal deployments can resolve the effective account ID per request while `Config.HARNESS_ACCOUNT_ID` remains a placeholder such as `internal`.
- **Fix**: Every outbound account scope carrier must use the resolver: query params (`accountIdentifier`/`accountID`), path builders, injected request bodies, deep links, and the `Harness-Account` header.
- **Rule**: When adding account scoping or header-based APIs, add regression tests with `HARNESS_ACCOUNT_ID="internal"` and `accountIdResolver()` returning a real account ID.
