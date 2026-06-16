# Harness MCP Server — Task Tracking

## Critical Bug Inspection (2026-06-16)
- [x] Compare current branch with `origin/main` and confirm this is a recent-main scan
- [x] Review recent elicitation, GitOps scope, dynamic execution, execution input, auth, resources, AI eval, and log-download changes
- [x] Reproduce a high-severity execution-log schema bug with focused regression coverage
- [x] Implement minimal `harness_get` schema fix for URL-only log retrieval
- [ ] Run focused and broad verification
- [ ] Commit, push, open PR, and report outcome in Slack

### Plan
- Treat the branch as matching `origin/main`; inspect recent behavioral commits rather than unmerged local changes.
- Prioritize bugs that can cause crashes/resource exhaustion, unintended writes, auth bypass, wrong-scope mutations, or significant breakage.
- For the confirmed bug, keep the patch limited to the public `harness_get` input surface and add a tool-handler regression that simulates schema-driven clients dropping undocumented fields.

### Review
- Confirmed critical bug: `execution_log` documents `return_download_url=true` to avoid downloading log content, but `harness_get` did not expose the flag in its registered input schema. Strict MCP clients can strip the undocumented top-level flag, causing the handler to call `resolveLogContent()` and buffer/decompress logs instead of returning the signed URL. Large logs with missing or unreliable `Content-Length` can exhaust memory before the resolver's post-buffer size check runs.
- Root cause: the execution-log special case reads `input.return_download_url`, while the public tool schema only allowed generic fields plus `params`.
- Fix: added `return_download_url` to the `harness_get` input schema and added focused tests that prove schema-driven top-level URL mode reaches `resolveLogDownloadUrl()` and does not call `resolveLogContent()`.

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
