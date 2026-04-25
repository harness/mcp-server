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
- [ ] Run focused tests and typecheck

### Review
- Found that users with existing `HARNESS_TOOLSETS=agent-pipelines` or `+agent-pipelines` configs would fail server startup after the toolset was renamed to `agents`.
- Added a narrow parser alias so legacy configs resolve to the current `agents` toolset without reintroducing the old public name internally.
