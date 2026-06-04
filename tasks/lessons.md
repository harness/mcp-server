# Lessons Learned

## Harness SAT Account Extraction
- **Issue**: Service account tokens can use the same account-scoped segment shape as PATs, but the parser only recognized the `pat` prefix.
- **Fix**: Extract account IDs from both `pat` and `sat` prefixes, and let multi-user HTTP sessions derive `HARNESS_ACCOUNT_ID` from either prefix when `x-harness-account-id` is omitted.
- **Rule**: Before requiring explicit account IDs for new Harness API key types, check whether the token format embeds the account ID segment; preserve explicit account overrides and mismatch validation.

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

## Product Credentials in Multi-User Mode
- **Issue**: A deployment-level product credential can silently override the per-session credential after `mergeConfigWithSessionHeaders()` injects the user's API key, breaking shared HTTP auth isolation.
- **Fix**: Reject server-held product credentials in `HARNESS_MCP_MODE=multi-user` unless there is an explicit per-session credential channel, and defensively ignore shared product credentials in auth resolvers for multi-user configs.
- **Rule**: For any product-specific auth config, test the full multi-user path: base config → session header merge → product auth resolver. The resolved product credential must remain tied to the session user or fail closed.

## Public Config Surface Alignment
- **Issue**: Adding or documenting an env var without updating packaged manifests leaves manifest-driven and MCPB installs unable to configure it.
- **Fix**: Update `manifest.json`, `mcp-directory/manifest.json`, and release metadata tests for every public config knob exposed in source docs or `.env.example`.
- **Rule**: Before finishing env config changes, search all public config surfaces and lock the expected manifest exposure in tests.

## GUI MCP Client Executable Paths
- **Issue**: GUI MCP clients may not inherit shell `PATH`, so examples using bare executable names can still fail with `spawn <command> ENOENT`.
- **Fix**: For Cursor and similar GUI-client examples, show absolute executable paths and include the Node directory in `env.PATH`.
- **Rule**: When documenting GUI-client stdio MCP configs, avoid PATH-dependent `command` values unless the surrounding text explicitly scopes them to shell-based clients.

## Runtime Payload Documentation
- **Issue**: Documentation can overstate a payload contract by describing intended fields that the current tool handlers do not populate.
- **Fix**: Either wire the field through the runtime path in the same PR or document the current emitted shape precisely.
- **Rule**: Before documenting audit, schema, or tool payload fields as guaranteed, verify the exact dispatch path and at least one focused runtime/test assertion.
