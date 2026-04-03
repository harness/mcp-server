# Codebase Structure

**Analysis Date:** 2026-04-03

## Directory Layout

```
harness-mcp-server/
├── src/                            # TypeScript source code
│   ├── index.ts                    # Server entrypoint, transport setup, session mgmt
│   ├── config.ts                   # Environment validation, PAT parsing
│   ├── client/
│   │   ├── harness-client.ts       # HTTP client: auth, retry, error handling
│   │   └── types.ts                # Request/response types
│   ├── tools/                      # 11 MCP tools
│   │   ├── index.ts                # Tool registration
│   │   ├── harness-list.ts         # List resources
│   │   ├── harness-get.ts          # Get single resource
│   │   ├── harness-create.ts       # Create resource
│   │   ├── harness-update.ts       # Update resource
│   │   ├── harness-delete.ts       # Delete resource
│   │   ├── harness-execute.ts      # Execute action (run pipeline, etc)
│   │   ├── harness-diagnose.ts     # Analyze failures (logs, errors, health)
│   │   ├── harness-search.ts       # Full-text search
│   │   ├── harness-describe.ts     # Introspection (list resource types, operations)
│   │   ├── harness-status.ts       # Aggregate resource status
│   │   ├── harness-schema.ts       # Fetch JSON schemas
│   │   └── diagnose/               # Failure analysis utilities
│   │       ├── analyze.ts
│   │       ├── log-analyzer.ts
│   │       └── ...
│   ├── registry/                   # Resource registry & routing
│   │   ├── index.ts                # Registry class
│   │   ├── types.ts                # Resource/operation/endpoint type definitions
│   │   ├── extractors.ts           # Response extraction functions
│   │   └── toolsets/               # 34 resource toolsets
│   │       ├── pipelines.ts        # CI/CD pipelines, triggers, input sets
│   │       ├── agent-pipelines.ts  # Autonomous agents
│   │       ├── services.ts         # Deployment services
│   │       ├── environments.ts     # Deployment environments
│   │       ├── connectors.ts       # Git/Docker/K8s connectors
│   │       ├── infrastructure.ts   # Cloud infrastructure
│   │       ├── secrets.ts          # Secret management
│   │       ├── logs.ts             # Execution logs
│   │       ├── audit.ts            # Audit logs
│   │       ├── delegates.ts        # Delegate health/status
│   │       ├── repositories.ts     # Harness Code repos
│   │       ├── registries.ts       # Artifact registries
│   │       ├── templates.ts        # Pipeline templates
│   │       ├── dashboards.ts       # Dashboards
│   │       ├── idp.ts              # Internal Developer Portal
│   │       ├── pull-requests.ts    # Harness Code pull requests
│   │       ├── feature-flags.ts    # Feature flag toggles
│   │       ├── gitops.ts           # GitOps applications & deployments
│   │       ├── chaos.ts            # Chaos engineering experiments
│   │       ├── ccm.ts              # Cloud Cost Management (budgets, perspectives)
│   │       ├── sei.ts              # Software Engineering Insights (DORA, sprints)
│   │       ├── scs.ts              # Supply Chain Security (SBOM, artifacts)
│   │       ├── sto.ts              # Security Testing Orchestration (scans)
│   │       ├── access-control.ts   # Roles, policies, permissions
│   │       ├── settings.ts         # Account settings
│   │       ├── platform.ts         # Platform entities (orgs, projects)
│   │       ├── visualizations.ts   # Dashboards & charts
│   │       ├── governance.ts       # Governance policies & rules
│   │       ├── freeze.ts           # Deployment freezes
│   │       └── overrides.ts        # Service overrides
│   ├── resources/                  # Optional MCP resources (read-only)
│   │   ├── index.ts                # Resource registration
│   │   ├── pipeline-yaml.ts        # Pipeline YAML as resource
│   │   ├── execution-summary.ts    # Recent executions as resource
│   │   └── harness-schema.ts       # JSON schemas as resource
│   ├── prompts/                    # 28 pre-built prompt templates
│   │   ├── index.ts                # Prompt registration
│   │   ├── debug-pipeline.ts       # Debug failed pipeline
│   │   ├── create-pipeline.ts      # Create new pipeline
│   │   ├── create-agent.ts         # Create autonomous agent
│   │   ├── optimize-costs.ts       # FinOps: cost optimization
│   │   ├── security-review.ts      # Security: review vulnerabilities
│   │   ├── onboard-service.ts      # Onboard new service
│   │   ├── dora-metrics.ts         # DevOps: DORA metrics
│   │   ├── setup-gitops.ts         # GitOps setup workflow
│   │   ├── chaos-resilience.ts     # Chaos engineering
│   │   ├── feature-flag-rollout.ts # Feature flag rollout strategy
│   │   ├── delegate-health.ts      # Delegate health check
│   │   ├── developer-scorecard.ts  # Developer productivity scorecard
│   │   ├── cloud-cost-breakdown.ts # Cost breakdown analysis
│   │   ├── commitment-utilization.ts # Commitment usage
│   │   ├── cost-anomaly.ts         # Cost anomaly detection
│   │   ├── rightsizing.ts          # Resource rightsizing
│   │   ├── vulnerability-triage.ts # Security: triage vulns
│   │   ├── sbom-compliance.ts      # Supply chain: SBOM compliance
│   │   ├── supply-chain-audit.ts   # Supply chain audit
│   │   ├── exemption-review.ts     # Policy exemption review
│   │   ├── access-control-audit.ts # RBAC audit
│   │   ├── code-review.ts          # PR code review
│   │   ├── pr-summary.ts           # PR summary
│   │   ├── branch-cleanup.ts       # Stale branch cleanup
│   │   ├── pending-approvals.ts    # Approval workflow
│   │   └── build-deploy-app.ts     # End-to-end build & deploy workflow
│   ├── data/
│   │   └── schemas/                # Pre-compiled JSON schemas
│   │       ├── index.ts            # Schema registry
│   │       ├── pipeline.ts         # Pipeline schema (3.0 MB)
│   │       ├── template.ts         # Template schema (3.7 MB)
│   │       ├── trigger.ts          # Trigger schema
│   │       └── agent-pipeline.ts   # Agent pipeline schema
│   └── utils/                      # Utility modules
│       ├── logger.ts               # Stderr-only structured logging
│       ├── errors.ts               # Error classification & MCP mapping
│       ├── url-parser.ts           # Extract IDs from Harness URLs
│       ├── rate-limiter.ts         # Token bucket rate limiting
│       ├── deep-links.ts           # Generate Harness UI links
│       ├── input-expander.ts       # Declarative input transformations
│       ├── runtime-input-resolver.ts # Resolve template variables
│       ├── body-normalizer.ts      # Normalize request bodies
│       ├── response-formatter.ts   # Format tool responses
│       ├── log-resolver.ts         # Download & parse execution logs
│       ├── log-prefix.ts           # Build log query prefixes
│       ├── compact.ts              # Strip metadata from items
│       ├── cli.ts                  # Parse command-line args
│       ├── elicitation.ts          # User confirmation prompts
│       ├── type-guards.ts          # Type narrowing helpers
│       ├── zip-csv.ts              # CSV export utilities
│       ├── svg/                    # SVG visualization rendering
│       │   ├── index.ts
│       │   ├── architecture.ts     # Pipeline architecture diagrams
│       │   ├── stage-flow.ts       # Pipeline stage flow
│       │   ├── timeline.ts         # Execution timelines
│       │   ├── status-summary.ts   # Status summaries
│       │   ├── executions-timeseries.ts # Execution count timeseries
│       │   ├── list-visuals.ts     # List visualizations (bar/pie/timeseries)
│       │   ├── colors.ts           # Color palette
│       │   ├── escape.ts           # SVG text escaping
│       │   ├── render-png.ts       # SVG → PNG conversion
│       │   ├── types.ts            # Chart type definitions
│       │   ├── mappers.ts          # Data → visual mappers
│       │   └── charts/             # Chart implementations
│       │       ├── bar-chart.ts
│       │       ├── pie-chart.ts
│       │       ├── timeseries-chart.ts
│       │       └── ...
│       └── progress.ts             # Progress tracking
├── tests/                          # Test suite (Vitest)
│   ├── tools/                      # Tool-level unit tests
│   ├── client/                     # HTTP client tests
│   ├── registry/                   # Registry dispatch tests
│   └── integration/                # End-to-end tests
├── tasks/                          # Documentation & tracking
│   ├── todo.md                     # Current task tracking
│   └── lessons.md                  # Self-improvement log
├── scripts/                        # Build & utility scripts
│   └── sync-schemas.js             # Fetch latest schemas from Harness
├── .planning/                      # Project planning (GSD)
│   ├── codebase/                   # This directory
│   └── ...
├── k8s/                            # Kubernetes deployment manifests
├── docs/                           # User documentation
├── .github/                        # GitHub Actions CI/CD
├── .env.example                    # Environment variable template
├── package.json                    # Node.js dependencies
├── pnpm-lock.yaml                  # pnpm lockfile
├── tsconfig.json                   # TypeScript configuration
├── vitest.config.ts                # Test configuration
├── Dockerfile                      # Docker build
├── README.md                       # Project overview & quick start
├── AGENTS.md                       # AI agent architecture guide
├── CONTRIBUTING.md                # Contribution guidelines
└── LICENSE                         # Apache 2.0 license
```

## Directory Purposes

**src/:**
- Purpose: TypeScript source code — compiled to `build/` via tsc
- Contains: All runtime code (tools, registry, client, utilities)
- Key files: `index.ts` (entry), `config.ts` (env validation), `client/harness-client.ts` (HTTP)

**src/tools/:**
- Purpose: 11 MCP tool implementations
- Contains: Each tool is a single file with `register*Tool()` export
- Key files: All `harness-*.ts` files dispatch to registry, then format/return results
- Pattern: Each tool calls `registry.dispatch(client, resourceType, operation, input)` with user inputs

**src/registry/:**
- Purpose: Resource definitions and operation routing
- Contains: Registry class (dispatch logic) + 34 toolset files (declarative resource specs)
- Key files: `index.ts` (Registry class), `types.ts` (type definitions), `toolsets/*.ts` (resource definitions)
- Pattern: Add new Harness resource → add resource def to appropriate toolset file, no code changes elsewhere

**src/registry/toolsets/:**
- Purpose: Declare all Harness resources (139 total) and their CRUD operations
- Contains: 34 toolset files, one per product/domain (pipelines, services, connectors, etc.)
- Key files: 
  - Large: `pipelines.ts` (28.9K), `gitops.ts` (56K), `chaos.ts` (65.5K), `scs.ts` (37.9K)
  - Medium: `ccm.ts` (43.7K), `feature-flags.ts` (21.8K), `repositories.ts` (21.6K)
  - Small: `secrets.ts`, `logs.ts`, `settings.ts` (under 5K each)
- Pattern: Each resource declares `operations: { list: {...}, get: {...}, create: {...}, ... }` with endpoint specs

**src/resources/:**
- Purpose: Optional MCP resources — static/semi-static data LLMs can reference
- Contains: 3 resources (pipeline YAML, execution summaries, JSON schemas)
- Used by: Tools can link to resources instead of embedding large data

**src/prompts/:**
- Purpose: Pre-built prompts for guided workflows
- Contains: 28 templates organized by domain (DevOps, FinOps, DevSecOps, etc.)
- Pattern: Each prompt file exports `register*Prompt(server)` function

**src/data/schemas/:**
- Purpose: Pre-compiled JSON schemas for complex Harness types
- Contains: 5 schema files (pipeline, template, trigger, agent-pipeline)
- Generated: Synced from Harness via `pnpm sync-schemas` (see `scripts/sync-schemas.js`)
- Size: Large files (3MB+) — used by schema tool and for generation guidance

**src/utils/:**
- Purpose: Reusable utilities and cross-cutting concerns
- Contains: ~17 utility modules + SVG visualization rendering
- Key modules:
  - `harness-client.ts` — HTTP communication
  - `errors.ts` — Error handling
  - `url-parser.ts` — URL → identifiers extraction
  - `logger.ts` — Stderr-only logging
  - `svg/` — Execution visualization rendering

**tests/:**
- Purpose: Vitest test suite
- Contains: Unit, integration, and end-to-end tests
- Org: Mirrors `src/` structure (tools/, client/, registry/, integration/)

**tasks/:**
- Purpose: Project documentation and tracking
- Contains: `todo.md` (current tasks), `lessons.md` (self-improvement log)

## Key File Locations

**Entry Points:**
- `src/index.ts` — Server startup, transport selection, session management
- `src/tools/index.ts` — Tool registration
- `src/registry/index.ts` — Registry initialization and dispatch

**Configuration:**
- `src/config.ts` — Environment validation, PAT token parsing
- `.env.example` — Template for required env vars
- `tsconfig.json` — TypeScript compilation settings
- `vitest.config.ts` — Test runner configuration

**Core Logic:**
- `src/client/harness-client.ts` — HTTP client with retry/auth/error handling
- `src/registry/index.ts` — Resource lookup and dispatch routing
- `src/registry/types.ts` — Type definitions for all abstractions

**Tool Implementations:**
- `src/tools/harness-list.ts` — List resources
- `src/tools/harness-get.ts` — Get single resource
- `src/tools/harness-create.ts` — Create resource
- `src/tools/harness-execute.ts` — Execute action
- `src/tools/harness-diagnose.ts` — Analyze failures
- `src/tools/harness-describe.ts` — Introspection

**Resource Definitions (pick one per domain):**
- `src/registry/toolsets/pipelines.ts` — CI/CD workflows (47 resource types)
- `src/registry/toolsets/services.ts` — Deployment services
- `src/registry/toolsets/pull-requests.ts` — Harness Code PRs
- `src/registry/toolsets/connectors.ts` — Integration connectors
- `src/registry/toolsets/ccm.ts` — Cloud cost management (12K+ lines)

**Utilities:**
- `src/utils/logger.ts` — Structured logging
- `src/utils/errors.ts` — Error classification
- `src/utils/url-parser.ts` — URL → identifiers
- `src/utils/rate-limiter.ts` — Client-side rate limiting
- `src/utils/svg/` — SVG/PNG visualization rendering

**Testing:**
- `tests/` — Vitest test files (mirrors src/ structure)

## Naming Conventions

**Files:**
- Tools: `harness-*.ts` (e.g., `harness-list.ts`, `harness-execute.ts`)
- Toolsets: `<domain>.ts` (e.g., `pipelines.ts`, `ccm.ts`)
- Utilities: Descriptive names with hyphens (e.g., `rate-limiter.ts`, `log-resolver.ts`)
- Schemas: Lowercase entity name (e.g., `pipeline.ts`, `agent-pipeline.ts`)
- Tests: Mirror source with `.test.ts` suffix

**Directories:**
- Domains: Lowercase plural (e.g., `toolsets/`, `resources/`, `prompts/`)
- Code organization: By responsibility (tools, registry, client, utils)

**TypeScript:**
- Types: PascalCase (e.g., `Config`, `ToolsetDefinition`, `EndpointSpec`)
- Interfaces: PascalCase, usually start with `I` (e.g., `IRegistry`)
- Functions: camelCase (e.g., `registerListTool`, `dispatch`)
- Constants: UPPER_SNAKE_CASE (e.g., `LIST_ARRAY_KEYS`, `SESSION_TTL_MS`)
- Variables: camelCase

## Where to Add New Code

**New Harness Resource (e.g., new entity in existing domain):**
1. Add resource def to `src/registry/toolsets/<domain>.ts` under `resources: [{ ... }]`
2. Define operations (list, get, create, etc.) with endpoint specs
3. No code changes needed — tools auto-discover via registry

**New Harness Domain (e.g., new Harness module):**
1. Create `src/registry/toolsets/<domain>.ts` with complete toolset definition
2. Import and add to `ALL_TOOLSETS` in `src/registry/index.ts`
3. Export from toolset file: `export const <domain>Toolset: ToolsetDefinition = { ... }`

**New Tool:**
- ⚠️ **Do not add new tools.** The server uses 11 core tools + dispatch. Instead, add new operations to existing resources via registry.

**New Prompt:**
1. Create `src/prompts/<name>.ts` with `register<Name>Prompt(server)` export
2. Import and register in `src/prompts/index.ts`

**New Utility:**
1. Create `src/utils/<name>.ts` with exported functions
2. Import where needed

**Visualization:**
1. Add chart/diagram to `src/utils/svg/` 
2. Register in `src/utils/svg/list-visuals.ts` or `status-summary.ts`

## Special Directories

**src/registry/toolsets/:**
- Purpose: Resource declarations (not code)
- Generated: No, manually authored
- Committed: Yes

**src/data/schemas/:**
- Purpose: Pre-compiled JSON schemas
- Generated: Yes, via `pnpm sync-schemas` (fetches from Harness API)
- Committed: Yes (checked into git for reproducible builds)

**build/:**
- Purpose: Compiled JavaScript output
- Generated: Yes, via `pnpm build` (tsc compilation)
- Committed: No (in `.gitignore`)

**node_modules/:**
- Purpose: npm dependencies
- Generated: Yes, via `pnpm install`
- Committed: No (in `.gitignore`)

**tests/**:
- Purpose: Test suite
- Pattern: Vitest (not Jest) — configured in `vitest.config.ts`
- Run: `pnpm test` (run once), `pnpm test:watch` (watch mode)

---

*Structure analysis: 2026-04-03*
