# Harness MCP Server — Task Tracking

## Slack Bug Triage: PR 188 docs:check Failure (2026-05-25)
- [x] Read Slack thread and CI failure logs
- [x] Reproduce `docs:check` against PR head and PR merge ref
- [x] Identify why local and CI results differ
- [x] Implement a minimal fix only if the repo has a bug
- [x] Verify with focused and relevant broader commands
- [x] Commit/push/open PR if a fix is made, then reply in Slack thread

### Plan
- Treat GitHub Actions logs as the source of truth for the failing command and exact checkout ref.
- Compare generated docs counts/diffs on `refs/pull/188/head` and `refs/pull/188/merge` without leaving the working branch.
- If the failure is only a contributor PR README drift, report that clearly; if `docs:check` is misleading or missing actionable output, add focused coverage and improve the script.

### Review
- CI failed on `pnpm docs:check` because PR #188 README had counts generated from stale compiled registry metadata (`168 resource types`, `31/32 toolsets`, `30 prompts`), while a fresh build on the PR source produces `191 resource types`, `32/33 toolsets`, and `32 prompts`.
- Root cause: `docs:generate` and `docs:check` imported `build/registry` but did not rebuild TypeScript first, so local checks could pass against stale `build/` output even though CI rebuilt before checking.
- Fixed `package.json` so both docs scripts run `pnpm build` before `generate-docs.js`, updated the script usage comment, and added `tests/docs-scripts.test.ts` to prevent regression.
- Verified with red/green focused coverage, `pnpm docs:check`, full `pnpm test`, and `git diff --check`.
- Opened the fix PR; Slack reply was blocked because the original channel was not available to the Slack send tool, so no message was posted to any other channel.

## harness_list structured output for array APIs (2026-05-22)
- [x] Root cause: Harness Code `pr_activity` returns a top-level JSON array; `jsonResult` only sets `structuredContent` for objects, so strict MCP clients (Cursor) fail with output schema validation (-32602).
- [x] Add `normalizeHarnessListPayload` and call it from `harness_list` after dispatch; unit tests in `response-formatter.test.ts`.
- [x] Typecheck and focused tests
- [x] Commit, push, PR

### Review
- Normalizes top-level arrays to `{ items, total, page }` and hoists common wrapper keys (`body`, `content`, `data`, …) when `items` is missing; fills `total` when `items` exists without `total`.

## Critical Bug Inspection (2026-05-21)
- [x] Inspect recent commits for high-severity behavioral regressions
- [x] Trace suspicious changes through caller chains and downstream behavior
- [x] Implement a minimal fix only if a concrete critical bug is confirmed
- [x] Run focused verification for reviewed or changed behavior
- [ ] Report the outcome in Slack; open a PR only for a confirmed critical fix

### Plan
- Review recent merged commits after the last critical-bug/documentation automation, prioritizing code changes over docs and version metadata.
- Focus on high-blast-radius surfaces: MCP tool annotations/output contracts, IaCM resource registration, HTTP auth/session handling, request construction, and write-operation safety.
- For each suspicious change, require a concrete trigger scenario that can cause data loss, crashes, security bypass, or significant user-facing breakage before patching.

### Review
- Found that the new `outputSchema` on `harness_list` required `items`, but many existing passthrough list APIs return object shapes such as `content`, `data`, or `resources`; SDK output validation could turn successful API calls into tool errors. Top-level array list responses also had no structured content despite the declared output schema.
- Fixed `harness_list` to normalize array responses into object-shaped `{ items }` structured content and relaxed the list output schema to match actual registry list response shapes while preserving known fields.
- Found `iacm_module.get` could not be called through normal `harness_get(resource_id=...)` because the resource identifier was `id` but the get path required `module_id`.
- Found `iacm_activity_resource_change.list` targeted the non-documented `/activities/{activityId}/resource-changes` path, required an unused `workspace_id`, and truncated the documented execution resource-change response.
- Fixed IaCM module get path parameter mapping and routed resource-change listing to the documented `/executions/{pipeline_execution_id}/resource-changes` endpoint while preserving the existing `activity_id` input as the execution ID.
- Verified with red/green focused coverage, `pnpm typecheck`, `pnpm build`, full `pnpm test`, and `git diff --check`.

## GPT App Tool Annotation Compliance (2026-05-20)
- [x] Add explicit `destructiveHint: false` to all non-destructive read-only MCP tools flagged by the GPT App form
- [x] Add regression coverage that every registered tool sets `readOnlyHint`, `openWorldHint`, and `destructiveHint` to explicit booleans with value assertions
- [x] Run focused tests and typecheck
- [x] Regenerate README for updated resource counts
- [x] Fix smoke test for ai-evals no longer being opt-in
- [x] Remove stale ai-evals opt-in references from README
- [x] Document `harness_describe` as a local-only exception to `openWorldHint: true` policy
- [x] Commit, push, and open PR

### Plan
- Add explicit boolean annotations to all tools for GPT App form compatibility.
- Treat list/get/diagnose/search/describe/status/schema as non-destructive because they do not delete resources.
- Verify at registration level so future tools cannot omit required GPT App annotation fields.
- Document `harness_describe` as a local-only tool (openWorldHint: false) since it reads registry metadata without external API calls.
- Fix collateral drift: ai-evals opt-in language, README counts, smoke test assertion.

### Review
- Added explicit `destructiveHint: false` to `harness_list`, `harness_get`, `harness_diagnose`, `harness_search`, `harness_describe`, `harness_status`, and `harness_schema`.
- Regression test now asserts both type (boolean) and expected values: `openWorldHint: true` for API-calling tools, `openWorldHint: false` only for documented local-only tools (`harness_describe`).
- Regenerated README to reflect current registry counts (187 resource types, 32 toolsets).
- Fixed smoke test to allow additive (+) toolset filters that reference already-default toolsets.
- Removed stale ai-evals "opt-in / excluded by default" language from README since it's been default-enabled since 31c119dd.

## Phase 1: Foundation ✅
- [x] Project scaffolding (package.json, tsconfig, pnpm)
- [x] Config validation with Zod
- [x] HarnessClient with auth, retry, error handling
- [x] Logger (stderr only)
- [x] Rate limiter
- [x] Error utilities
- [x] Deep-link builder
- [x] Response formatter

## Phase 2: Registry + Core Toolsets ✅
- [x] Registry types (ResourceDefinition, EndpointSpec, ToolsetDefinition)
- [x] Pipelines toolset (pipeline, execution, trigger, input_set)
- [x] Services toolset
- [x] Environments toolset
- [x] Connectors toolset
- [x] Infrastructure toolset
- [x] Secrets toolset (read-only)
- [x] Logs toolset
- [x] Audit toolset
- [x] Master registry with dispatch() + dispatchExecute()

## Phase 3: Tools + Entrypoint ✅
- [x] harness_list
- [x] harness_get
- [x] harness_create (with confirmation gate)
- [x] harness_update (with confirmation gate)
- [x] harness_delete (with confirmation gate)
- [x] harness_execute
- [x] harness_diagnose
- [x] harness_search
- [x] harness_describe
- [x] tools/index.ts — registerAllTools()
- [x] src/index.ts — server entrypoint

## Phase 4: Remaining Toolsets + Resources + Prompts ✅
- [x] Delegates toolset
- [x] Repositories toolset
- [x] Registries toolset
- [x] Templates toolset
- [x] Dashboards toolset
- [x] IDP toolset
- [x] Pull Requests toolset
- [x] Feature Flags toolset
- [x] GitOps toolset
- [x] Chaos toolset
- [x] CCM toolset
- [x] SEI toolset
- [x] SCS toolset
- [x] STO toolset
- [x] Pipeline YAML resource
- [x] Execution summary resource
- [x] Debug pipeline prompt
- [x] Create pipeline prompt

## Phase 5: Verification ✅
- [x] TypeScript build succeeds (0 errors)
- [ ] MCP Inspector verification
- [ ] Real Harness API integration test
- [ ] README.md

## Documentation Alignment Automation (2026-03-16) ✅
- [x] Audit docs against current tool registration and registry counts
- [x] Update README public interface claims to match tool schemas
- [x] Add pipeline runtime-input execution workflow + troubleshooting notes
- [x] Align supporting docs (`CONTRIBUTING.md`, `docs/gemini.md`)

### Review
- Corrected stale inventory references (11 tools / 26 toolsets / 124 resource types).
- Documented `harness_diagnose` multi-resource support and `harness_ask` conditional availability.
- Added concrete pipeline run workflow for `runtime_input_template` + `input_set_ids`.

## Documentation Alignment Automation (2026-03-23)
- [x] Audit live tool/toolset/resource counts from source
- [x] Update stale public docs (`README.md`, `docs/gemini.md`, `CONTRIBUTING.md`)
- [x] Add/refresh pipeline run guidance for runtime-input shorthand expansions
- [x] Run docs consistency verification
- [x] Commit, push, and open docs-only PR

### Review
- Aligned public inventory claims with current source of truth: 10 tools, 29 toolsets, 137 resource types.
- Added concrete pipeline runtime-input shorthand mapping (`branch`, `tag`, `pr_number`, `commit_sha`) and documented the `inputs.build` precedence constraint.
- Added troubleshooting guidance for shorthand non-application and linked shorthand discovery to `harness_describe(resource_type="pipeline")`.

## Hosted MCP README Update (2026-04-23)
- [x] Review current README setup and client configuration sections
- [x] Document Harness-hosted MCP support and managed endpoint example
- [x] Add Platform OAuth + Harness Support enablement note
- [x] Review docs-only diff

### Review
- Added a Quick Start note so readers discover the hosted MCP option before local installation paths.
- Added hosted MCP client config examples using the managed `https://mcp.harness.io/mcp` endpoint and `CLIENT_ID` auth stanza.
- Explicitly documented that hosted MCP requires Harness Platform OAuth and per-account enablement/configuration by Harness Support.

## License Change to MIT (2026-04-23)
- [x] Audit repository references to Apache 2.0
- [x] Update root license file and package metadata to MIT
- [x] Align contributor and README license text
- [x] Verify no stale Apache 2.0 references remain for project licensing
- [x] Commit, push, and open docs/legal change PR

### Review
- Replaced the repository's Apache 2.0 license text with the MIT license and updated the package SPDX identifier.
- Aligned README and CONTRIBUTING so public licensing guidance matches the new MIT license.
- Verified that remaining Apache mentions are limited to task history and test fixture/sample data, not the repository's project licensing.
- Verified the change set with `pnpm typecheck` and `pnpm test` after installing dependencies from the existing lockfile.

## Critical Bug Inspection (2026-04-25)
- [x] Inspect recent commits for high-severity behavioral regressions
- [x] Identify startup regression from renamed `agent-pipelines` toolset
- [x] Add backward-compatible `HARNESS_TOOLSETS` alias handling
- [x] Add registry regression tests for explicit and additive alias syntax
- [x] Run focused tests and typecheck

### Review
- Found that users with existing `HARNESS_TOOLSETS=agent-pipelines` or `+agent-pipelines` configs would fail server startup after the toolset was renamed to `agents`.
- Added a narrow parser alias so legacy configs resolve to the current `agents` toolset without reintroducing the old public name internally.
- Verified with `pnpm test tests/registry/registry.test.ts` and `pnpm typecheck`.

## Critical Bug Inspection (2026-04-27)
- [x] Inspect recent commits for high-severity behavioral regressions
- [x] Reproduce filtered-toolset startup crash for operation-less dynamic enums
- [x] Add minimal helper so disabled operations accept no resource types without startup failure
- [x] Add focused regression coverage
- [x] Run focused tests, typecheck, full tests, build, and startup probe

### Review
- Found that narrow `HARNESS_TOOLSETS` selections such as `logs` could leave list/create/update/delete/execute resource type arrays empty. Tool registration cast those arrays to non-empty tuples for `z.enum(...)`, which could throw during MCP startup before the server became available.
- Added a shared `resourceTypeSchema` helper that preserves enum validation when resource types exist and uses a non-throwing schema that rejects all values when none support the operation.
- Added a regression test that registers every MCP tool with `HARNESS_TOOLSETS=logs`.
- Verified with `pnpm test tests/registry/registry.test.ts`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `HARNESS_API_KEY=pat.test-account.token.secret HARNESS_TOOLSETS=logs timeout 3s node build/index.js stdio`.

## Documentation Alignment Automation (2026-04-27)
- [x] Audit recent registry/config changes against public docs
- [x] Align README tool counts and pipeline version semantics
- [x] Refresh `.env.example` with current operational config
- [x] Run docs consistency checks
- [ ] Commit and push docs-only changes

### Review
- README now matches `src/tools/index.ts` with 11 generic tools and documents that `HARNESS_PIPELINE_VERSION` selects either `pipeline` or `pipeline_v1`, not both.
- HTTP transport docs now mention the per-session `x-harness-pipeline-version` initialize header from `src/index.ts`.
- `.env.example` now covers operational config from `src/config.ts` and clarifies default vs opt-in toolset filtering, including the legacy `agent-pipelines` alias.

## Critical Bug Inspection (2026-04-29)
- [x] Inspect recent commits for high-severity behavioral regressions
- [x] Confirm `--env-file` loads before config values except HTTP `PORT`
- [x] Fix HTTP port resolution so env-file `PORT` is honored
- [x] Add focused regression coverage
- [x] Run tests/typecheck, commit, push, and open PR

### Plan
- Split CLI parsing so transport/env-file discovery remains early, but final port resolution can happen after dotenv loads.
- Preserve precedence: `--port` > loaded `PORT` env var > `3000`.
- Keep the change scoped to CLI startup behavior and focused tests.

### Review
- Found HTTP startup ignored `PORT` from a specified `--env-file` because `parseArgs()` resolved the port before dotenv loaded the file.
- Added `resolvePort()` so `src/index.ts` loads dotenv first, then resolves the final HTTP port while preserving `--port` precedence.
- Verified with `pnpm test tests/utils/cli.test.ts` and `pnpm typecheck`.

## PR 102 Review Follow-up (2026-04-29)
- [x] Verify each review comment against the current PR branch
- [x] Move malformed `HARNESS_MCP_ALLOWED_HOSTS` validation into startup config parsing
- [x] Preserve real Express Host-header accept/reject coverage
- [x] Preserve behavioral dotenv stdout regression coverage
- [x] Run focused tests and typecheck
- [ ] Commit, push, and update PR

### Plan
- Add a config-level validator for `HARNESS_MCP_ALLOWED_HOSTS` using the same hostname parsing rules as HTTP host resolution.
- Keep host resolution responsible for producing MCP Express options, not discovering config typos late.
- Run focused tests for config, HTTP transport, env loading, and CLI parsing before full typecheck.

### Review
- Moved malformed `HARNESS_MCP_ALLOWED_HOSTS` handling into `ConfigSchema`, where startup config validation fails loudly and stores a normalized, de-duplicated allowlist.
- Kept `resolveHttpHostValidationOptions()` focused on producing Express adapter options from validated config.
- Confirmed request-level host behavior through the real `createMcpExpressApp()` adapter and behavioral dotenv stdout tests.
- Verified with focused tests, full `pnpm test`, and `pnpm typecheck`.

## Slack Bug Triage: MCP Connections Failing (2026-04-29)
- [x] Read the Slack report thread and capture available symptoms
- [x] Reproduce MCP connection startup/initialize behavior locally
- [x] Identify the root cause from code and recent changes
- [x] Add a focused regression test before implementation
- [x] Implement the minimal fix
- [x] Run focused and broader verification
- [x] Commit, push, open PR, and reply in the original Slack thread

### Plan
- Start with the stdio and HTTP connection paths in `src/index.ts`, `src/config.ts`, and the MCP SDK integration tests because the report is connection-level and the Slack thread has no detailed error text.
- Use recent commits plus local startup tests to narrow whether this is a startup crash, config parsing issue, or session initialization regression.
- If a repo bug is found, write the smallest regression test that fails on current code, then fix only the implicated path.

### Review
- The Slack thread had no screenshots or concrete error details, so investigation focused on the HTTP connection path and recent SDK/config changes.
- Found that `createMcpExpressApp({ host: "127.0.0.1" })` enables SDK Host-header validation for only localhost names. That is safe for local use but rejects the documented hosted MCP hostname (`mcp.harness.io`) when the server sits behind a public proxy while binding locally.
- Added `resolveHttpHostValidationOptions()` to preserve SDK DNS-rebinding protection while allowing the hosted MCP hostname by default and optional proxy/custom hostnames through `HARNESS_MCP_ALLOWED_HOSTS`.
- Verified with `pnpm test tests/utils/http-hosts.test.ts`, `pnpm test tests/integration/http-transport.test.ts`, and `pnpm typecheck` using a temporary Node toolchain because the automation image did not have Node on `PATH`.

## Follow-up: Stdio Dotenv Banner (2026-04-29)
- [x] Reproduce stdout contamination from dotenv during stdio startup
- [x] Add quiet dotenv loading for default and `--env-file` paths
- [x] Add regression coverage for quiet dotenv invocation
- [x] Verify focused CLI test, build, stdio stdout, typecheck, and related HTTP tests

### Review
- Reproduced current 0.9.5 behavior: `dotenv@17.3.1` printed `[dotenv@17.3.1] injecting env ...` to stdout before MCP JSON-RPC when starting `node build/index.js stdio --env-file ...`.
- Added `quiet: true` to both `loadDotenv({ path: envFile })` and default `loadDotenv()` calls in `src/index.ts`.
- Verified after rebuild that the same stdio startup produced `stdout bytes=0`, preserving stdout for JSON-RPC.

## PR #102 Review Follow-up (2026-04-29)
- [x] Fetch PR review comments
- [x] Split localhost bind-host detection from Host-header allowlist values
- [x] Fail loudly on malformed `HARNESS_MCP_ALLOWED_HOSTS`
- [x] Add request-level SDK Host-header validation coverage
- [x] Run focused HTTP tests, CLI tests, typecheck, and build

### Review
- Added `::1` as a localhost bind host while keeping `[::1]` as the Host-header allowlist value expected by the SDK middleware.
- `HARNESS_MCP_ALLOWED_HOSTS` now throws with the malformed entries instead of silently dropping them.
- Added an integration test that runs the real SDK Express Host-header middleware and verifies `Host: mcp.harness.io` is accepted while an unexpected host is rejected.
- Replaced the source-text dotenv assertion with behavioral `loadEnvFile()` tests that verify custom and default dotenv loading do not write through `console.log`.

## Slack Bug Triage: MCP Down Again (2026-05-01)
- [x] Read the triggered Slack thread and related prior context
- [x] Verify current npm release status and repository fixes
- [x] Identify why users still see the outage after PR #102 merged
- [x] Add a release/version regression check
- [x] Bump package and bundle metadata for a patch release
- [x] Run focused verification
- [x] Commit, push, open PR, and reply in the Slack thread

### Plan
- Treat the sparse report as the same user/environment until contradicted by thread context, then verify against npm and current repo state.
- Add a small release metadata test that fails when `package.json`, root `manifest.json`, and `mcp-directory/manifest.json` drift.
- Bump the patch version so the already-merged stdio/hosted MCP fixes can actually ship through `npx harness-mcp-v2@latest`.

### Review
- Slack thread had no new details, but the same reporter's previous thread identified `harness-mcp-v2@0.9.5` stdio stdout contamination as the concrete failure.
- Confirmed npm `latest` still serves `0.9.5`, so users running `npx harness-mcp-v2@latest` can still receive the known-bad build even though PR #102 is merged.
- Bumped `package.json`, root `manifest.json`, and `mcp-directory/manifest.json` to `0.9.6` and added `tests/release-metadata.test.ts` to keep patch release metadata synchronized.
- Verified with focused release/env/HTTP tests, `pnpm typecheck`, `pnpm build`, and a stdio startup smoke test showing `stdout bytes=0`.

## Slack Bug Triage: Hosted MCP Harness0 Routing (2026-05-05)
- [x] Read the triggered Slack thread and confirm there are no screenshots or follow-up messages
- [x] Trace hosted and local Harness base URL configuration
- [x] Clarify hosted MCP vs local MCP Harness0 routing in docs and manifests
- [x] Run docs verification and review the diff
- [ ] Commit, push, open PR, and reply in the Slack thread

### Plan
- Treat this as a documentation/configuration gap unless code evidence shows the server ignores `HARNESS_BASE_URL`.
- Preserve existing local behavior: stdio/self-hosted HTTP users set `HARNESS_BASE_URL=https://harness0.harness.io`.
- Clarify hosted `https://mcp.harness.io/mcp` behavior: Claude/Cowork clients cannot point that managed endpoint at another Harness host from client config; Harness Support must enable/configure the hosted service for the target account/environment.

### Review
- The Slack thread had no screenshots or follow-up repro details; the report was a configuration question about routing hosted MCP to Harness0.
- Confirmed local stdio/self-hosted HTTP already support private Harness SaaS hosts through `HARNESS_BASE_URL`.
- Clarified in README that hosted `https://mcp.harness.io/mcp` is managed and cannot be pointed at Harness0 from Claude/Cursor/Cowork client config; Support must configure hosted MCP for that target environment.
- Updated MCPB manifest descriptions so `HARNESS_BASE_URL` covers private SaaS hosts such as `https://harness0.harness.io`, not just self-managed installs.
- Verified with `pnpm build` and `pnpm docs:check`.

## Slack Bug Triage: Account-Scope Resource Queries (2026-05-13)
- [x] Trace current scope injection and URL parsing for account-level resources
- [x] Add failing tests for explicit/account URL scope behavior
- [x] Implement explicit account/org/project scope handling and describe metadata
- [x] Mark connectors, services, environments, infrastructure, secrets, and templates as multi-scope queryable
- [x] Run focused tests, typecheck, and broader verification
- [x] Commit, push, and open/update PR

### Plan
- Preserve existing default behavior for project-scoped calls with no explicit resource scope so current users with `HARNESS_ORG`/`HARNESS_PROJECT` keep getting default project results.
- Add a generic `resource_scope` selector accepted by `harness_list` and `harness_get`: `account` omits org/project, `org` injects only org, and `project` injects org+project.
- Teach account-level Harness URLs (for example `/all/settings/connectors`) to set `resource_scope: "account"` so pasted account URLs do not get config defaults re-injected.
- Surface multi-scope capability in `harness_describe` so agents know that account-level connectors, services, environments, infrastructure, secrets, and templates can be requested with `resource_scope: "account"`.

### Review
- Added explicit `resource_scope` support for list/get requests: account scope omits org/project query params, org scope omits project, and project/default behavior continues to use configured defaults.
- Account-level Harness URLs now propagate `resource_scope: "account"` through `applyUrlDefaults`, preventing account settings URLs from being narrowed by `HARNESS_ORG`/`HARNESS_PROJECT`.
- Marked connectors, services, environments, infrastructure, secrets, and templates as supporting `account`, `org`, and `project` scopes and surfaced that guidance through `harness_describe`.
- Kept resource-specific `scope` filters available for APIs such as GitOps cluster links by reserving `resource_scope` for dispatcher-level scoping.
- Added coverage that each supported entity resource can list at account, org, and project scope, and that `harness_search` forwards explicit and URL-derived `resource_scope`.
- Limited URL-derived `resource_scope` to known multi-scope entity URLs so account-scoped APIs with org/project UI paths, such as FME feature flags, are not rejected as unsupported project scope.
- Verified with focused red/green coverage, `pnpm typecheck`, full `pnpm test` (52 files / 1213 tests), and `pnpm build`.

## PR 182 Scope Feedback Follow-up (2026-05-13)
- [x] Reproduce explicit org/project `resource_scope` fail-open behavior with missing defaults
- [x] Add regression coverage for broad `harness_search` with scoped mixed registries
- [x] Add regression coverage that `resource_scope` Zod descriptions survive optional wrapping
- [x] Fail loudly before dispatch when explicit org/project scope lacks required IDs/defaults
- [x] Filter broad scoped searches to resource types that support the requested scope
- [x] Fix `.describe()` ordering on `resource_scope` tool inputs
- [x] Run focused tests, typecheck, build, and full tests
- [x] Commit, push, open PR, and reply in Slack

### Plan
- Keep the fix within the existing scope-selector implementation from PR #182.
- Validate only explicit `resource_scope` requests; preserve default project-scoped behavior for existing calls.
- Avoid broad-search noise by skipping predictable unsupported-scope targets before dispatch.
- Verify with focused registry/tool tests plus typecheck/build.

### Review
- Confirmed current PR head failed the new regression tests: explicit org/project scopes with missing defaults still dispatched, Zod descriptions were absent, and broad scoped search reported avoidable unsupported-scope errors.
- Added central explicit-scope validation in `src/registry/index.ts` so org/project scope requires `org_id`/`HARNESS_ORG` and `project_id`/`HARNESS_PROJECT` before request construction.
- Added `Registry.getSupportedScopes()` and used it in `src/tools/harness-search.ts` to filter broad scoped searches before fan-out.
- Moved `resource_scope` Zod descriptions after `.optional()` in `src/tools/harness-get.ts`, `src/tools/harness-list.ts`, and `src/tools/harness-search.ts`.
- Verified with `pnpm test tests/registry/registry.test.ts tests/tools/tool-handlers.test.ts tests/utils/url-parser.test.ts`, `pnpm typecheck`, `pnpm build`, and full `pnpm test`.

## PR 185 Scope Review Follow-up (2026-05-13)
- [x] Verify `scopeOptional` is not equivalent to explicit `resource_scope` support
- [x] Add regression coverage for `scopeOptional` SCS resources rejecting unsupported explicit org scope
- [x] Add regression coverage that URL-derived `resource_scope` is opt-in for tools
- [x] Restrict URL-derived `resource_scope` merging to read tools that expose the field
- [x] Run focused tests, typecheck, build, and full tests
- [ ] Commit and push PR branch

### Review
- Changed explicit `resource_scope` support to come only from `supportedScopes`, not `scopeOptional`.
- Updated `harness_describe` to surface `supportedScopes` only when the registry declares multi-scope support.
- Made URL-derived `resource_scope` opt-in in `applyUrlDefaults()` and enabled it only for `harness_list`, `harness_get`, and `harness_search`.
- Verified with focused scope/url/tool tests, `pnpm typecheck`, `pnpm build`, and full `pnpm test`.

## PR 189 Blocking URL Builder Follow-up (2026-05-13)
- [x] Add a failing regression test for `RequestOptions.path` values that already include query params
- [x] Update `HarnessClient.buildUrl()` to merge existing path query params before appending scope params
- [x] Run focused client tests, `pnpm typecheck`, `pnpm build`, and full `pnpm test`
- [x] Commit, push, and open a PR

### Plan
- Keep the fix in `src/client/harness-client.ts` because both `request()` and `requestStream()` share `buildUrl()`.
- Add coverage in `tests/client/harness-client.test.ts` using `requestStream()` with a log-service blob path containing `?token=abc`.
- Preserve existing behavior where explicit `options.params` can override generated scoping params.

### Review
- Confirmed the regression test fails before the fix: `token` was parsed as `abc?accountIdentifier=test-account`.
- Split query strings out of `RequestOptions.path` before base-path de-duplication and query assembly.
- Merged path query params into the generated `URLSearchParams` before applying `options.params`, preserving explicit override behavior.
- Verified with `pnpm test tests/client/harness-client.test.ts`, `pnpm typecheck`, `pnpm build`, and full `pnpm test`.

## Slack Bug Triage: Pull Request Close Support (2026-05-14)
- [x] Confirm whether PR close is available by design or missing from MCP v2 metadata
- [x] Add a failing registry test for a first-class pull request close action
- [x] Implement the minimal pull request close action against the existing Harness Code PR update endpoint
- [x] Run focused tests, typecheck, build, and relevant broader verification
- [x] Commit, push, and open/update PR

### Plan
- Keep the change scoped to the existing `pull_request` resource in `src/registry/toolsets/pull-requests.ts`.
- Preserve the already-supported generic update path (`harness_update` with `body.state = "closed"`) and add a more discoverable `harness_execute` action named `close`.
- Map `close` to the existing Harness Code PATCH endpoint `/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}` with a fixed `{ state: "closed" }` body.
- Mark the action as `medium_write` and `do_not_retry`, matching a non-idempotent PR state transition that requires confirmation in clients with elicitation.

### Review
- Confirmed PR close was not blocked by MCP design: generic `harness_update` already documented `state: open/closed`, but no first-class `harness_execute` close action existed, so agents asking to "close a PR" saw only `merge`.
- Added `pull_request.close` as a medium-risk execute action that PATCHes the PR update endpoint with `{ state: "closed" }`.
- Added registry coverage for the close action and MCP-handler coverage for closing directly from a Harness PR URL.
- Fixed `harness_execute` resource-id mapping so URL-derived parent identifiers like `repo_id` are preserved instead of being overwritten by the URL's `resource_id`.
- Verified with `pnpm test tests/registry/registry.test.ts tests/tools/tool-handlers.test.ts`, `pnpm typecheck`, `pnpm build`, and full `pnpm test` (53 files / 1309 tests).

## Slack Follow-up: Harness Code PR Close Endpoint (2026-05-14)
- [x] Add regression coverage for closing a PR through `harness_update`
- [x] Add regression coverage for `harness_execute` action `close`
- [x] Route PR state changes through the dedicated Harness Code state endpoint
- [x] Run focused tests, typecheck, build, and full tests
- [x] Commit and push the fix

### Plan
- Keep metadata edits (`title`, `description`) on the existing PR PATCH endpoint.
- Route state transitions (`state: "closed"` or `state: "open"`) to `POST /code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/state`.
- Add an explicit `close` execute action so agents do not guess a missing action after update attempts fail.

### Review
- Confirmed the regression before implementation: `state: "closed"` used the generic PATCH endpoint, and `harness_execute` only exposed `merge`.
- Added conditional PR update routing so state changes use the Harness Code state endpoint while title/description updates continue using PATCH.
- Added `skipScopeBodyInjection` for endpoints that must not receive org/project fields in POST/PUT bodies, and applied it to PR state changes so the request body remains `{ state }`.
- Verified with `pnpm test tests/registry/pull-requests.test.ts`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## Slack Bug Triage: v3.0.2 Release Idempotency (2026-05-15)
- [x] Read the trigger thread and nearby channel context for the git tag report
- [x] Confirm the v3.0.2 tag, GitHub Release, npm latest version, and failed release workflow run
- [x] Add failing regression coverage for release workflow idempotency
- [x] Make `release.yml` skip or tolerate already-published npm/GitHub release artifacts
- [x] Run focused tests, typecheck/build, commit, push, open PR, and reply in Slack thread

### Plan
- Keep the fix in `.github/workflows/release.yml`; the package metadata and tag are already correct at `3.0.2`.
- Add a workflow-structure regression test so future edits do not reintroduce unconditional `npm publish` or `gh release create`.
- Make npm publishing idempotent by checking the package/version first and rechecking after publish failures before failing the job.
- Make GitHub Release creation idempotent by skipping `gh release create` when the tag release already exists.

### Review
- Confirmed the release workflow failed at `npm publish` for `v3.0.2` because npm already had `harness-mcp-v2@3.0.2`; package metadata, the Git tag, GitHub Release, and npm `latest` were otherwise correct.
- Added `tests/release-workflow.test.ts` to require idempotency guards for npm publish and GitHub Release creation.
- Updated `.github/workflows/release.yml` to skip npm publish when the package version already exists, tolerate a publish race by rechecking npm after failure, and skip `gh release create` when the release already exists.
- Verified with `pnpm test tests/release-workflow.test.ts tests/release-metadata.test.ts`, `pnpm typecheck`, `pnpm build`, `pnpm docs:check`, and full `pnpm test`.

## Critical Bug Inspection (2026-05-16)
- [x] Inspect recent commits for high-severity behavioral regressions
- [x] Trace suspicious changes through caller chains and downstream behavior
- [x] Implement a minimal fix only if a concrete critical bug is confirmed
- [x] Run focused verification and report the outcome

### Plan
- Review recent merged commits since the last critical bug inspection, prioritizing code-path changes over docs/schema churn.
- Focus tracing on repository write actions, release workflow behavior, schema sync side effects, and any client/request construction changes.
- If no data-loss, crash, security, or major user-facing breakage has a concrete trigger, do not open a PR; post a concise no-critical-findings summary instead.

### Review
- Found a safety regression from the per-session auto-approve header: any HTTP client starting a session could set `x-harness-auto-approve-risk: all` and widen the session beyond the deployment's configured `HARNESS_AUTO_APPROVE_RISK`, bypassing the server operator's confirmation threshold for writes and destructive operations.
- Capped session header auto-approve values at the server-configured threshold while preserving the ability for a session to lower its own threshold.
- Added focused regression coverage for capping and lowering behavior, and updated the architecture note to describe the cap.
- Reviewed other recent changes (schema sync, commit create, STO pagination, pipeline branch loading, release workflow idempotency) and did not find another high-confidence critical issue to patch in this run.
- Verified with `pnpm test tests/utils/session-headers.test.ts tests/utils/elicitation.test.ts`, `pnpm typecheck`, `pnpm build`, full `pnpm test`, `pnpm docs:check`, and `git diff --check`.

## Documentation Alignment Automation (2026-05-18)
- [x] Audit recent user-facing code changes against existing docs
- [x] Update README public interface tables and operational workflow notes
- [x] Align architecture/testing docs for STO exemptions and pull request state handling
- [x] Run docs consistency checks and review the doc-only diff
- [x] Commit, push, and open/update a documentation PR

### Plan
- Use recent merged commits and source files as the source of truth; do not document behavior that is not present in code.
- Keep the updates in existing documentation surfaces (`README.md`, `docs/architecture.md`, and targeted `docs/testing/*` files) instead of creating redundant pages.
- Prioritize recent public interfaces that agents rely on: commit creation, PR close, STO exemption create/promote behavior, pipeline `pipeline_branch`, template API paths, session auto-approve headers, and log download troubleshooting.

### Review
- README now reflects current public interfaces for commit create, pull request close, security exemption create, template service paths, pipeline `pipeline_branch`, per-session auto-approval headers, bulk exemption prompt usage, and execution-log download troubleshooting.
- Supporting docs now align risk classification/testing expectations for STO exemption creation and derived approver IDs, PR state endpoint behavior, and template list/get/create/update paths.
- Addressed review feedback by adding required STO promote `scope` examples and correcting refreshed testing examples to use current `filters`, `params`, and `resource_id` tool input shapes.
- Verified with `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm docs:check`, and `git diff --check`.

## HTTP MCP Auth Hardening (2026-05-17)
- [x] Add config for optional HTTP bearer auth and explicit unauthenticated opt-out
- [x] Add focused regression tests for auth parsing, route authentication, and non-loopback fail-closed behavior
- [x] Gate all `/mcp` HTTP routes before session creation or session reuse
- [x] Update README and env documentation so CORS/Host validation are not presented as authentication
- [x] Run focused tests, typecheck, build, commit, and push

### Plan
- Keep stdio behavior unchanged.
- Add `HARNESS_MCP_AUTH_TOKEN` as the HTTP transport bearer token. When set, `/mcp` requires `Authorization: Bearer <token>` for `POST`, `GET`, and `DELETE`.
- Add `HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP` as an explicit escape hatch. If HTTP binds to a non-loopback host without `HARNESS_MCP_AUTH_TOKEN`, startup fails unless this escape hatch is true.
- Preserve `/health` as unauthenticated for probes, because it returns only status and session count.
- Keep Host-header validation and CORS as defense-in-depth controls, not auth controls.

### Review
- Added `HARNESS_MCP_AUTH_TOKEN` and `HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP` config fields.
- Added `src/utils/http-auth.ts` to validate non-loopback binds, check exact Bearer tokens with timing-safe comparison, and reject unauthenticated `/mcp` requests before handlers run.
- Wired the auth middleware after CORS/rate-limit middleware and before MCP session creation/reuse in `src/index.ts`; `/health` and CORS preflight remain unauthenticated.
- Updated README and `.env.example` to document HTTP auth and clarify that CORS/Host validation are not authentication.
- Verified with `pnpm test tests/utils/http-auth.test.ts tests/config.test.ts tests/integration/http-transport.test.ts`, `pnpm typecheck`, `pnpm build`, and full `pnpm test` (58 files / 1360 tests).

## Critical Bug Inspection (2026-05-22)
- [x] Inspect recent commits for high-severity behavioral regressions
- [x] Trace suspicious changes through caller chains and downstream effects
- [x] Implement a minimal fix only if a concrete critical bug is confirmed
- [x] Run focused verification and report the outcome
- [x] Commit/push/open PR only if a fix is made

### Plan
- Review commits and diffs since `origin/main`, plus recent merged history if this branch is empty.
- Prioritize behavioral changes in request construction, auth/authorization, write actions, session lifecycle, and resource-scoping paths.
- Require a concrete trigger scenario before patching; if no data-loss, crash, security, or major user-facing breakage is confirmed, post a concise no-critical-findings summary without opening a PR.

### Review
- Found a correctness bug in `harness_execute(wait=true)`: if the pipeline trigger succeeded but repeated `execution.get` polls failed, `pollExecutionToTerminal()` returned `timed_out=true` with `Unknown` status.
- Impact: agents could interpret a polling outage as a still-running execution and retry the pipeline, causing duplicate deployments or other duplicate side effects.
- Fixed the poller so only the configured wait deadline reports a timeout; persistent poll failures now throw and are surfaced by `harness_execute` as `_wait.error` while preserving the trigger response and execution ID.
- Added unit coverage for the poller and boundary coverage that `harness_execute` preserves the trigger response, omits `execution_timed_out`, and returns `_wait.error` on persistent polling failures.
- Verified with `pnpm test tests/utils/poll-execution.test.ts tests/tools/tool-handlers.test.ts`, `pnpm typecheck`, full `pnpm test` (61 files / 1459 tests), `pnpm build`, and `git diff --check origin/main...HEAD`.
