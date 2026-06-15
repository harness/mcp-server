# Harness MCP Server — Task Tracking

## Critical Bug Inspection (2026-06-15)
- [x] Baseline branch and select recent behavioral commits for inspection
- [x] Trace high-risk code paths for concrete critical trigger scenarios
- [x] Run targeted verification for any suspected issue
- [x] Report outcome in Slack; open PR only for a confirmed critical fix

### Plan
- Inspect the latest merged commits on `origin/main`, with emphasis on runtime execution, merged input retrieval, log retrieval, template query mapping, and ai-evals API behavior.
- For each high-risk change, trace caller input schema, registry dispatch, request/body construction, response extraction, and downstream tool result shape.
- Fix only a concrete issue that can cause data loss, crashes, security exposure, or significant user-facing breakage; otherwise report no critical bugs found.

### Review
- Found that `execution_log` documented `return_download_url=true`, and `harness_get` handled it when present, but the registered top-level input schema omitted the field. Schema-driven MCP clients can drop unknown top-level fields before the handler runs, so a caller asking for URL-only logs can silently fall back to downloading and decompressing log content.
- Impact: URL-only log retrieval was added to avoid buffering large execution logs, but the missing public schema field could reintroduce the content path for valid callers and risk log retrieval failures or memory pressure on large/compressible logs.
- Fixed `harness_get` to expose top-level `return_download_url` while preserving the existing `params.return_download_url` path.
- Added regressions proving the field is advertised in the registered schema and that top-level `return_download_url` calls `resolveLogDownloadUrl` without calling `resolveLogContent`.
- Verification passed: red regression failed before the fix; then `pnpm exec vitest run tests/tools/tool-handlers.test.ts -t "return_download_url"`, `pnpm build`, `pnpm docs:generate`, `pnpm typecheck`, full `tests/tools/tool-handlers.test.ts`, full `pnpm test`, and `pnpm docs:check`.
- Opened PR #343 and reported the fix in Slack.

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
