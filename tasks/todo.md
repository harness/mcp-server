# Harness MCP Server — Task Tracking

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
