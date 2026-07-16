# Harness MCP Server — Task Tracking

## Critical Bug Investigation Automation (2026-07-16)
- [x] Baseline branch state and identify recent behavioral commits
- [x] Review high-blast-radius diffs and trace concrete trigger scenarios
- [x] Implement a minimal fix only if a critical bug is proven
- [ ] Run focused verification for any fix, or sanity checks for no-fix outcome
- [ ] Commit/push/open PR if fixed; otherwise report no critical bugs in Slack

### Plan
- Treat recent `origin/main` history after `v3.2.10` as the primary investigation window.
- Prioritize GitOps delete mappings, Code file scoping, IDP writes, database path construction, and schema-sync changes with runtime impact.
- Require a concrete caller-chain trigger and high-confidence minimal fix before changing runtime code.

## Critical Bug Investigation Automation (2026-07-13)
- [x] Baseline branch state and identify recent behavioral commits
- [x] Review high-blast-radius diffs and trace concrete trigger scenarios
- [x] Implement a minimal fix only if a critical bug is proven
- [x] Run focused verification for any fix, or sanity checks for no-fix outcome
- [x] Commit/push/open PR if fixed; otherwise report no critical bugs in Slack

### Plan
- Treat the current branch against `origin/main` and recent main history as the investigation window.
- Prioritize behavioral paths that can cause data loss, crashes, security issues, or significant user-facing breakage.
- Avoid changes unless a concrete trigger and high-confidence minimal fix are both established.

### Review
- Found an IDP entity update correctness bug in the new mutate path: `idp_entity` list defaults to configured org/project scope, but the get/update path builder ignored `HARNESS_ORG` / `HARNESS_PROJECT` when callers omitted explicit `org_id` / `project_id`. A common `harness_list` -> `harness_update(resource_id, params.kind)` flow could PUT `/v1/entities/account/...` and overwrite an account-scoped entity with the same kind/id instead of the project entity the agent had just listed.
- Fixed IDP entity path construction to use explicit `resource_scope` when supplied, otherwise default to configured org/project scope when available, and to suppress org/project query params for explicit account-scope calls.
- Found a remote pipeline input override bug: when a run combined `input_set_ids`, flat inline overrides, and `pipeline_branch` (without `branch`), the input-set GET used the remote branch but the runtime-template POST did not. Overrides could be resolved against the default-branch template and execute with incorrect runtime values.
- Fixed runtime-template resolution to use `pipeline_branch ?? branch`, matching input-set materialization and execute dispatch.
- Verification passed: focused Vitest regression filter, `pnpm typecheck`, `pnpm build`, `pnpm test` (115 files / 2501 tests), `pnpm standards:check`, and `pnpm docs:check`.

## PR 569 Review Automation (2026-07-07)
- [x] Read Slack trigger thread and confirm report context
- [x] Inspect PR #569 diff, CI/review state, and affected code paths
- [x] Identify any concrete bug/root cause introduced or left unresolved
- [x] Implement a focused fix with regression coverage if needed
- [x] Run focused and broad verification
- [x] Commit, push, open PR if fixed, and reply in the Slack thread

### Review
- Found that PR #569's non-terminal diagnosis guard duplicated the execution terminal-status list instead of sharing the existing wait-mode utility, which would leave wait mode and `harness_diagnose` inconsistent for statuses such as approval rejection.
- Fixed `harness_diagnose` to use the shared terminal-status set, expanded the shared set to include `ApprovalRejected` and `Suspended`, and updated wait timeout guidance so it no longer recommends diagnosing still-running executions.
- Verification passed: focused Vitest status/diagnose tests, `pnpm build`, `pnpm typecheck`, `pnpm docs:check`, `pnpm test`, and `pnpm standards:check`.

## Remove Visualization Resources / SVG + Image Generation (2026-07-06)

### Context
Incident with the visualization feature → remove all SVG/PNG chart & image generation from the MCP server.
Feature is **opt-in** (`include_visual` defaults to false) and the `visual_*` resource types have **no API operations**, so blast radius is self-contained — nothing else in dispatch depends on them.

> There is no separate "table image" generator. All image output is SVG→PNG charts (pie/bar/timeseries/timeline/stage-flow/status/architecture) rendered via `@resvg/resvg-js` in a child process. Removing the SVG module removes all of it.

### Scope — two layers
1. **Rendering engine** — `src/utils/svg/` (18 files) + `@resvg/resvg-js` dependency + `tests/utils/svg/`.
2. **Opt-in wiring** — `include_visual`/`visual_type`/`visual_width` params on 3 of the 11 tools (`harness_list`, `harness_diagnose`, `harness_status`), the metadata-only `visualizations` toolset, and the `imageResult`/`mixedResult` response helpers.

### Steps (in order)

**1. Delete the rendering engine**
- [ ] Delete `src/utils/svg/` (whole dir — render-png, render-png-child, timeline, stage-flow, status-summary, executions-timeseries, architecture, list-visuals, charts/*, colors, escape, mappers, types, index)
- [ ] Delete `tests/utils/svg/` (6 test files)

**2. Remove the toolset + registry wiring**
- [ ] Delete `src/registry/toolsets/visualizations.ts`
- [ ] `src/registry/index.ts:42` — remove `import { visualizationsToolset }`
- [ ] `src/registry/index.ts:157` — remove `visualizationsToolset,` from the toolset array
- [ ] `src/registry/types.ts:137` — remove `| "visualizations"` from the toolset-name union
- [ ] KEEP the `diagnosticHint` field on `ResourceDefinition` — verified used by ~15 other toolsets

**3. Strip shared response-formatter helpers**
- [ ] `src/utils/response-formatter.ts` — remove `svgToPngBase64` import (line 8), `imageResult()` (81-86), `mixedResult()` (93-106), and the `{ type: "image" }` `ContentItem` variant (line 12). KEEP `jsonResult`/`errorResult`/`normalizeHarnessListPayload`.
- [ ] `tests/utils/response-formatter.test.ts` — remove `describe("imageResult")` + `describe("mixedResult")` and their imports

**4. Remove per-tool wiring (params + render blocks)**
- [ ] `src/tools/harness-list.ts` — remove `renderListVisual`/`ListVisualType`/`mixedResult` imports, `include_visual`+`visual_type` fields, render block (90-102). KEEP the `diagnosticHint` usage at line 133.
- [ ] `src/tools/harness-diagnose.ts` — remove SVG renderer + `mixedResult` imports, `include_visual`/`visual_type`/`visual_width` from options schema desc (line 47), render block (84-133)
- [ ] `src/tools/harness-status.ts` — remove `toProjectHealthData`/`renderStatusSummarySvg`/`mixedResult` imports, `include_visual` field (82), render block (224-233)
- [ ] `tests/tools/zod-input-schema-descriptions.test.ts` — remove `include_visual`/`visual_type` assertions for harness_list (70-79) and harness_status (100-106)

**5. Drop the dependency**
- [ ] `package.json:55` — remove `@resvg/resvg-js`. LEAVE `sharp`/`@huggingface/transformers` alone (transitive, used by semantic search)
- [ ] `pnpm install` to refresh lockfile

**6. Docs + config cleanup**
- [ ] `.env.example:94` — remove `visualizations` from `HARNESS_TOOLSETS` available list
- [ ] `docs/coding-standards.md:77` — replace the `visual_*` example of metadata-only `operations: {}` with another example
- [ ] Delete `docs/testing/visual_*/` (7 dirs) + remove references in `docs/testing/CONSOLIDATED_TEST_RESULTS.md`
- [ ] README counts: default toolsets 38→37; "38 of 39"→"37 of 38"; remove "Visualizations" from feature bullet (line 12) and the Visualizations toolset→resource mapping row. Prefer regenerating over hand-editing.

**7. Build, regenerate docs, verify**
- [ ] `pnpm build`
- [ ] `pnpm docs:generate` (reads build/ — must build first)
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm standards:check`
- [ ] `pnpm docs:check`

### Open questions for review — RESOLVED
1. Reserve the `visualizations` toolset name? → **Hard removal** (user-approved).
2. Deprecate vs. hard-remove `include_visual` params? → **Hard removal** (incident) (user-approved).
3. Preserve for re-introduction? → **Full clean removal** (user-approved); git history + spec 006 preserve context.

### Review (completed 2026-07-06)
- Deleted the rendering engine (`src/utils/svg/` 18 files, `tests/utils/svg/` 6 files) and the `visualizations` toolset (`src/registry/toolsets/visualizations.ts`, 7 `visual_*` metadata-only resource types).
- Removed registry wiring (`registry/index.ts` import + array entry, `registry/types.ts` union member) and the `imageResult`/`mixedResult` helpers + `image` `ContentItem` variant + `svgToPngBase64` import from `response-formatter.ts`. Kept `diagnosticHint` (used by ~15 other toolsets), `jsonResult`/`errorResult`/`normalizeHarnessListPayload`, and the `harness-status` logger (still used).
- Stripped `include_visual`/`visual_type`/`visual_width` params + render blocks from `harness-list`, `harness-diagnose`, `harness-status`; removed the now-unused `list` logger; removed the vestigial `analysis` field from `listOutputSchema`.
- Dropped `@resvg/resvg-js` from `package.json` and refreshed the lockfile. Left `sharp`/`@huggingface/transformers` (transitive, semantic search).
- Docs/config: `.env.example` toolset list, `docs/coding-standards.md` metadata-only example, removed `docs/testing/visual_*/` (7 dirs) + CONSOLIDATED_TEST_RESULTS section, README feature bullet + Visualizations section + toolset-mapping row. Updated spec `006-visualization-review.md` status to "Removed" (it had proposed this exact removal as its Phase 3; audit-spec 004/005 preconditions confirmed independent).
- Verification passed: clean `pnpm build` (no stale svg/visualizations artifacts in `build/`), `pnpm typecheck`, `pnpm docs:generate` (219→212 resource types, 38→37 default toolsets, 37/38 total), `pnpm docs:check` ("up to date"), `pnpm standards:check` (80 tests), and `pnpm test` (112 files / 2457 tests). One full-suite timeout in an unrelated `harness_schema` live-entity test was confirmed a flake — passes in isolation and on suite re-run.

---

## Critical Bug Investigation Automation (2026-07-02)
- [x] Baseline current branch and identify recent behavioral commits after `v3.2.5`
- [x] Review high-blast-radius diffs and trace candidate bugs through callers
- [x] Implement a minimal fix only if a concrete critical trigger is proven
- [x] Run focused verification for any fix, or sanity checks for no-fix outcome
- [x] Commit/push/open PR if fixed; otherwise report no critical bugs in Slack

### Plan
- Treat commits after `v3.2.5` as the primary recent-change window because the branch currently matches `origin/main` at `v3.2.6`.
- Prioritize behavioral changes with operational blast radius: remote semantic search routing/provider hardening, HTTP/session lifecycle behavior, generated schema/tool contract changes, and any create/execute payload handling touched by recent commits.
- Require a concrete trigger scenario and caller-chain proof before changing code; if confidence stays below the critical-bug bar, leave runtime code unchanged and report the no-fix result.

### Review
- Found a semantic search indexing correctness bug in the recent remote-search path: live entity documents were keyed as only `resourceType:identifier` and carried no org/project scope metadata. Two project-scoped resources with the same identifier (for example `pipeline:deploy` in two projects) could overwrite each other in the remote entity collection or be merged back into `harness_search` tier-0 results for the wrong project.
- Fixed entity indexing to build document IDs from account, effective scope, org, project, resource type, and identifier; list/get/startup pre-index now attach the same scope metadata. `harness_search` filters entity semantic hits to the effective requested/default scope before routing and tier-0 display.
- Found an HTTP transport bug: `createMcpExpressApp()` installs `express.json()` with Express's default 100 KB limit before this server's auth middleware and configured `HARNESS_MAX_BODY_SIZE_MB` parser. Valid HTTP MCP requests with large pipeline YAML/payloads could fail with 413 despite the documented 10 MB default.
- Fixed HTTP app construction to apply the SDK host-header protection without the SDK factory's default parser, preserving the intended order: CORS, auth, rate limit, then a single configured JSON parser.
- Verification passed: `pnpm exec vitest run tests/tools/harness-search-routing.test.ts`, `pnpm exec vitest run tests/search/remote-provider.test.ts tests/search/manager.test.ts`, `pnpm exec vitest run tests/integration/http-transport.test.ts`, `pnpm build`, `pnpm docs:generate`, `pnpm typecheck`, `pnpm docs:check`, `pnpm standards:check`, and `pnpm test` (116 files / 2474 tests).

## Critical Bug Investigation Automation (2026-07-01)
- [x] Baseline current branch and identify recent high-blast-radius commits
- [x] Review remote search, HTTP session, and pipeline execution changes with subagents
- [x] Trace confirmed pipeline input-set plus inline-override execution bug through the public tool path
- [x] Implement a minimal input materialization fix with focused regressions
- [x] Commit and push implementation checkpoint before validation
- [x] Run focused and broad verification
- [x] Open PR and report outcome in Slack

### Plan
- Treat commits since `v3.2.5` and the current release head as the recent-change window.
- Prioritize correctness paths that can affect deployments or multi-user isolation: semantic search tenancy, HTTP session lifecycle, and pipeline execute/runtime input construction.
- Patch only a concrete critical trigger with a narrow change. The confirmed trigger is `harness_execute(resource_type="pipeline", action="run", input_set_ids=[...], inputs={...})`: the tool documented this as "input set base + simple overrides" but skipped input-set materialization when overrides were present, then skipped unresolved-required validation because input sets existed.
- Preserve the existing input-set-only behavior while changing the combined mode to materialize the base input set, apply only matched inline overrides, and fail closed if required fields remain uncovered.

### Review
- Found a high-severity pipeline execution correctness bug in the documented "input set base + simple overrides" flow. When callers supplied both `input_set_ids` and non-empty inline `inputs`, `harness_execute` skipped input-set materialization, resolved only the inline keys against the runtime template, and skipped unmatched-required validation because an input set was present. A concrete deployment run could therefore send a YAML body containing unresolved `<+input>` placeholders for fields that the saved input set should have supplied, while also relying on query-string `inputSetIdentifiers` that prior fixes documented as unreliable.
- Fixed the combined path so pipeline runs materialize saved input sets first, apply only matched inline overrides onto that materialized YAML, remove `inputSetIdentifiers` after constructing the final YAML body, and fail closed if required fields remain uncovered. The merge helper updates variables by `name` rather than list position, so reordered or partially-present input set variables cannot corrupt neighboring values.
- Added utility-level regressions for preserving input-set values while applying overrides and for required fields not covered by either source, plus a public `harness_execute` regression proving the input set is fetched and the execute body contains both the override and base values with no `<+input>` placeholders.
- Verification passed: `pnpm exec vitest run tests/utils/runtime-input-resolver.test.ts tests/tools/tool-handlers.test.ts -t "substituteInputsIntoBaseYaml|materializes input_set_ids before applying inline input overrides"`, `pnpm build`, `pnpm docs:generate`, `pnpm typecheck`, `pnpm docs:check`, `pnpm exec vitest run tests/utils/runtime-input-resolver.test.ts tests/tools/tool-handlers.test.ts` (190 tests), `pnpm test` (116 files / 2473 tests), and `pnpm standards:check` (9 files / 75 tests).
- Opened PR #532 and posted the bug/fix/validation summary to Slack.

## Critical Bug Investigation Automation (2026-06-30)
- [x] Baseline current branch and identify recent behavioral commits after `v3.2.4`
- [x] Review high-blast-radius diffs and trace candidate bugs through callers
- [x] Implement a minimal fix for a concrete critical HTTP session lifecycle bug
- [x] Run focused and broad verification
- [x] Commit, push, open PR, and report outcome in Slack

### Plan
- Prioritize recent changes with operational blast radius: semantic search routing/health, pipeline execution input handling, PR merge payloads, DB Ops execute payloads, and HTTP session TTL configurability.
- Patch only if a concrete trigger can break active users; otherwise leave code unchanged and report no critical bugs.
- For the confirmed HTTP transport bug, keep the fix centered on session lifecycle state and add focused tests for active-request reaping semantics.

### Review
- Found a regression in HTTP mode: `MCP_SESSION_TTL_MS` defaults to 5 minutes while `harness_execute(..., wait: true)` can hold a single POST request for 10 minutes by default, and SSE streams may also stay open without new inbound requests. The TTL reaper only checked `lastActivity`, so it could close a session while an active tool call or stream was still running, causing broken MCP responses and orphaned Harness operations.
- Fixed session activity tracking so POST/GET/DELETE handlers mark active transport work, SSE streams remain active until the response closes, and the reaper only expires sessions with `activeRequests === 0` whose last completed activity is older than the TTL.
- Added focused session-activity tests and updated HTTP lifecycle test coverage for expired-but-active sessions. Also surfaced `MCP_SESSION_TTL_MS` in `.env.example`, README, and packaged manifests.
- Verification passed: `pnpm exec vitest run tests/utils/http-sessions.test.ts tests/integration/http-transport.test.ts tests/release-metadata.test.ts`, `pnpm build`, `pnpm docs:generate`, `pnpm typecheck`, `pnpm docs:check`, `pnpm test` (111 files / 2399 tests), and `pnpm standards:check`.
- Opened PR: https://github.com/harness/mcp-server/pull/493

## Critical Bug Investigation Automation (2026-06-27)
- [x] Baseline current branch and identify recent behavioral commits
- [x] Review high-blast-radius diffs and trace candidate bugs through callers
- [x] Implement a minimal fix only if a concrete critical trigger is proven
- [x] Run focused verification for any fix, or sanity checks for no-fix outcome
- [ ] Commit/push/open PR if fixed; otherwise report no critical bugs in Slack

### Plan
- Treat commits after `v3.2.4` as the recent-change window because the branch currently matches `origin/main` after that release tag.
- Prioritize behavioral paths that can break many users: semantic search routing, search cache limiting, tool handler safety gates, and request/response shaping in recent fixes.
- Require a concrete trigger scenario and caller-chain proof before changing code; if confidence stays below the critical-bug bar, leave code unchanged and report the no-fix result.

### Review
- Found a pipeline execution regression in `harness_execute(resource_type="pipeline", action="run")`: callers that supplied `input_set_ids` plus an empty `inputs: {}` object skipped input-set materialization, auto-resolved the runtime template with no values, and sent unresolved `<+input>` placeholders while bypassing the unmatched-required pre-flight because input sets were present.
- Fixed the input-set path by treating `undefined` and `{}` as no effective inline runtime inputs, materializing saved input sets in both cases, and preventing the later runtime-input resolver from overwriting the materialized YAML.
- Found an HTTP deployment regression from semantic search: optional local search initialization failures set search readiness to `failed`, and `/health` returned HTTP 503 even though the MCP server had already fallen back to keyword/null search. Kubernetes probes use `/health`, so a missing/unavailable embedding model could remove otherwise working pods.
- Fixed `/health` so server health remains HTTP 200 with `status: "ok"` while exposing the optional search failure in the `search` readiness payload for observability.
- Verification passed: `pnpm exec vitest run tests/tools/tool-handlers.test.ts -t "input_set_ids|input set|runtime inputs" tests/utils/http-health.test.ts`, `pnpm build`, `pnpm docs:generate`, `pnpm typecheck`, `pnpm docs:check`, `pnpm exec vitest run tests/tools/tool-handlers.test.ts tests/utils/http-health.test.ts`, `pnpm test` (110 files / 2392 tests), and `pnpm standards:check`.

## Pull Request Merge Branch Deletion Bug (2026-06-26)
- [x] Read Slack bug thread and confirm available context
- [x] Trace Harness Code pull request merge request construction
- [x] Add regression coverage for `delete_source_branch: false` on merge
- [x] Implement focused pull_request merge body fix
- [x] Run focused and broader verification
- [x] Commit, push, open PR, and reply in Slack thread

### Plan
- Keep the fix inside the `pull_request.merge` execute action so other Harness Code resources are unchanged.
- Build a stable merge body from documented Harness Code API fields, preserving explicit falsy values such as `delete_source_branch: false` and `dry_run: false`.
- Accept merge options from either `body` or `params` because `harness_execute` documents action-specific options through `params`, while the resource `bodySchema` documents the wire body fields.
- Skip generic scope injection for the merge endpoint so the API sees only merge options in the JSON body.

### Review
- Root cause: `pull_request.merge` forwarded only `input.body`. When agents supplied documented merge options through `harness_execute.params`, explicit values such as `delete_source_branch: false` were dropped before the POST body was built. The merge action also did not opt out of generic scope body injection.
- Changed `src/registry/toolsets/pull-requests.ts` to build a merge-specific body from documented Harness Code API fields, preserve explicit falsy values, map common camelCase aliases to snake_case API fields, reject conflicting body/params values, and skip scope-field body injection.
- Added regressions in `tests/registry/pull-requests.test.ts` and `tests/tools/tool-handlers.test.ts` for `delete_source_branch: false`, `dry_run: false`, params/top-level inputs, aliases, and conflict handling.
- Verification passed: `pnpm exec vitest run tests/registry/pull-requests.test.ts tests/tools/tool-handlers.test.ts -t "pull request merge|merge options|delete_source_branch"`, `pnpm build`, `pnpm docs:generate`, `pnpm typecheck`, `pnpm docs:check`, `pnpm test` (101 files / 2319 tests), and `pnpm standards:check`.

## Documentation Alignment Automation (2026-06-15)
- [x] Audit recent commits and existing docs for weakly documented subsystems
- [x] Select pipeline dynamic execution and execution input forensics as the focused documentation gap
- [x] Update README and testing docs with verified usage, constraints, and pitfalls
- [x] Run docs verification and review the documentation-only diff
- [x] Commit, push, and open/update the docs PR

### Plan
- Use `src/registry/toolsets/pipelines.ts`, `src/registry/extractors.ts`, `tests/registry/pipeline-dynamic-execution.test.ts`, and `tests/registry/execution-inputs.test.ts` as the source of truth.
- Keep the public README update concise and colocated with the existing Pipeline Run Workflow and Input Set examples.
- Add targeted `docs/testing/pipeline_dynamic_execution/test_plan.md` and `docs/testing/execution_inputs/test_plan.md` pages because both resource types are public in the pipelines toolset but missing from the testing catalog.
- Update `docs/testing/README.md` so QA can find the new resource-level test plans.
- Cover dynamic execution preconditions, object-only `body.yaml`, unsupported runtime-input behaviors, optional params, high-write confirmation, execution input response shape, expression resolution params, and common troubleshooting cases without documenting behavior not present in source.

### Review
- README now documents `pipeline_dynamic_execution.run` with a concrete `harness_execute` example, preconditions, `body.yaml` constraints, unsupported runtime-input behaviors, high-write confirmation semantics, response shape, and troubleshooting for disabled dynamic execution.
- README now documents `execution_inputs` as a post-run forensics workflow, including expression-resolution params and the stable projected response fields.
- Added `docs/testing/pipeline_dynamic_execution/test_plan.md` and `test_report.md` with pending QA coverage for request shape, object-only body validation, optional params, high-write gating, response envelope stripping, and dynamic-execution enablement failures.
- Added `docs/testing/execution_inputs/test_plan.md` and `test_report.md` with pending QA coverage for expression resolution, read-only behavior, response projection, input set detail normalization, missing fields, and chain-from-run workflows.
- Updated the CD/CI section of `docs/testing/README.md` to link the new resource plans and to correct the touched pipeline-related paths to the existing singular resource directories.
- Verification passed: `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm docs:check`, `pnpm typecheck`, `pnpm exec vitest run tests/registry/pipeline-dynamic-execution.test.ts tests/registry/execution-inputs.test.ts tests/tools/tool-handlers.test.ts -t "pipeline_dynamic_execution|execution_inputs"`, `git diff --check HEAD`, and `pnpm test` (78 files / 1946 tests).
- Opened PR: https://github.com/harness/mcp-server/pull/344

## Cursor MCP Confirmation Prompt Regression (2026-06-15)
- [x] Read Slack report and confirm screenshot/thread context
- [x] Trace MCP elicitation/write confirmation behavior and identify root cause
- [x] Add failing regression coverage for a visible confirmation field and rejected incomplete accepts
- [x] Implement minimal elicitation confirmation schema fix
- [x] Run focused tests, build, docs generation/check, typecheck, and full test suite
- [x] Commit, push, open/update PR, and reply in Slack thread

### Plan
- Keep the fix in the generic elicitation helper so `harness_create`, `harness_update`, `harness_delete`, and `harness_execute` share the behavior.
- Preserve existing safety semantics: explicit `decline`/`cancel` still block, `confirm: true` remains the fallback for clients without working elicitation, and auto-approve thresholds still bypass prompts.
- Use a flat primitive MCP form schema with a required boolean confirmation field so clients have concrete UI to render instead of an empty form.
- Validate accepted elicitation content so an `accept` without `confirm: true` does not execute a write.

### Review
- Root cause: the server sent approval-only MCP elicitation requests with an empty `requestedSchema`. That is spec-valid, but the newer Cursor MCP Agent path can fail to surface a useful approval UI and report a decline/cancel-like response, which made writes appear declined even when the user had said to proceed.
- Changed `src/utils/elicitation.ts` to request a concrete required boolean `confirm` field and to proceed only when an accepted response includes `content.confirm === true`.
- Updated elicitation, integration, and generic tool-handler tests to cover the new schema and accepted-response contract.
- Verification passed: `pnpm exec vitest run tests/utils/elicitation.test.ts -t "explicit confirmation schema|confirm=true"`, `pnpm exec vitest run tests/utils/elicitation.test.ts tests/integration/elicitation-flow.test.ts`, `pnpm exec vitest run tests/tools/tool-handlers.test.ts`, and full `pnpm build && pnpm docs:generate && pnpm typecheck && pnpm docs:check && pnpm test` (78 files / 1947 tests).
- Opened PR #345. Slack thread reply could not be posted because the trigger channel `C08SYT1FWJD` is not configured in the available Slack send tool; no message was posted to another channel.

## Documentation Alignment Automation (2026-06-08)
- [x] Audit recent commits and existing docs for weakly documented subsystems
- [x] Select File Store multipart workflows as the focused documentation gap
- [x] Update README and testing docs with verified File Store usage, constraints, and pitfalls
- [x] Run docs verification and review the documentation-only diff
- [x] Commit, push, and open/update the docs PR

### Plan
- Use `src/registry/toolsets/file-store.ts`, `src/utils/body-preview.ts`, and focused File Store tests as the source of truth.
- Keep the public README update concise and colocated with the existing File Store resource table.
- Add a targeted `docs/testing/file_store/test_plan.md` because File Store has new multipart/write semantics and no existing test-plan page.
- Cover create/update multipart bodies, account/org/project scope, URL-derived IDs, read-only `list_children`, confirmation redaction, and common validation failures without documenting behavior not present in source.

### Review
- README now documents File Store as a multi-scope resource, with copy-pasteable examples for list, folder create, file upload, metadata-only update, and `list_children`.
- README now spells out multipart constraints from `src/registry/toolsets/file-store.ts`: required `name`/`type`/`parent_identifier`, `FILE` content one-of rules, metadata-only update behavior, folder content rejection, `file_usage` enum values, 100 MB upload limit, and confirmation preview redaction.
- Added `docs/testing/file_store/test_plan.md` with File Store list/get/create/update/delete/execute coverage, URL-derived scope/ID cases, read-only `list_children`, validation failures, and redaction checks.
- Verification passed: `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm docs:check`, `pnpm exec vitest run tests/registry/file-store-multipart.test.ts tests/tools/tool-handlers.test.ts -t "File Store|file_store"`, and `git diff --check HEAD~1..HEAD`.
- Opened PR: https://github.com/harness/mcp-server/pull/311

## PR 307 Remote Pipeline Branch Execution Follow-up (2026-06-08)
- [x] Remove stale cache preflight from remote pipeline runs
- [x] Keep `pipelineBranchName` defaulting for remote branch execution
- [x] Update regressions to prove execute goes straight to `pipeline.run`
- [x] Run focused and broad verification
- [x] Update PR branch and local MCP build

### Plan
- Treat Harness `cacheResponse.cacheState` as read/UI cache metadata, not execution truth.
- Keep the branch-selection fix: remote executions should send `pipelineBranchName` when the caller provides a remote codebase branch or runtime YAML codebase branch.
- Remove fail-closed behavior that blocks execution after a stale `pipeline.get` response.

### Review
- Removed the `pipeline.get` cache validation before `pipeline.run`, so `cacheResponse.cacheState=STALE_CACHE` from the read/UI path no longer blocks execution.
- Kept remote branch normalization: `branch` and runtime YAML codebase branch still default `pipeline_branch`, which the registry sends as `pipelineBranchName`.
- Updated remote pipeline handler regressions to fail if a read-cache preflight runs and to assert the execute POST carries `pipelineBranchName`.
- Verification passed: `pnpm exec vitest run tests/tools/tool-handlers.test.ts -t "remote pipeline"`, `pnpm typecheck`, `pnpm build`, and `pnpm test` (71 files / 1860 tests).

## Critical Bug Inspection (2026-06-05)
- [x] Baseline branch against `origin/main` and inspect recent behavioral commits
- [x] Trace File Store create/update upload handling through MCP confirmation and registry dispatch
- [x] Add failing prompt-redaction regression coverage for File Store uploads
- [x] Implement minimal confirmation body preview redaction and bounding
- [x] Run focused and broad verification
- [ ] Open PR and report outcome in Slack

### Plan
- Treat this branch as a recent-main scan because it initially matched `origin/main`.
- Prioritize high-blast-radius behavior in the new File Store multipart support and recent auth/config changes.
- Patch only a concrete crash/data-exposure scenario with a narrow helper used by the affected write confirmation path.

### Review
- Found that `harness_create` and `harness_update` built confirmation prompts by directly `JSON.stringify`-ing object bodies. File Store uploads can include large `content` or `content_base64` payloads, so a valid upload could allocate and send the full file body in the elicitation prompt before the multipart builder's size validation ran.
- Fixed confirmation previews to redact upload content fields and bound long string/object previews before calling elicitation.
- Added public tool-handler regressions for File Store create/update confirmation messages so raw upload content is not exposed.
- Verification passed: focused red/green prompt tests, `pnpm typecheck`, full `tests/tools/tool-handlers.test.ts`, `pnpm build`, `pnpm docs:check`, `git diff --check HEAD~1..HEAD`, and full `pnpm test`.

## PR 211 File Store Review Follow-up (2026-06-04)
- [x] Inspect PR state and Cursor review findings
- [x] Merge current `origin/main` into PR branch
- [x] Fix file-store update/list/multipart validation contract
- [x] Align README resource/toolset discoverability
- [x] Run focused and broad verification
- [x] Push branch and re-check PR status
- [x] Tighten latest File Store validation review feedback
- [x] Re-run focused and broad verification for the follow-up
- [x] Fix File Store execute scope/read-only/full-body review feedback
- [x] Re-run focused and broad verification for scope/read-only follow-up
- [x] Fix read-only CI smoke expectation for read-risk execute actions
- [x] Restrict File Store list_children to folder nodes only
- [x] Align write-tool URL-derived scope and File Store update metadata
- [x] Fix URL-only write IDs, Zod metadata ordering, and File Store file_usage validation
- [ ] Push final PR #211 update and re-check status

### Plan
- Keep multipart client plumbing intact unless verification shows it is implicated.
- Make unsafe File Store inputs fail loudly before request construction.
- Preserve generic tool contracts: `harness_execute(resource_id=...)` should work without duplicate params.
- Keep generated README counts and hand-authored resource/toolset tables aligned with the registry.
- Latest follow-up: validate multipart scalar metadata as strings, reject dual `content`/`content_base64` inputs, and reject conflicting folder identifiers instead of letting stale aliases override the generic resource id.
- Scope/read-only follow-up: expose `resource_scope` on `harness_execute`, allow read-risk execute actions under read-only mode, and reject API-shaped `parent_identifier` in File Store full-body `list_children`.

### Review
- Merged current `origin/main` into PR #211 and resolved conflicts in `README.md`, `src/registry/index.ts`, and task history.
- Hardened File Store multipart input handling: update requires explicit `body.parent_identifier`, malformed `content_base64` is rejected before `Buffer.from`, and `list_children` accepts the generic `resource_id` -> `file_store_id` path.
- Follow-up review fix: create also requires explicit `body.parent_identifier`; `list_children` shorthand identifiers are documented through `paramsSchema`, while `bodySchema` now describes only a real FileStoreNode body.
- Second follow-up review fix: multipart `body.content` must be a string, and `list_children` rejects invalid File Store node `type`/`node_type` values before dispatch.
- Added helper and `harness_execute` regression coverage, documented `file_store` in README resource/toolset tables, and extended `docs:check` coverage for the File Store README section.
- Verification passed: `pnpm typecheck`, focused File Store/client and `harness_execute` Vitest runs, `pnpm build`, `pnpm docs:generate`, `pnpm docs:check`, full `pnpm test`, and `git diff --check`.
- Follow-up verification passed: `pnpm typecheck`, focused File Store/helper and tool-handler Vitest runs, `pnpm build`, `pnpm docs:check`, full `pnpm test`, and `git diff --check`.
- Second follow-up verification passed: `pnpm typecheck`, focused File Store/helper and tool-handler Vitest runs, `pnpm build`, `pnpm docs:check`, full `pnpm test`, and `git diff --check`.
- Third follow-up review fix: multipart scalar metadata is string-validated before FormData construction, FILE uploads reject simultaneous `content` and `content_base64`, and `list_children` rejects conflicting folder identifiers instead of letting stale aliases override the generic resource id.
- Third follow-up verification passed: `pnpm typecheck`, `pnpm exec vitest run tests/registry/file-store-multipart.test.ts`, `pnpm exec vitest run tests/tools/tool-handlers.test.ts -t "File Store"`, `pnpm build`, `pnpm docs:check`, `git diff --check`, and `pnpm test`.
- Fourth follow-up review fix: FOLDER multipart bodies now reject `content`/`content_base64` instead of silently dropping them, and full-body `list_children` rejects top-level generic IDs that conflict with `body.identifier`.
- Fourth follow-up verification passed: `pnpm typecheck`, `pnpm exec vitest run tests/registry/file-store-multipart.test.ts`, `pnpm exec vitest run tests/tools/tool-handlers.test.ts -t "File Store"`, `pnpm build`, `pnpm docs:check`, `git diff --check`, and `pnpm test`.
- Fifth follow-up review fix: create/update body schemas now document their different FILE content requirements, update rejects path/body identifier conflicts, and full-body `list_children` validates `identifier`/`name` scalar types before dispatch.
- Fifth follow-up verification passed: `pnpm typecheck`, `pnpm exec vitest run tests/registry/file-store-multipart.test.ts`, `pnpm exec vitest run tests/tools/tool-handlers.test.ts -t "File Store"`, `pnpm build`, `pnpm docs:check`, `git diff --check`, and `pnpm test`.
- Sixth follow-up review fix: `harness_execute` now exposes and URL-derives `resource_scope`, read-only mode permits execute actions whose operation policy is `risk: "read"`, and full-body File Store `list_children` rejects snake_case `parent_identifier`.
- Sixth follow-up verification passed: `pnpm typecheck`, `pnpm exec vitest run tests/registry/file-store-multipart.test.ts tests/tools/tool-handlers.test.ts tests/registry/registry.test.ts tests/utils/url-parser.test.ts`, `pnpm build`, `pnpm docs:check`, `git diff --check`, and `pnpm test`.
- CI smoke follow-up: `scripts/smoke-test.js` now checks read-only mode with a real write-risk execute action (`pipeline.run`) and a real read-risk execute action (`file_store.list_children`), matching the updated registry contract. Verification passed: `env HARNESS_READ_ONLY=true node scripts/smoke-test.js`, `pnpm build`, `pnpm typecheck`, focused Vitest run, `pnpm docs:check`, `git diff --check`, and `pnpm test`.
- Seventh follow-up review fix: `file_store.list_children` now rejects `FILE` in full-body and shorthand inputs, and its surfaced body/params schema metadata describes `FOLDER` only.
- Seventh follow-up verification passed: `pnpm typecheck`, `pnpm exec vitest run tests/registry/file-store-multipart.test.ts tests/tools/tool-handlers.test.ts`, `pnpm build`, `pnpm docs:check`, `git diff --check`, and `pnpm test`.
- Eighth follow-up review fix: generic write tools now opt into URL-derived `resource_scope`, and File Store update metadata no longer advertises `body.identifier` as a replacement for the required top-level `resource_id`.
- Eighth follow-up verification passed: `pnpm typecheck`, `pnpm exec vitest run tests/registry/file-store-multipart.test.ts tests/tools/tool-handlers.test.ts tests/utils/url-parser.test.ts`, `pnpm build`, `pnpm docs:check`, `git diff --check`, and `pnpm test`.
- Ninth follow-up review fix: URL-only `harness_update`/`harness_delete` calls now resolve the primary ID from the parsed URL, edited optional Zod fields keep `.describe()` last, and File Store `file_usage` rejects values outside `MANIFEST_FILE`, `CONFIG`, or `SCRIPT` before dispatch.
- Ninth follow-up verification passed: `pnpm typecheck`, `pnpm exec vitest run tests/registry/file-store-multipart.test.ts tests/tools/tool-handlers.test.ts tests/utils/url-parser.test.ts`, `pnpm build`, `pnpm docs:check`, `git diff --check`, and `pnpm test`.

## PR 172 Conflict Resolution (2026-06-04)
- [x] Inspect PR status and identify conflicted documentation files
- [x] Merge current `origin/main` into PR branch
- [x] Resolve documentation and task-log conflicts
- [x] Run docs/build/test verification
- [x] Push resolved branch and re-check PR status

### Plan
- Preserve current public docs as source of truth where main has newer runtime-facing guidance.
- Keep the security exemption workflow documentation from the PR where it still matches current files.
- Treat this as a docs-focused conflict resolution unless verification exposes a runtime contract mismatch.

### Review
- Merged current `origin/main` into PR #172 and resolved conflicts in contributor docs, Gemini docs, security exemption test docs, and task history.
- Updated security exemption docs and prompt guidance to match the current execute surface: `approve` and `reject` are the available actions, while elevated approval uses `approve` with `body.scope`.
- Verification passed: `pnpm docs:check`, `pnpm typecheck`, `pnpm build`, focused STO/registry/tool tests, full `pnpm test`, and `git diff --check`.

## Vitest Security Upgrade (2026-06-03)
- [x] Confirm the affected local Vitest version and patched target
- [x] Upgrade `vitest` dev dependency to the patched 4.1 line
- [x] Regenerate `pnpm-lock.yaml`
- [x] Run focused and broad verification

### Plan
- Address GHSA-5xrq-8626-4rwp / Dependabot alert by moving from `vitest` 3.2.4 to `vitest` 4.1.0 or later.
- Keep the change limited to test tooling metadata and lockfile updates unless v4 requires code/config changes.
- Verify with the release metadata test, typecheck, and the full Vitest test suite.

### Review
- Updated `devDependencies.vitest` from `^3.0.6` to `^4.1.0`; `pnpm-lock.yaml` now resolves `vitest` to `4.1.8`.
- `pnpm audit` also surfaced a moderate `qs` advisory through `express`; added a narrow `pnpm.overrides.qs >=6.15.2` entry and regenerated the lockfile to resolve `qs` to `6.15.2`.
- Verification passed: `pnpm audit` reports no known vulnerabilities; `pnpm vitest run tests/release-metadata.test.ts`, `pnpm typecheck`, `pnpm test` (70 files / 1770 tests), `pnpm build`, and `git diff --check` all pass.

## Version Bump 3.1.2 (2026-06-03)
- [x] Identify release metadata fields pinned to the previous version
- [x] Update package and manifest versions to 3.1.2
- [x] Update release metadata regression test
- [x] Run verification

### Plan
- Keep this as a metadata-only patch release bump.
- Update `package.json`, root `manifest.json`, `mcp-directory/manifest.json`, and the release metadata test expectation.
- Do not change dependency versions or generated lockfile data unless verification shows the package manager requires it.

### Review
- Updated `package.json`, root `manifest.json`, and `mcp-directory/manifest.json` to `3.1.2`.
- Updated `tests/release-metadata.test.ts` so package and bundle manifest versions remain locked together for the `3.1.2` release.
- Verification passed: `pnpm vitest run tests/release-metadata.test.ts`, `pnpm typecheck`, and `git diff --check`.
