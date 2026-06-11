# Lessons Learned

## Read Cache Signals Must Not Block Execute Paths
- **Issue**: A remote pipeline `pipeline.get` response can report `cacheResponse.cacheState=STALE_CACHE` and old YAML from the read/UI cache, while pipeline execution is documented to fetch entities from Git for the selected pipeline branch.
- **Fix**: Do not fail-close `harness_execute` based on `pipeline.get` cache metadata. Preserve explicit branch selection by sending `pipelineBranchName` for remote executions, and only block execution on signals from the execute path itself.
- **Rule**: A preflight may only block an operation when it proves the same backend path the operation will use. If a check observes a read-model/cache path, surface it as diagnostic context at most, not as execution authority.

## Multipart Tool Contracts
- **Issue**: Multipart body builders can hide unsafe defaults or malformed encoded inputs until after request construction, and execute shorthands can drift from generic `resource_id` mapping.
- **Fix**: Validate encoded content before `Buffer.from`, enforce documented scalar/enum types inside multipart builders, reject disallowed or mutually exclusive payload variants when present, require parent IDs explicitly when the API needs location context, accept the registry's mapped primary identifier in execute body builders, reject conflicting resource-specific aliases in shorthand and full-body modes, and document operation-specific body contracts via `paramsSchema`/`bodySchema`.
- **Rule**: For multipart resources, fail loudly before network I/O and add regressions for generic tool paths (`resource_id` -> resource identifier), alias conflicts in every accepted input shape, direct helper inputs, and `harness_describe` body/params metadata. If create and update have different one-of requirements, split the body schemas instead of relying on one ambiguous shared schema.

## Execute Action Scope and Read-Only Semantics
- **Issue**: A read-like endpoint modeled as an execute action can drift from the generic read/list/get contract: `resource_scope` may be unavailable on the public execute tool, URL-derived scope may not be merged, and read-only mode may block the action solely because it is under `harness_execute`.
- **Fix**: Expose `resource_scope` on execute when execute actions use multi-scope resources, opt the handler into URL-derived resource scope, and gate read-only mode by the action's `operationPolicy.risk` instead of the tool family alone.
- **Rule**: For any execute action with `risk: "read"` or multi-scope support, add regressions for the registered tool input schema, explicit and URL-derived `resource_scope`, and read-only mode behavior.

## Endpoint-Specific Node Type Constraints
- **Issue**: Reusing a general FileStoreNode enum for a folder-only endpoint let agents construct `FILE` requests that the backend endpoint should reject.
- **Fix**: Add endpoint-specific validators and schema descriptions when an API accepts only one value from a broader shared model.
- **Rule**: If an endpoint path names a subtype such as `/folder`, do not surface the full shared enum unless that exact endpoint accepts every enum value. Add helper and `harness_describe` metadata regressions for rejected enum values.

## URL-Derived Scope Must Match Tool Surfaces
- **Issue**: URL parsing can synthesize `resource_scope`, but a tool that exposes `resource_scope` still ignores URL-derived scope unless it opts into `applyUrlDefaults(..., { includeResourceScope: true })`.
- **Fix**: Keep URL-derived scope behavior aligned across every public tool that accepts `resource_scope`, including create/update/delete paths, and test scoped URLs at the tool-handler level.
- **Rule**: When adding a resource type to the URL-derived scope allowlist, audit every tool that accepts both `url` and `resource_scope`; either opt the tool in or avoid advertising URL-derived scope for that resource.

## URL-Derived IDs Must Match Tool Schemas
- **Issue**: A tool can advertise URL-derived IDs while its schema still requires an explicit `resource_id`, so strict MCP clients reject URL-only calls before handler defaulting can run.
- **Fix**: If URL copy says an ID is extracted, make the public schema accept URL-only input and map the resolved URL/defaulted `resource_id` into the resource-specific identifier field before dispatch.
- **Rule**: For any write tool that advertises URL ID extraction, add handler-level regressions that omit `resource_id` and prove the URL-derived ID reaches the backend path.

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

## Logger-Filtered Audit Sinks
- **Issue**: Saying stderr audit output is always emitted hides that the stderr sink routes through the shared logger and respects `LOG_LEVEL`.
- **Fix**: Document stderr as registered by default, and direct durable audit collection to file or webhook sinks.
- **Rule**: For telemetry sinks built on shared logging, document both registration and filtering semantics.

## Public Tool-Contract Discipline (Knowledge Graph / semantic-layer PR)
- **Context**: The KG/semantic-layer OSS port (PR #255) took four "Sunil On Demand Architecture Review" (Cursor bot) rounds. Every finding fell into a small set of repeatable public-contract categories — capturing them here so future resources clear review in one pass.
- **Patterns and fixes**:
  - **Raw passthrough leaks the backend envelope.** `hql_query.run` shipped `responseExtractor: passthrough`, forwarding query-service debug/meta fields across the tool boundary. Fix: project a stable shape (`hqlRunExtract` → `{columns, rows, stats}`, unwrapping a `data`/`result` envelope). Never `passthrough` on a real endpoint.
  - **Published field name must match its source.** `kg_queryable_type_summary` filled `connectorId` from `connector_reference.connector_name` (a display label), making the documented JOIN key unstable. Fix: prefer `connector_identifier`/`identifier`, fall back to name only if that is all the API returns.
  - **`stripInternalMeta()` correctness in both directions.** Pruning on the pre-recursion shape both dropped meaningful empty collections (`{relationship_types: []}` → `{}`) and left `{}` placeholder rows (`{fields:[{columnMappingMeta:{...}}]}` → `{fields:[{}]}`). Fix: recurse first, preserve explicitly-empty arrays, then prune array elements that collapse to `{}`. Also re-strip any raw `obj.*` fields reattached after the initial strip (e.g. `dcs_enrichment` join_predicates/references/fields), since they re-introduce nested `columnMappingMeta`.
  - **Body builders must not silent-drop falsy values.** `hqlRunBody` used truthiness (`timeoutMs ? ...`), rewriting `timeout_ms: 0` out of the request. Fix: `!= null` checks so `0`/`false` reach the API or fail loudly.
  - **Read-only/confirmation gating is risk-based, not tool-family-based.** The batch-HQL path blocked all execute actions in read-only mode while `registry.dispatchExecute()` allows `risk: "read"`. Fix: gate on `actionSpec.operationPolicy.risk !== "read"`, mirroring the registry. Classify `risk` by behavior — HQL is a pure query language (find/filter/select/join, no mutations), so `run` is `risk: "read"`, not `low_write`.
  - **List-only metadata on get-only resources misleads discovery.** `kg_related_type` (get-only) set `listFilterFields`, so `harness_describe`/`harness_list` advertised `kind`/`include_transitive` as list filters. Fix: drop `listFilterFields`; document get params via the get op's `paramsSchema`. Add local required-field validation (throw a plain `Error` from the body builder → surfaces as a clean `errorResult` via `isUserError`) so a missing id fails locally instead of sending an id-less body.
- **Rule**: For every new/changed resource, run the **Pre-Push Architecture-Review Pass** in `AGENTS.md` §Workflow 7 before pushing, and pair every new extractor/body builder with both a response-shape test (envelope dropped, empty/edge cases) and a request-shape test. "No focused coverage" is itself a recurring review finding.
- **Build/docs gotcha**: `pnpm docs:generate` and `docs:check` read from `build/`. Always `pnpm build` first or counts go stale and CI `docs:check` fails.
