# Harness MCP Server

An MCP (Model Context Protocol) server that gives AI agents full access to the Harness.io platform through 10 consolidated tools and 113+ resource types.

[![CI](https://github.com/thisrohangupta/harness-poc-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/thisrohangupta/harness-poc-mcp/actions/workflows/ci.yml)

## Why This Exists

The naive approach to building an MCP server for a platform like Harness is 1:1 API-to-tool mapping: one tool per endpoint. That path leads to 240+ tools, which is an anti-pattern — LLMs degrade at tool selection when the tool count is high, context windows fill with schema definitions, and every new API endpoint requires a new tool.

This server takes a different approach: **registry-based dispatch**. Instead of hundreds of individual tools, there are 10 generic tools that operate on any of 113+ resource types. Adding a new Harness resource means adding a declarative data file — no new tool registration, no schema changes, no prompt updates.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm

### Install and Build

```bash
git clone https://github.com/thisrohangupta/harness-poc-mcp.git
cd harness-poc-mcp
pnpm install
pnpm build
```

### Configure

Copy `.env.example` to `.env` and fill in your Harness credentials:

```bash
cp .env.example .env
```

At minimum, set `HARNESS_API_KEY`. The account ID is auto-extracted from PAT tokens (`pat.<accountId>.<tokenId>.<secret>`), so `HARNESS_ACCOUNT_ID` is only needed for non-PAT tokens.

### Run

```bash
# Stdio transport (for local AI clients)
pnpm start

# Or directly
node build/index.js stdio

# HTTP transport (for remote/shared deployment)
pnpm start:http

# Or with a custom port
node build/index.js http --port 8080

# Test with MCP Inspector
pnpm inspect
```

### Zero-Install via npx

Run without cloning or installing — just provide env vars:

```bash
# Stdio (default)
HARNESS_API_KEY=pat.xxx HARNESS_ACCOUNT_ID=abc123 npx harness-poc-mcp-server

# HTTP on port 8080
HARNESS_API_KEY=pat.xxx HARNESS_ACCOUNT_ID=abc123 npx harness-poc-mcp-server http --port 8080
```

### HTTP Transport

When running in HTTP mode, the server exposes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | `POST` | MCP JSON-RPC endpoint (stateless) |
| `/mcp` | `OPTIONS` | CORS preflight |
| `/health` | `GET` | Health check — returns `{ "status": "ok" }` |

The HTTP transport runs in **stateless mode**: each POST request creates a fresh MCP session. This is ideal for serverless or shared deployments where persistent connections aren't practical.

```bash
# Health check
curl http://localhost:3000/health

# MCP initialize request
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

### Client Configuration

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "harness": {
      "command": "node",
      "args": ["/absolute/path/to/harness-poc-mcp/build/index.js", "stdio"],
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

> **Note:** `HARNESS_DEFAULT_ORG_ID` and `HARNESS_DEFAULT_PROJECT_ID` are optional. Agents can discover orgs and projects dynamically using `harness_list(resource_type="organization")` and `harness_list(resource_type="project")`. Set them only if you want to pin a default scope for convenience.

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "harness": {
      "command": "node",
      "args": ["/absolute/path/to/harness-poc-mcp/build/index.js", "stdio"],
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

**Windsurf** (`~/.windsurf/mcp.json`):

```json
{
  "mcpServers": {
    "harness": {
      "command": "node",
      "args": ["/absolute/path/to/harness-poc-mcp/build/index.js", "stdio"],
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

### Docker

Build and run the server as a Docker container:

```bash
# Build the image
pnpm docker:build

# Run with your .env file
pnpm docker:run

# Or run directly with env vars
docker run --rm -p 3000:3000 \
  -e HARNESS_API_KEY=pat.xxx.xxx.xxx \
  -e HARNESS_ACCOUNT_ID=your-account-id \
  harness-mcp-server
```

The container runs in HTTP mode on port 3000 by default with a built-in health check.

### Kubernetes

Deploy to a Kubernetes cluster using the provided manifests:

```bash
# 1. Edit the Secret with your real credentials
#    k8s/secret.yaml — replace HARNESS_API_KEY and HARNESS_ACCOUNT_ID

# 2. Apply all manifests
kubectl apply -f k8s/

# 3. Verify the deployment
kubectl -n harness-mcp get pods

# 4. Port-forward for local testing
kubectl -n harness-mcp port-forward svc/harness-mcp-server 3000:80
curl http://localhost:3000/health
```

The deployment runs 2 replicas with readiness/liveness probes, resource limits, and non-root security context. The Service exposes port 80 internally (targeting container port 3000).

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HARNESS_API_KEY` | Yes | -- | Harness personal access token or service account token |
| `HARNESS_ACCOUNT_ID` | No | *(from PAT)* | Harness account identifier. Auto-extracted from PAT tokens; only needed for non-PAT API keys |
| `HARNESS_BASE_URL` | No | `https://app.harness.io` | Base URL (override for self-managed Harness) |
| `HARNESS_DEFAULT_ORG_ID` | No | `default` | Default organization identifier. Optional convenience — agents can discover orgs dynamically via `harness_list(resource_type="organization")` |
| `HARNESS_DEFAULT_PROJECT_ID` | No | -- | Default project identifier. Optional convenience — agents can discover projects dynamically via `harness_list(resource_type="project")` |
| `HARNESS_API_TIMEOUT_MS` | No | `30000` | HTTP request timeout in milliseconds |
| `HARNESS_MAX_RETRIES` | No | `3` | Retry count for transient failures (429, 5xx) |
| `LOG_LEVEL` | No | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |
| `HARNESS_TOOLSETS` | No | *(all)* | Comma-separated list of enabled toolsets (see [Toolset Filtering](#toolset-filtering)) |

## Tools Reference

The server exposes 10 MCP tools. Every tool accepts `org_id` and `project_id` as optional overrides — if omitted, they fall back to `HARNESS_DEFAULT_ORG_ID` and `HARNESS_DEFAULT_PROJECT_ID`.

| Tool | Description |
|------|-------------|
| `harness_describe` | Discover available resource types, operations, and fields. No API call — returns local registry metadata. |
| `harness_list` | List resources of a given type with filtering, search, and pagination. |
| `harness_get` | Get a single resource by its identifier. |
| `harness_create` | Create a new resource. Requires `confirmation: true`. |
| `harness_update` | Update an existing resource. Requires `confirmation: true`. |
| `harness_delete` | Delete a resource. Requires `confirmation: true`. Destructive. |
| `harness_execute` | Execute an action on a resource (run pipeline, toggle flag, sync app). Requires `confirmation: true`. |
| `harness_search` | Search across multiple resource types in parallel with a single query. |
| `harness_diagnose` | Aggregate execution details, pipeline YAML, and logs into a single diagnostic payload. |
| `harness_status` | Get a real-time project health dashboard — recent executions, failure rates, and deep links. |

### Tool Examples

**Discover what resources are available:**

```json
{ "resource_type": "pipeline" }
```

**List organizations in the account:**

```json
{ "resource_type": "organization" }
```

**List projects in an organization:**

```json
{ "resource_type": "project", "org_id": "default" }
```

**List pipelines in a project:**

```json
{ "resource_type": "pipeline", "search_term": "deploy", "size": 10 }
```

**Get a specific service:**

```json
{ "resource_type": "service", "resource_id": "my-service-id" }
```

**Run a pipeline:**

```json
{
  "resource_type": "pipeline",
  "action": "run",
  "resource_id": "my-pipeline",
  "confirmation": true,
  "inputs": { "tag": "v1.2.3" }
}
```

**Toggle a feature flag:**

```json
{
  "resource_type": "feature_flag",
  "action": "toggle",
  "resource_id": "new_checkout_flow",
  "enable": true,
  "environment": "production",
  "confirmation": true
}
```

**Search across all resource types:**

```json
{ "query": "payment-service" }
```

**Diagnose a failed execution:**

```json
{ "execution_id": "abc123XYZ", "include_yaml": true, "include_logs": true }
```

**Get project health status:**

```json
{ "pipeline_id": "my-pipeline", "limit": 5 }
```

**Create a connector:**

```json
{
  "resource_type": "connector",
  "body": { "connector": { "name": "My Docker Hub", "identifier": "my_docker", "type": "DockerRegistry" } },
  "confirmation": true
}
```

**Delete a trigger:**

```json
{
  "resource_type": "trigger",
  "resource_id": "nightly-trigger",
  "pipeline_id": "my-pipeline",
  "confirmation": true
}
```

## Resource Types

113+ resource types organized across 25 toolsets. Each resource type supports a subset of CRUD operations and optional execute actions.

### Platform

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `organization` | x | x | x | x | x | |
| `project` | x | x | x | x | x | |

### Pipelines

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `pipeline` | x | x | x | x | x | `run`, `retry` |
| `execution` | x | x | | | | `interrupt` |
| `trigger` | x | x | x | x | x | |
| `pipeline_summary` | | x | | | | |
| `input_set` | x | x | | | | |

### Services

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `service` | x | x | x | x | x | |

### Environments

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `environment` | x | x | x | x | x | `move_configs` |

### Connectors

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `connector` | x | x | x | x | x | `test_connection` |
| `connector_catalogue` | x | | | | | |

### Infrastructure

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `infrastructure` | x | x | x | x | x | `move_configs` |

### Secrets

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `secret` | x | x | | | | |

### Execution Logs

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `execution_log` | | x | | | | |

### Audit Trail

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `audit_event` | x | x | | | | |

### Delegates

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `delegate` | x | | | | | |
| `delegate_token` | x | x | x | | x | `revoke`, `get_delegates` |

### Code Repositories

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `repository` | x | x | | | | |

### Artifact Registries

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `registry` | x | x | | | | |
| `artifact` | x | | | | | |
| `artifact_version` | x | | | | | |
| `artifact_file` | x | | | | | |

### Templates

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `template` | x | x | | | | |

### Dashboards

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `dashboard` | x | x | | | | |
| `dashboard_data` | | x | | | | |

### Internal Developer Portal (IDP)

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `idp_entity` | x | x | | | | |
| `scorecard` | x | x | | | | |
| `scorecard_check` | x | x | | | | |
| `scorecard_stats` | | x | | | | |
| `scorecard_check_stats` | | x | | | | |
| `idp_score` | x | x | | | | |
| `idp_workflow` | x | | | | | `execute` |
| `idp_tech_doc` | x | | | | | |

### Pull Requests

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `pull_request` | x | x | x | | | |
| `pr_check` | x | | | | | |
| `pr_activity` | x | | | | | |

### Feature Flags

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `fme_workspace` | x | | | | | |
| `fme_environment` | x | | | | | |
| `feature_flag` | x | x | x | | x | `toggle` |

### GitOps

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `gitops_agent` | x | x | | | | |
| `gitops_application` | x | x | | | | `sync` |
| `gitops_cluster` | x | x | | | | |
| `gitops_repository` | x | x | | | | |
| `gitops_applicationset` | x | x | | | | |
| `gitops_repo_credential` | x | x | | | | |
| `gitops_app_event` | x | | | | | |
| `gitops_pod_log` | | x | | | | |
| `gitops_managed_resource` | x | | | | | |
| `gitops_resource_action` | x | | | | | |
| `gitops_dashboard` | | x | | | | |
| `gitops_app_resource_tree` | | x | | | | |

### Chaos Engineering

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `chaos_experiment` | x | x | | | | `run` |
| `chaos_probe` | x | x | | | | |
| `chaos_experiment_template` | x | | | | | `create_from_template` |
| `chaos_infrastructure` | x | | | | | |
| `chaos_experiment_variable` | x | | | | | |
| `chaos_experiment_run` | x | x | | | | |
| `chaos_loadtest` | x | x | x | | x | `run`, `stop` |

### Cloud Cost Management (CCM)

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `cost_perspective` | x | x | x | x | x | |
| `cost_breakdown` | x | | | | | |
| `cost_timeseries` | x | | | | | |
| `cost_summary` | x | x | | | | |
| `cost_recommendation` | x | x | | | | `update_state`, `override_savings`, `create_jira_ticket`, `create_snow_ticket` |
| `cost_anomaly` | x | | | | | |
| `cost_category` | x | | | | | |
| `cost_overview` | | x | | | | |
| `cost_metadata` | | x | | | | |
| `cost_filter_value` | x | | | | | |
| `cost_recommendation_stats` | | x | | | | |
| `cost_recommendation_by_type` | x | | | | | |
| `cost_recommendation_detail` | | x | | | | |
| `cost_ignored_anomaly` | x | | | | | |
| `cost_commitment_coverage` | | x | | | | |
| `cost_commitment_savings` | | x | | | | |
| `cost_commitment_utilisation` | | x | | | | |
| `cost_commitment_analysis` | | x | | | | |
| `cost_estimated_savings` | | x | | | | |

### Software Engineering Insights (SEI)

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `sei_metric` | x | | | | | |
| `sei_deployment_frequency` | | x | | | | |
| `sei_deployment_frequency_drilldown` | | x | | | | |
| `sei_change_failure_rate` | | x | | | | |
| `sei_change_failure_rate_drilldown` | | x | | | | |
| `sei_mttr` | | x | | | | |
| `sei_lead_time` | | x | | | | |
| `sei_team` | x | x | | | | |
| `sei_team_integration` | x | | | | | |
| `sei_team_developer` | x | | | | | |
| `sei_org_tree` | x | x | | | | |
| `sei_business_alignment` | x | x | | | | |
| `sei_ai_usage` | | x | | | | |
| `sei_ai_usage_breakdown` | x | | | | | |
| `sei_ai_adoption` | | x | | | | |
| `sei_ai_adoption_breakdown` | x | | | | | |
| `sei_ai_impact` | | x | | | | |
| `sei_ai_raw_metric` | x | | | | | |

### Software Supply Chain Assurance (SCS)

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `artifact_security` | x | x | | | | |
| `code_repo_security` | x | x | | | | |
| `scs_sbom` | | x | | | | |
| `scs_artifact_component` | x | | | | | |
| `scs_compliance_result` | x | | | | | |
| `scs_artifact_remediation` | | x | | | | |
| `scs_chain_of_custody` | | x | | | | |
| `scs_opa_policy` | | | x | | | |

### Security Testing Orchestration (STO)

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `security_issue` | x | x | | | | |
| `security_exemption` | x | | | | | `approve`, `reject`, `promote` |

### Access Control

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `user` | x | x | | | | |
| `user_group` | x | x | x | | x | |
| `service_account` | x | x | x | | x | |
| `role` | x | x | x | | x | |
| `role_assignment` | x | | x | | | |
| `resource_group` | x | x | x | | x | |
| `permission` | x | | | | | |

### Settings

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `setting` | x | | | | | |

## MCP Prompts

| Prompt | Description | Parameters |
|--------|-------------|------------|
| `debug-pipeline-failure` | Analyze a failed execution: gathers execution details, pipeline YAML, and logs, then provides root cause analysis and suggested fixes | `executionId` (required), `projectId` (optional) |
| `create-pipeline` | Generate a new pipeline YAML from natural language requirements, reviewing existing resources for context | `description` (required), `projectId` (optional) |
| `optimize-costs` | Analyze cloud cost data, surface recommendations and anomalies, prioritized by potential savings | `projectId` (optional) |
| `security-review` | Review security issues across Harness resources and suggest remediations by severity | `projectId` (optional), `severity` (optional, default: `critical,high`) |
| `onboard-service` | Walk through onboarding a new service with environments and a deployment pipeline | `serviceName` (required), `projectId` (optional) |

## MCP Resources

| Resource URI | Description | MIME Type |
|--------------|-------------|-----------|
| `pipeline:///{pipelineId}` | Pipeline YAML definition | `application/x-yaml` |
| `pipeline:///{orgId}/{projectId}/{pipelineId}` | Pipeline YAML (with explicit scope) | `application/x-yaml` |
| `executions:///recent` | Last 10 pipeline execution summaries | `application/json` |
| `schema:///pipeline` | Harness pipeline JSON Schema | `application/schema+json` |
| `schema:///template` | Harness template JSON Schema | `application/schema+json` |
| `schema:///trigger` | Harness trigger JSON Schema | `application/schema+json` |

## Toolset Filtering

By default, all 25 toolsets (and their 113+ resource types) are enabled. Use `HARNESS_TOOLSETS` to expose only the toolsets you need. This reduces the resource types the LLM sees, improving tool selection accuracy.

```bash
# Only expose pipelines, services, and connectors
HARNESS_TOOLSETS=pipelines,services,connectors
```

Available toolset names:

| Toolset | Resource Types |
|---------|---------------|
| `platform` | organization, project |
| `pipelines` | pipeline, execution, trigger, pipeline_summary, input_set |
| `services` | service |
| `environments` | environment |
| `connectors` | connector, connector_catalogue |
| `infrastructure` | infrastructure |
| `secrets` | secret |
| `logs` | execution_log |
| `audit` | audit_event |
| `delegates` | delegate, delegate_token |
| `repositories` | repository |
| `registries` | registry, artifact, artifact_version, artifact_file |
| `templates` | template |
| `dashboards` | dashboard, dashboard_data |
| `idp` | idp_entity, scorecard, scorecard_check, scorecard_stats, scorecard_check_stats, idp_score, idp_workflow, idp_tech_doc |
| `pull-requests` | pull_request, pr_check, pr_activity |
| `feature-flags` | fme_workspace, fme_environment, feature_flag |
| `gitops` | gitops_agent, gitops_application, gitops_cluster, gitops_repository, gitops_applicationset, gitops_repo_credential, gitops_app_event, gitops_pod_log, gitops_managed_resource, gitops_resource_action, gitops_dashboard, gitops_app_resource_tree |
| `chaos` | chaos_experiment, chaos_probe, chaos_experiment_template, chaos_infrastructure, chaos_experiment_variable, chaos_experiment_run, chaos_loadtest |
| `ccm` | cost_perspective, cost_breakdown, cost_timeseries, cost_summary, cost_recommendation, cost_anomaly, cost_category, cost_overview, cost_metadata, cost_filter_value, cost_recommendation_stats, cost_recommendation_by_type, cost_recommendation_detail, cost_ignored_anomaly, cost_commitment_coverage, cost_commitment_savings, cost_commitment_utilisation, cost_commitment_analysis, cost_estimated_savings |
| `sei` | sei_metric, sei_deployment_frequency, sei_deployment_frequency_drilldown, sei_change_failure_rate, sei_change_failure_rate_drilldown, sei_mttr, sei_lead_time, sei_team, sei_team_integration, sei_team_developer, sei_org_tree, sei_business_alignment, sei_ai_usage, sei_ai_usage_breakdown, sei_ai_adoption, sei_ai_adoption_breakdown, sei_ai_impact, sei_ai_raw_metric |
| `scs` | artifact_security, code_repo_security, scs_sbom, scs_artifact_component, scs_compliance_result, scs_artifact_remediation, scs_chain_of_custody, scs_opa_policy |
| `sto` | security_issue, security_exemption |
| `access_control` | user, user_group, service_account, role, role_assignment, resource_group, permission |
| `settings` | setting |

## Architecture

```
                 +------------------+
                 |   AI Agent       |
                 |  (Claude, etc.)  |
                 +--------+---------+
                          |  MCP (stdio or HTTP)
                 +--------v---------+
                 |    MCP Server     |
                 | 10 Generic Tools  |
                 +--------+---------+
                          |
                 +--------v---------+
                 |    Registry       |  <-- Declarative resource definitions
                 |  25 Toolsets      |      (data files, not code)
                 |  113+ Resource Types|
                 +--------+---------+
                          |
                 +--------v---------+
                 |  HarnessClient    |  <-- Auth, retry, rate limiting
                 +--------+---------+
                          |  HTTPS
                 +--------v---------+
                 |  Harness REST API |
                 +-------------------+
```

### How It Works

1. **Tools** are generic verbs: `harness_list`, `harness_get`, etc. They accept a `resource_type` parameter that routes to the correct API endpoint.

2. **The Registry** maps each `resource_type` to a `ResourceDefinition` — a declarative data structure specifying the HTTP method, URL path, path/query parameter mappings, and response extraction logic.

3. **Dispatch** resolves the resource definition, builds the HTTP request (path substitution, query params, scope injection), calls the Harness API through `HarnessClient`, and extracts the relevant response data.

4. **Toolset filtering** (`HARNESS_TOOLSETS`) controls which resource definitions are loaded into the registry at startup.

5. **Deep links** are automatically appended to responses, providing direct Harness UI URLs for every resource.

6. **Compact mode** strips verbose metadata from list results, keeping only actionable fields (identity, status, type, timestamps, deep links) to minimize token usage.

### Adding a New Resource Type

Create a new file in `src/registry/toolsets/` or add a resource to an existing toolset:

```typescript
// src/registry/toolsets/my-module.ts
import type { ToolsetDefinition } from "../types.js";

export const myModuleToolset: ToolsetDefinition = {
  name: "my-module",
  displayName: "My Module",
  description: "Description of the module",
  resources: [
    {
      resourceType: "my_resource",
      displayName: "My Resource",
      description: "What this resource represents",
      toolset: "my-module",
      scope: "project",                    // "project" | "org" | "account"
      identifierFields: ["resource_id"],
      listFilterFields: ["search_term"],
      operations: {
        list: {
          method: "GET",
          path: "/my-module/api/resources",
          queryParams: { search_term: "search", page: "page", size: "size" },
          responseExtractor: (raw) => raw,
          description: "List resources",
        },
        get: {
          method: "GET",
          path: "/my-module/api/resources/{resourceId}",
          pathParams: { resource_id: "resourceId" },
          responseExtractor: (raw) => raw,
          description: "Get resource details",
        },
      },
    },
  ],
};
```

Then import it in `src/registry/index.ts` and add it to the `ALL_TOOLSETS` array. No changes needed to any tool files.

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck

# Run tests
pnpm test

# Watch tests
pnpm test:watch

# Interactive MCP Inspector
pnpm inspect
```

### Project Structure

```
src/
  index.ts                          # Entrypoint, transport setup
  config.ts                         # Env var validation (Zod)
  client/
    harness-client.ts               # HTTP client (auth, retry, rate limiting)
    types.ts                        # Shared API types
  registry/
    index.ts                        # Registry class + dispatch logic
    types.ts                        # ResourceDefinition, ToolsetDefinition, etc.
    toolsets/                        # One file per toolset (declarative data)
      platform.ts
      pipelines.ts
      services.ts
      ccm.ts
      access-control.ts
      ...
  tools/                            # 10 generic MCP tools
    harness-list.ts
    harness-get.ts
    harness-create.ts
    harness-update.ts
    harness-delete.ts
    harness-execute.ts
    harness-search.ts
    harness-diagnose.ts
    harness-describe.ts
    harness-status.ts
  resources/                        # MCP resource providers
    pipeline-yaml.ts
    execution-summary.ts
  prompts/                          # MCP prompt templates
    debug-pipeline.ts
    create-pipeline.ts
    optimize-costs.ts
    security-review.ts
    onboard-service.ts
  utils/
    cli.ts                          # CLI arg parsing (transport, port)
    errors.ts                       # Error normalization
    logger.ts                       # stderr-only logger
    rate-limiter.ts                 # Client-side rate limiting
    deep-links.ts                   # Harness UI deep link builder
    response-formatter.ts           # Consistent MCP response formatting
    compact.ts                      # Compact list output for token efficiency
tests/
  config.test.ts                    # Config schema validation tests
  utils/
    response-formatter.test.ts
    deep-links.test.ts
    errors.test.ts
  registry/
    registry.test.ts                # Registry loading, filtering, dispatch tests
```

## Safety

- **Secrets are never exposed.** The `secret` resource type returns metadata only (name, type, scope) — secret values are never included in any response.
- **Write operations require confirmation.** `harness_create`, `harness_update`, `harness_delete`, and `harness_execute` all require `confirmation: true` before proceeding.
- **Rate limiting.** The client enforces a 10 requests/second limit to avoid hitting Harness API rate limits.
- **Retries with backoff.** Transient failures (HTTP 429, 5xx) are retried with exponential backoff and jitter.
- **No stdout logging.** All logs go to stderr to avoid corrupting the stdio JSON-RPC transport.

## License

Apache 2.0
