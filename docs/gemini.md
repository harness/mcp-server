# Harness MCP Server — Gemini CLI Context

This extension connects Gemini CLI to the Harness Platform through 10 consolidated MCP tools that cover 137 resource types across 29 toolsets.

## How This Server Works

Unlike traditional MCP servers with one tool per API endpoint, this server uses a **registry-based dispatch** pattern. You interact through generic verb-based tools and specify the `resource_type` you want to work with.

**Start with discovery:**
- `harness_describe` — Browse all available resource types (no API call, instant)
- `harness_describe` with `search_term` — Find resource types by keyword
- `harness_describe` with `resource_type` — Get full detail on a specific type

**Then use CRUD tools:**
- `harness_list` — List resources with filtering and pagination
- `harness_get` — Get a single resource by ID
- `harness_create` — Create a resource (elicits confirmation when supported by the MCP client)
- `harness_update` — Update a resource (elicits confirmation when supported by the MCP client)
- `harness_delete` — Delete a resource (destructive; blocked if confirmation cannot be obtained)

**Specialized tools:**
- `harness_execute` — Run pipelines, toggle feature flags, test connectors, sync GitOps apps
- `harness_search` — Search across multiple resource types at once
- `harness_diagnose` — Diagnose pipelines, connectors, delegates, and GitOps applications
- `harness_status` — Project health overview: failed, running, and recent executions

## Available Capabilities

### CI/CD & Pipelines
- List, view, create, update, and delete pipelines
- Execute pipelines with runtime inputs, retry failed executions, interrupt running ones
- View execution history and download execution logs
- Manage pipeline triggers and input sets
- Pipeline run shorthand support: `branch`, `tag`, `pr_number`, and `commit_sha` auto-expand into CI build input structures (unless `inputs.build` is already provided explicitly)

### Services & Environments
- CRUD operations on services and environments
- Manage infrastructure definitions
- Move environment and infrastructure configs between scopes

### Connectors & Secrets
- List, create, update, and test connectors
- Browse the connector catalogue
- View secret metadata (values are never exposed)

### Cloud Cost Management (CCM)
- Analyze costs with perspectives, breakdowns, and time series
- Access optimization recommendations with savings estimates
- Detect and manage cost anomalies
- Track commitment coverage, utilisation, and savings

### Security & Compliance
- Security Test Orchestration (STO): manage issues, approve/reject exemptions
- Supply Chain Security (SCS): track artifacts, compliance, SBOMs, chain of custody
- Audit trail: comprehensive audit logs for governance

### GitOps
- Manage agents, applications, clusters, repositories
- Sync applications, view resource trees, access pod logs
- Track application events and managed resources

### Chaos Engineering
- List and run chaos experiments
- Create experiments from templates
- View experiment run results and probe details
- Manage load tests

### Feature Flags
- List and manage feature flags across environments
- Toggle flags on/off with environment targeting

### Internal Developer Portal (IDP)
- Manage catalog entities and scorecards
- Track developer experience scores and checks
- Execute IDP workflows, search tech docs

### Templates & Dashboards
- Browse and use pipeline, stage, and step templates
- Access custom dashboards and data exports

### Access Control
- Manage users, user groups, service accounts
- Create and assign roles, resource groups, permissions

### Software Engineering Intelligence (SEI)
- DORA metrics: deployment frequency, change failure rate, MTTR, lead time
- Team and org tree management
- AI usage, adoption, and impact analytics
- Business alignment profiles

## Example Queries

Ask natural language questions like:

- "What's happening in my project right now?"
- "Show me the latest pipeline executions"
- "Why did the deploy-to-prod pipeline fail?"
- "List all services in my project"
- "Find anything related to cost recommendations"
- "Run the nightly-build pipeline with tag v2.1.0"
- "Toggle the dark-mode feature flag on in production"
- "What connectors are available?"
- "Show me critical security issues"
- "List chaos experiments"
- "What GitOps applications are deployed?"
- "Who has admin access?"

## Safety Model

Write operations (`harness_create`, `harness_update`, `harness_delete`, `harness_execute`) use MCP elicitation when the client supports it.

- If elicitation is unavailable or fails:
  - `harness_create`, `harness_update`, and `harness_execute` proceed (best-effort behavior).
  - `harness_delete` is blocked (fail-closed for destructive operations).

Secret values are never exposed — only metadata (name, type, scope).

## Setup

1. **Get your Harness API Key:**
   - Go to Harness Platform > Account Settings > Access Management > API Keys
   - Create a new API key with appropriate permissions

2. **Configure environment variables** in the project's `.env` file:
   ```
   HARNESS_API_KEY=pat.xxxxx.xxxxx.xxxxx
   HARNESS_ACCOUNT_ID=your_account_id   # Optional for PATs, required for non-PAT API keys
   HARNESS_ORG=default
   HARNESS_PROJECT=your_project
   HARNESS_RATE_LIMIT_RPS=10            # Optional: client-side throttling
   HARNESS_MAX_BODY_SIZE_MB=10          # Optional: HTTP mode request size limit
   ```

3. **Build the server:**
   ```bash
   pnpm install && pnpm build
   ```

4. **Test it:**
   Ask: "List my pipelines" or "What's happening in my project?"

**If you get authentication errors:**
- Verify your API key: check `.env` file has `HARNESS_API_KEY` set
- Confirm the API key has proper permissions in Harness Platform
- For self-managed Harness, set `HARNESS_BASE_URL` in `.env`

**Toolset filtering:**
- Set `HARNESS_TOOLSETS=pipelines,services,connectors` in `.env` to limit which resource types are available
- Leave empty to enable all 29 toolsets
