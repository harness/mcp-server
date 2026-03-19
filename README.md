# Harness MCP Server 2.0

An MCP (Model Context Protocol) server that gives AI agents full access to the Harness.io platform through 11 consolidated tools and 126 resource types.

[![CI](https://github.com/thisrohangupta/harness-mcp-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/thisrohangupta/harness-mcp-v2/actions/workflows/ci.yml)

## Why Use This MCP Server

Most MCP servers map one tool per API endpoint. For a platform as broad as Harness, that means 240+ tools — and LLMs get worse at tool selection as the count grows. Context windows fill up with schemas, and every new endpoint means new code.

This server is built differently:

- **11 tools, 126 resource types.** A registry-based dispatch system routes `harness_list`, `harness_get`, `harness_create`, etc. to any Harness resource — pipelines, services, environments, orgs, projects, feature flags, cost data, and more. The LLM picks from 11 tools instead of hundreds.
- **Full platform coverage.** 29 toolsets spanning CI/CD, GitOps, Feature Flags, Cloud Cost Management, Security Testing, Chaos Engineering, Internal Developer Portal, Software Supply Chain, Governance, Visualizations, and more. Not just pipelines — the entire Harness platform.
- **Multi-project workflows out of the box.** Agents discover organizations and projects dynamically — no hardcoded env vars needed. Ask "show failed executions across all projects" and the agent can navigate the full account hierarchy.
- **26 prompt templates.** Pre-built prompts for common workflows: build & deploy apps end-to-end, debug failed pipelines, review DORA metrics, triage vulnerabilities, optimize cloud costs, audit access control, plan feature flag rollouts, review pull requests, approve pending pipelines, and more.
- **Works everywhere.** Stdio transport for local clients (Claude Desktop, Cursor, Windsurf), HTTP transport for remote/shared deployments, Docker and Kubernetes ready.
- **Zero-config start.** Just provide a Harness API key. Account ID is auto-extracted from PAT tokens, org/project defaults are optional, and toolset filtering lets you expose only what you need.
- **Extensible by design.** Adding a new Harness resource means adding a declarative data file — no new tool registration, no schema changes, no prompt updates.

## Quick Start

### Option 1: npx (Recommended)

No install required — just run it:

```bash
npx harness-mcp-v2
```

That's it. Pass your Harness API key via environment variable or configure it in your AI client (see [Client Configuration](#client-configuration) below).

```bash
# Stdio transport (default — for Claude Desktop, Cursor, Windsurf, etc.)
HARNESS_API_KEY=pat.xxx npx harness-mcp-v2

# HTTP transport (for remote/shared deployments)
HARNESS_API_KEY=pat.xxx npx harness-mcp-v2 http --port 8080
```

> **Note:** The account ID is auto-extracted from PAT tokens (`pat.<accountId>.<tokenId>.<secret>`), so `HARNESS_ACCOUNT_ID` is only needed for non-PAT API keys.

### Option 2: Global Install

```bash
npm install -g harness-mcp-v2

# Then run directly
harness-mcp-v2
```

### Option 3: Build from Source

For development or customization:

```bash
git clone https://github.com/thisrohangupta/harness-mcp-v2.git
cd harness-mcp-v2
pnpm install
pnpm build

# Run
pnpm start              # Stdio transport
pnpm start:http         # HTTP transport
pnpm inspect            # Test with MCP Inspector
```

### CLI Usage

```bash
harness-mcp-v2 [stdio|http] [--port <number>]

Options:
  --port <number>  Port for HTTP transport (default: 3000, or PORT env var)
  --help           Show help message and exit
  --version        Print version and exit
```

Transport defaults to `stdio` if not specified. Use `http` for remote/shared deployments.

### HTTP Transport

When running in HTTP mode, the server exposes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | `POST` | MCP JSON-RPC endpoint (initialize + session requests) |
| `/mcp` | `GET` | SSE stream for server-initiated messages (progress, elicitation) |
| `/mcp` | `DELETE` | Terminate an active MCP session |
| `/mcp` | `OPTIONS` | CORS preflight |
| `/health` | `GET` | Health check — returns `{ "status": "ok", "sessions": <count> }` |

The HTTP transport runs in **session-based mode**. A new MCP session is created on `initialize`, the server returns an `mcp-session-id` header, and subsequent requests for that session must include the same header.

Operational constraints in HTTP mode:

- `POST /mcp` without `mcp-session-id` must be an `initialize` request.
- `POST /mcp`, `GET /mcp`, and `DELETE /mcp` for existing sessions require the `mcp-session-id` header.
- `GET /mcp` is used for SSE notifications (progress updates and elicitation prompts).
- Idle sessions are reaped after 30 minutes.
- `GET /health` is the only non-MCP endpoint.
- Request body size is capped by `HARNESS_MAX_BODY_SIZE_MB` (default `10` MB).

```bash
# Health check
curl http://localhost:3000/health

# MCP initialize request (capture mcp-session-id response header)
curl -i -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# Subsequent MCP request (use returned session ID)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# Terminate session
curl -X DELETE http://localhost:3000/mcp \
  -H "mcp-session-id: <session-id>"
```

### Client Configuration

> **Note:** `HARNESS_DEFAULT_ORG_ID` and `HARNESS_DEFAULT_PROJECT_ID` are optional. Agents can discover orgs and projects dynamically using `harness_list(resource_type="organization")` and `harness_list(resource_type="project")`. Set them only if you want to pin a default scope for convenience.

#### Claude Desktop (`claude_desktop_config.json`)

<details open>
<summary>npx (zero install)</summary>

```json
{
  "mcpServers": {
    "harness": {
      "command": "npx",
      "args": ["harness-mcp-v2"],
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

</details>

<details>
<summary>node (local install)</summary>

```bash
npm install -g harness-mcp-v2
```

```json
{
  "mcpServers": {
    "harness": {
      "command": "harness-mcp-v2",
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

</details>

#### Claude Code (via `claude mcp add`)

<details open>
<summary>npx (zero install)</summary>

```bash
claude mcp add harness -- npx harness-mcp-v2
```

</details>

<details>
<summary>node (local install)</summary>

```bash
npm install -g harness-mcp-v2
claude mcp add harness -- harness-mcp-v2
```

</details>

Then set `HARNESS_API_KEY` in your environment or `.env` file.

#### Cursor (`.cursor/mcp.json`)

<details open>
<summary>npx (zero install)</summary>

```json
{
  "mcpServers": {
    "harness": {
      "command": "npx",
      "args": ["harness-mcp-v2"],
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

</details>

<details>
<summary>node (local install)</summary>

```bash
npm install -g harness-mcp-v2
```

```json
{
  "mcpServers": {
    "harness": {
      "command": "harness-mcp-v2",
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

</details>

#### Windsurf (`~/.windsurf/mcp.json`)

<details open>
<summary>npx (zero install)</summary>

```json
{
  "mcpServers": {
    "harness": {
      "command": "npx",
      "args": ["harness-mcp-v2"],
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

</details>

<details>
<summary>node (local install)</summary>

```bash
npm install -g harness-mcp-v2
```

```json
{
  "mcpServers": {
    "harness": {
      "command": "harness-mcp-v2",
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

</details>

<details>
<summary>Using a local build from source?</summary>

Replace the command with the path to your built `index.js`:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/harness-mcp-v2/build/index.js", "stdio"]
}
```

</details>

### MCP Gateway

The Harness MCP server is fully compatible with MCP Gateways — reverse proxies that provide centralized authentication, governance, tool routing, and observability across multiple MCP servers. Since the server implements the standard MCP protocol with both stdio and HTTP transports, it works behind any MCP-compliant gateway with no code changes.

**Why use a gateway?**
- Centralized credential management — no API keys in agent configs
- Governance & audit logging for all tool calls across teams
- Single endpoint for agents instead of N connections to N MCP servers
- Access control — restrict which teams can use which tools

#### Docker MCP Gateway

Register the server in your Docker MCP Gateway configuration:

```json
{
  "mcpServers": {
    "harness": {
      "command": "npx",
      "args": ["harness-mcp-v2"],
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

#### Portkey

Add the Harness MCP server to your [Portkey MCP Gateway](https://portkey.ai/features/mcp) for enterprise governance, cost tracking, and multi-LLM routing:

```json
{
  "mcpServers": {
    "harness": {
      "command": "npx",
      "args": ["harness-mcp-v2"],
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

#### LiteLLM

Add to your [LiteLLM proxy config](https://docs.litellm.ai/docs/mcp):

```yaml
mcp_servers:
  - name: harness
    command: npx
    args:
      - harness-mcp-v2
    env:
      HARNESS_API_KEY: "pat.xxx.xxx.xxx"
```

#### Envoy AI Gateway

The server works with [Envoy AI Gateway's MCP support](https://aigateway.envoyproxy.io/docs/0.5/capabilities/mcp/) via HTTP transport:

```bash
# Start the server in HTTP mode
HARNESS_API_KEY=pat.xxx.xxx.xxx npx harness-mcp-v2 http --port 8080
```

Then configure Envoy to route to `http://localhost:8080/mcp` as an upstream MCP backend.

#### Kong

Use [Kong's AI MCP Proxy plugin](https://developer.konghq.com/mcp/) to expose the Harness MCP server through your existing Kong gateway infrastructure.

#### Other Gateways

Any gateway that supports the MCP specification (Microsoft MCP Gateway, IBM ContextForge, Cloudflare Workers, etc.) can proxy this server. For **stdio-based** gateways, use the default transport. For **HTTP-based** gateways, start the server with `http` transport and point the gateway at the `/mcp` endpoint.

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

The server automatically loads environment variables from a `.env` file in the project root if one exists. Copy `.env.example` to `.env` and fill in your values. Environment variables can also be set via your shell or MCP client config.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HARNESS_API_KEY` | Yes | -- | Harness personal access token or service account token |
| `HARNESS_ACCOUNT_ID` | No | *(from PAT)* | Harness account identifier. Auto-extracted from PAT tokens; only needed for non-PAT API keys |
| `HARNESS_BASE_URL` | No | `https://app.harness.io` | Base URL (override for self-managed Harness) |
| `HARNESS_FME_BASE_URL` | No | `https://api.split.io` | Base URL for FME/Split.io API. Used by `fme_workspace`, `fme_environment`, and `fme_feature_flag` resources |
| `HARNESS_DEFAULT_ORG_ID` | No | `default` | Default organization identifier. Optional convenience — agents can discover orgs dynamically via `harness_list(resource_type="organization")` |
| `HARNESS_DEFAULT_PROJECT_ID` | No | -- | Default project identifier. Optional convenience — agents can discover projects dynamically via `harness_list(resource_type="project")` |
| `HARNESS_API_TIMEOUT_MS` | No | `30000` | HTTP request timeout in milliseconds |
| `HARNESS_MAX_RETRIES` | No | `3` | Retry count for transient failures (429, 5xx) |
| `HARNESS_MAX_BODY_SIZE_MB` | No | `10` | Max HTTP request body size in MB for `http` transport |
| `HARNESS_RATE_LIMIT_RPS` | No | `10` | Client-side request throttle (requests per second) to Harness APIs |
| `LOG_LEVEL` | No | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |
| `HARNESS_TOOLSETS` | No | *(all)* | Comma-separated list of enabled toolsets (see [Toolset Filtering](#toolset-filtering)) |
| `HARNESS_READ_ONLY` | No | `false` | Block all mutating operations (create, update, delete, execute). Only list and get are allowed. Useful for shared/demo environments |
| `HARNESS_ALLOW_HTTP` | No | `false` | Allow non-HTTPS `HARNESS_BASE_URL`. By default, the server enforces HTTPS for security. Set to `true` only for local development against a non-TLS Harness instance |

### HTTPS Enforcement

`HARNESS_BASE_URL` must use HTTPS by default. If you set a non-HTTPS URL (e.g. `http://localhost:8080`), the server will refuse to start with:

```
HARNESS_BASE_URL must use HTTPS (got "http://..."). If you need HTTP for local development, set HARNESS_ALLOW_HTTP=true.
```

### Audit Logging

All write operations (`harness_create`, `harness_update`, `harness_delete`, `harness_execute`) emit structured audit log entries to stderr. Each entry includes the tool name, resource type, operation, identifiers, and timestamp. This provides an audit trail without requiring external logging infrastructure.

## Tools Reference

The server exposes 11 MCP tools. Most API tools accept `org_id` and `project_id` as optional overrides — if omitted, they fall back to `HARNESS_DEFAULT_ORG_ID` and `HARNESS_DEFAULT_PROJECT_ID`. `harness_describe` is local metadata only and does not use org/project scope.

**URL support:** Most API-facing tools accept a `url` parameter — paste a Harness UI URL and the server auto-extracts org, project, resource type, resource ID, pipeline ID, and execution ID. `harness_describe` and `harness_ask` do not accept `url`.

| Tool | Description |
|------|-------------|
| `harness_describe` | Discover available resource types, operations, and fields. No API call — returns local registry metadata. |
| `harness_list` | List resources of a given type with filtering, search, and pagination. |
| `harness_get` | Get a single resource by its identifier. |
| `harness_create` | Create a new resource. Supports inline and remote (Git-backed) pipelines. Prompts for user confirmation via [elicitation](#elicitation). |
| `harness_update` | Update an existing resource. Supports inline and remote (Git-backed) pipelines. Prompts for user confirmation via [elicitation](#elicitation). |
| `harness_delete` | Delete a resource. Prompts for user confirmation via [elicitation](#elicitation). Destructive. |
| `harness_execute` | Execute an action on a resource (run/retry pipeline, import pipeline from Git, toggle flag, sync app). Prompts for user confirmation via [elicitation](#elicitation). For pipeline runs, use the runtime-input workflow below. |
| `harness_search` | Search across multiple resource types in parallel with a single query. |
| `harness_diagnose` | Diagnose `pipeline`, `connector`, `delegate`, and `gitops_application` resources (aliases: `execution` -> `pipeline`, `gitops_app` -> `gitops_application`). For pipelines, returns stage/step timing and failure details; for connectors/delegates/GitOps apps, returns targeted health and troubleshooting signals. |
| `harness_status` | Get a real-time project health dashboard — recent executions, failure rates, and deep links. |
| `harness_ask` | Ask the Harness AI DevOps Agent to create or update entities (pipelines, environments, connectors, services, secrets) via natural language. Rate limited to 5 requests/minute with burst of 3. Requires `intelligence` toolset. |

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
  "environment": "production"
}
```

**Search across all resource types:**

```json
{ "query": "payment-service" }
```

**Diagnose an execution by ID (summary mode — default):**

```json
{ "execution_id": "abc123XYZ" }
```

**Diagnose from a Harness URL:**

```json
{ "url": "https://app.harness.io/ng/account/.../pipelines/myPipeline/executions/abc123XYZ/pipeline" }
```

**Diagnose connector connectivity:**

```json
{ "resource_type": "connector", "resource_id": "my_github_connector" }
```

**Diagnose delegate health:**

```json
{ "resource_type": "delegate", "resource_id": "delegate-us-east-1" }
```

**Diagnose a GitOps application (with options):**

```json
{
  "resource_type": "gitops_application",
  "resource_id": "checkout-app",
  "options": { "agent_id": "gitops-agent-1" }
}
```

**Get the latest execution report for a pipeline:**

```json
{ "pipeline_id": "my-pipeline" }
```

**Full diagnostic mode with YAML and failed step logs:**

```json
{ "execution_id": "abc123XYZ", "summary": false }
```

**Summary mode with logs enabled (best of both):**

```json
{ "execution_id": "abc123XYZ", "include_logs": true }
```

**Get project health status:**

```json
{ "org_id": "default", "project_id": "my-project", "limit": 5 }
```

### Pipeline Run Workflow (Recommended)

Use this sequence to reduce execution-time input errors:

1. **Discover required runtime inputs**
   - `harness_get(resource_type="runtime_input_template", resource_id="<pipeline_id>")`
   - The returned template shows `<+input>` placeholders that need values.
2. **Choose input strategy**
   - **Simple variables:** pass flat key-value `inputs` (for example `{"branch":"main","env":"prod"}`).
   - **Complex/structural inputs:** use `input_set_ids` (CI codebase/build blocks and nested template inputs are best handled this way).
3. **Execute the run**
   - `harness_execute(resource_type="pipeline", action="run", resource_id="<pipeline_id>", ...)`
4. **Optional: combine both**
   - Use `input_set_ids` for the base shape and `inputs` for simple overrides.

If required fields are unresolved, the tool returns a pre-flight error with expected keys and suggested input sets.

**Ask the AI DevOps Agent to create a pipeline:**

```json
{
  "prompt": "Create a pipeline that builds a Go app with Docker and deploys to Kubernetes",
  "action": "CREATE_PIPELINE"
}
```

**Update a service via natural language:**

```json
{
  "prompt": "Add a sidecar container for logging",
  "action": "UPDATE_SERVICE",
  "conversation_id": "prev-conversation-id",
  "context": [{ "type": "yaml", "payload": "<existing service YAML>" }]
}
```

### Pipeline Storage Modes

Harness pipelines can be stored in three ways:

| Mode | Description | When to use |
|------|-------------|-------------|
| **Inline** | Pipeline YAML stored in Harness | Default. Simplest setup, no Git required. |
| **Remote (External Git)** | Pipeline YAML stored in GitHub, GitLab, Bitbucket, etc. | Teams using Git-backed pipeline-as-code with an external provider. |
| **Remote (Harness Code)** | Pipeline YAML stored in a Harness Code repository | Teams using Harness's built-in Git hosting. |

**Create an inline pipeline (default):**

```json
// harness_create
{
  "resource_type": "pipeline",
  "body": {
    "yamlPipeline": "pipeline:\n  name: My Pipeline\n  identifier: my_pipeline\n  stages:\n    - stage:\n        name: Build\n        type: CI\n        spec:\n          execution:\n            steps:\n              - step:\n                  type: Run\n                  name: Echo\n                  spec:\n                    command: echo hello"
  }
}
```

**Create a remote pipeline (External Git — e.g. GitHub):**

```json
// harness_create
{
  "resource_type": "pipeline",
  "body": {
    "yamlPipeline": "pipeline:\n  name: Deploy Service\n  identifier: deploy_service\n  stages: []"
  },
  "params": {
    "store_type": "REMOTE",
    "connector_ref": "my_github_connector",
    "repo_name": "my-repo",
    "branch": "main",
    "file_path": ".harness/deploy-service.yaml",
    "commit_msg": "Add deploy pipeline via MCP"
  }
}
```

**Create a remote pipeline (Harness Code — no connector needed):**

```json
// harness_create
{
  "resource_type": "pipeline",
  "body": {
    "yamlPipeline": "pipeline:\n  name: Build App\n  identifier: build_app\n  stages: []"
  },
  "params": {
    "store_type": "REMOTE",
    "is_harness_code_repo": true,
    "repo_name": "product-management",
    "branch": "main",
    "file_path": ".harness/build-app.yaml",
    "commit_msg": "Add build pipeline via MCP"
  }
}
```

**Update a remote pipeline:**

```json
// harness_update
{
  "resource_type": "pipeline",
  "resource_id": "deploy_service",
  "body": {
    "yamlPipeline": "pipeline:\n  name: Deploy Service\n  identifier: deploy_service\n  stages:\n    - stage:\n        name: Deploy\n        type: Deployment"
  },
  "params": {
    "store_type": "REMOTE",
    "connector_ref": "my_github_connector",
    "repo_name": "my-repo",
    "branch": "main",
    "file_path": ".harness/deploy-service.yaml",
    "commit_msg": "Update deploy pipeline via MCP",
    "last_object_id": "abc123",
    "last_commit_id": "def456"
  }
}
```

**Import a pipeline from an external Git repo:**

```json
// harness_execute
{
  "resource_type": "pipeline",
  "action": "import",
  "params": {
    "connector_ref": "my_github_connector",
    "repo_name": "my-repo",
    "branch": "main",
    "file_path": ".harness/existing-pipeline.yaml"
  },
  "body": {
    "pipeline_name": "Existing Pipeline",
    "pipeline_description": "Imported from GitHub"
  }
}
```

**Import a pipeline from a Harness Code repo:**

```json
// harness_execute
{
  "resource_type": "pipeline",
  "action": "import",
  "params": {
    "is_harness_code_repo": true,
    "repo_name": "product-management",
    "branch": "main",
    "file_path": ".harness/existing-pipeline.yaml"
  },
  "body": {
    "pipeline_name": "Existing Pipeline"
  }
}
```

**Create a connector:**

```json
{
  "resource_type": "connector",
  "body": { "connector": { "name": "My Docker Hub", "identifier": "my_docker", "type": "DockerRegistry" } }
}
```

**Delete a trigger:**

```json
{
  "resource_type": "trigger",
  "resource_id": "nightly-trigger",
  "pipeline_id": "my-pipeline"
}
```

## Resource Types

126 resource types organized across 29 toolsets. Each resource type supports a subset of CRUD operations and optional execute actions.

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
| `runtime_input_template` | | x | | | | |
| `approval_instance` | x | | | | | `approve`, `reject` |

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
| `repository` | x | x | x | x | | |
| `branch` | x | x | x | | x | |
| `commit` | x | x | | | | `diff`, `diff_stats` |
| `file_content` | | x | | | | `blame` |
| `tag` | x | | x | | x | |
| `repo_rule` | x | x | | | | |
| `space_rule` | x | x | | | | |

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
| `template` | x | x | x | x | x | |

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
| `pull_request` | x | x | x | x | | `merge` |
| `pr_reviewer` | x | | x | | | `submit_review` |
| `pr_comment` | x | | x | | | |
| `pr_check` | x | | | | | |
| `pr_activity` | x | | | | | |

### Feature Flags

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `fme_workspace` | x | | | | | |
| `fme_environment` | x | | | | | |
| `fme_feature_flag` | x | x | | | | |
| `fme_feature_flag_definition` | | x | | | | |
| `feature_flag` | x | x | x | | x | `toggle` |

**FME (Split.io) resources** — `fme_workspace`, `fme_environment`, and `fme_feature_flag` use the Split.io internal API and are scoped by workspace ID rather than org/project. `fme_feature_flag` returns basic flag metadata (name, description, traffic type, tags, rollout status) without requiring an environment. Use `feature_flag` for the Harness CF admin API which supports environment-specific definitions, create, delete, and toggle.

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
| `cost_anomaly_summary` | | x | | | | |
| `cost_category` | x | x | | | | |
| `cost_account_overview` | | x | | | | |
| `cost_filter_value` | x | | | | | |
| `cost_recommendation_stats` | | x | | | | |
| `cost_recommendation_detail` | | x | | | | |
| `cost_commitment` | | x | | | | |

### Software Engineering Insights (SEI)

SEI resources are consolidated for token efficiency. Use `metric` or `aspect` params for DORA, team/org-tree details, and AI insights.

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `sei_metric` | x | | | | | |
| `sei_productivity_metric` | | x | | | | |
| `sei_dora_metric` | | x | | | | Pass `metric`: deployment_frequency, change_failure_rate, mttr, lead_time, or *_drilldown |
| `sei_team` | x | x | | | | |
| `sei_team_detail` | x | | | | | Pass `aspect`: integrations, developers, integration_filters |
| `sei_org_tree` | x | x | | | | |
| `sei_org_tree_detail` | x | x | | | | Pass `aspect`: efficiency_profile, productivity_profile, business_alignment_profile, integrations, teams |
| `sei_business_alignment` | x | x | | | | Pass `aspect`: feature_metrics, feature_summary, drilldown for get |
| `sei_ai_usage` | x | x | | | | Pass `aspect`: metrics, breakdown, summary, top_languages |
| `sei_ai_adoption` | x | x | | | | Pass `aspect`: metrics, breakdown, summary |
| `sei_ai_impact` | | x | | | | Pass `aspect`: pr_velocity, rework |
| `sei_ai_raw_metric` | x | | | | | |

### Software Supply Chain Assurance (SCS)

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `scs_artifact_source` | x | | | | | |
| `artifact_security` | x | x | | | | |
| `scs_artifact_component` | x | | | | | |
| `scs_artifact_remediation` | | x | | | | |
| `scs_chain_of_custody` | | x | | | | |
| `scs_compliance_result` | x | | | | | |
| `code_repo_security` | x | x | | | | |
| `scs_sbom` | | x | | | | |

### Security Testing Orchestration (STO)

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `security_issue` | x | | | | | |
| `security_issue_filter` | x | | | | | |
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

### Governance

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `policy` | x | x | x | x | x | |
| `policy_set` | x | x | x | x | x | |
| `policy_evaluation` | x | x | | | | |

### Deployment Freeze

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `freeze_window` | x | x | x | x | x | `toggle_status` |
| `global_freeze` | | x | | | | `manage` |

### Settings

| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
|---------------|:----:|:---:|:------:|:------:|:------:|-----------------|
| `setting` | x | | | | | |

### Visualizations

Inline PNG chart visualizations rendered from Harness data. These are metadata-only resource types with no API operations — they exist so the LLM can discover available chart types via `harness_describe`. Use `include_visual=true` on supported tools (`harness_diagnose`, `harness_list`, `harness_status`) to generate charts.

| Resource Type | Description | How to Generate |
|---------------|-------------|-----------------|
| `visual_timeline` | Gantt chart of pipeline stage execution over time | `harness_diagnose` with `visual_type: "timeline"` |
| `visual_stage_flow` | DAG flowchart of pipeline stages and steps | `harness_diagnose` with `visual_type: "flow"` |
| `visual_health_dashboard` | Project health overview with status indicators | `harness_status` with `include_visual: true` |
| `visual_pie_chart` | Donut chart of execution status breakdown | `harness_list` with `visual_type: "pie"` |
| `visual_bar_chart` | Bar chart of execution counts by pipeline | `harness_list` with `visual_type: "bar"` |
| `visual_timeseries` | Daily execution trend over 30 days | `harness_list` with `visual_type: "timeseries"` |
| `visual_architecture` | Pipeline YAML architecture diagram (stages → steps) | `harness_diagnose` with `visual_type: "architecture"` |

## MCP Prompts

### DevOps

| Prompt | Description | Parameters |
|--------|-------------|------------|
| `build-deploy-app` | End-to-end CI/CD workflow: scan a git repo, generate CI pipeline (build & push Docker image), discover or generate K8s manifests, create CD pipeline, and deploy — with auto-retry on CI failures (up to 5 attempts) and CD failures (up to 3 attempts with user permission). On exhausted retries, provides Harness UI deep links to all created resources for manual investigation. | `repoUrl` (required), `imageName` (required), `projectId` (optional), `namespace` (optional) |
| `debug-pipeline-failure` | Analyze a failed execution: accepts an execution ID, pipeline ID, or Harness URL. Gets stage/step breakdown, failure details, delegate info, and failed step logs via `harness_diagnose`, then provides root cause analysis and suggested fixes. Automatically follows chained pipeline failures. | `executionId` (optional), `projectId` (optional) |
| `create-pipeline` | Generate a new pipeline YAML from natural language requirements, reviewing existing resources for context | `description` (required), `projectId` (optional) |
| `onboard-service` | Walk through onboarding a new service with environments and a deployment pipeline | `serviceName` (required), `projectId` (optional) |
| `dora-metrics-review` | Review DORA metrics (deployment frequency, change failure rate, MTTR, lead time) with Elite/High/Medium/Low classification and improvement recommendations | `teamRefId` (optional), `dateStart` (optional), `dateEnd` (optional) |
| `setup-gitops-application` | Guide through onboarding a GitOps application — verify agent, cluster, repo, and create the application | `agentId` (required), `projectId` (optional) |
| `chaos-resilience-test` | Design a chaos experiment to test service resilience with fault injection, probes, and expected outcomes | `serviceName` (required), `projectId` (optional) |
| `feature-flag-rollout` | Plan and execute a progressive feature flag rollout across environments with safety gates | `flagIdentifier` (required), `projectId` (optional) |
| `migrate-pipeline-to-template` | Analyze an existing pipeline and extract reusable stage/step templates from it | `pipelineId` (required), `projectId` (optional) |
| `delegate-health-check` | Check delegate connectivity, health, token status, and troubleshoot infrastructure issues | `projectId` (optional) |
| `developer-portal-scorecard` | Review IDP scorecards for services and identify gaps to improve developer experience | `projectId` (optional) |
| `pending-approvals` | Find pipeline executions waiting for approval, show details, and offer to approve or reject | `projectId` (optional), `orgId` (optional), `pipelineId` (optional) |

### FinOps

| Prompt | Description | Parameters |
|--------|-------------|------------|
| `optimize-costs` | Analyze cloud cost data, surface recommendations and anomalies, prioritized by potential savings | `projectId` (optional) |
| `cloud-cost-breakdown` | Deep-dive into cloud costs by service, environment, or cluster with trend analysis and anomaly detection | `perspectiveId` (optional), `projectId` (optional) |
| `commitment-utilization-review` | Analyze reserved instance and savings plan utilization to find waste and optimize commitments | `projectId` (optional) |
| `cost-anomaly-investigation` | Investigate cost anomalies — determine root cause, impacted resources, and remediation | `projectId` (optional) |
| `rightsizing-recommendations` | Review and prioritize rightsizing recommendations, optionally create Jira or ServiceNow tickets | `projectId` (optional), `minSavings` (optional) |

### DevSecOps

| Prompt | Description | Parameters |
|--------|-------------|------------|
| `security-review` | Review security issues across Harness resources and suggest remediations by severity | `projectId` (optional), `severity` (optional, default: `critical,high`) |
| `vulnerability-triage` | Triage security vulnerabilities across pipelines and artifacts, prioritize by severity and exploitability | `projectId` (optional), `severity` (optional) |
| `sbom-compliance-check` | Audit SBOM and compliance posture for artifacts — license risks, policy violations, component vulnerabilities | `artifactId` (optional), `projectId` (optional) |
| `supply-chain-audit` | End-to-end software supply chain security audit — provenance, chain of custody, policy compliance | `projectId` (optional) |
| `security-exemption-review` | Review pending security exemptions and make batch approval or rejection decisions | `projectId` (optional) |
| `access-control-audit` | Audit user permissions, over-privileged accounts, and role assignments to enforce least-privilege | `projectId` (optional), `orgId` (optional) |

### Harness Code

| Prompt | Description | Parameters |
|--------|-------------|------------|
| `code-review` | Review a pull request — analyze diff, commits, checks, and comments to provide structured feedback on bugs, security, performance, and style | `repoId` (required), `prNumber` (required), `projectId` (optional) |
| `pr-summary` | Auto-generate a PR title and description from the commit history and diff of a branch | `repoId` (required), `sourceBranch` (required), `targetBranch` (optional, default: main), `projectId` (optional) |
| `branch-cleanup` | Analyze branches in a repository and recommend stale or merged branches to delete | `repoId` (required), `projectId` (optional) |

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

By default, all 29 toolsets (and their 126 resource types) are enabled. Use `HARNESS_TOOLSETS` to expose only the toolsets you need. This reduces the resource types the LLM sees, improving tool selection accuracy.

```bash
# Only expose pipelines, services, and connectors
HARNESS_TOOLSETS=pipelines,services,connectors
```

Available toolset names:

| Toolset | Resource Types |
|---------|---------------|
| `platform` | organization, project |
| `pipelines` | pipeline, execution, trigger, pipeline_summary, input_set, approval_instance |
| `services` | service |
| `environments` | environment |
| `connectors` | connector, connector_catalogue |
| `infrastructure` | infrastructure |
| `secrets` | secret |
| `logs` | execution_log |
| `audit` | audit_event |
| `delegates` | delegate, delegate_token |
| `repositories` | repository, branch, commit, file_content, tag, repo_rule, space_rule |
| `registries` | registry, artifact, artifact_version, artifact_file |
| `templates` | template |
| `dashboards` | dashboard, dashboard_data |
| `idp` | idp_entity, scorecard, scorecard_check, scorecard_stats, scorecard_check_stats, idp_score, idp_workflow, idp_tech_doc |
| `pull-requests` | pull_request, pr_reviewer, pr_comment, pr_check, pr_activity |
| `feature-flags` | fme_workspace, fme_environment, fme_feature_flag, fme_feature_flag_definition, feature_flag |
| `gitops` | gitops_agent, gitops_application, gitops_cluster, gitops_repository, gitops_applicationset, gitops_repo_credential, gitops_app_event, gitops_pod_log, gitops_managed_resource, gitops_resource_action, gitops_dashboard, gitops_app_resource_tree |
| `chaos` | chaos_experiment, chaos_probe, chaos_experiment_template, chaos_infrastructure, chaos_experiment_variable, chaos_experiment_run, chaos_loadtest |
| `ccm` | cost_perspective, cost_breakdown, cost_timeseries, cost_summary, cost_recommendation, cost_anomaly, cost_anomaly_summary, cost_category, cost_account_overview, cost_filter_value, cost_recommendation_stats, cost_recommendation_detail, cost_commitment |
| `sei` | sei_metric, sei_productivity_metric, sei_dora_metric, sei_team, sei_team_detail, sei_org_tree, sei_org_tree_detail, sei_business_alignment, sei_ai_usage, sei_ai_adoption, sei_ai_impact, sei_ai_raw_metric |
| `scs` | scs_artifact_source, artifact_security, scs_artifact_component, scs_artifact_remediation, scs_chain_of_custody, scs_compliance_result, code_repo_security, scs_sbom |
| `sto` | security_issue, security_issue_filter, security_exemption |
| `access_control` | user, user_group, service_account, role, role_assignment, resource_group, permission |
| `governance` | policy, policy_set, policy_evaluation |
| `freeze` | freeze_window, global_freeze |
| `settings` | setting |
| `intelligence` | *(standalone `harness_ask` tool — no registry resource types)* |
| `visualizations` | visual_timeline, visual_stage_flow, visual_health_dashboard, visual_pie_chart, visual_bar_chart, visual_timeseries, visual_architecture |

`harness_ask` is only registered when:
- `HARNESS_READ_ONLY=false`, and
- `HARNESS_TOOLSETS` is unset or includes `intelligence`.

## Architecture

```
                 +------------------+
                 |   AI Agent       |
                 |  (Claude, etc.)  |
                 +--------+---------+
                          |  MCP (stdio or HTTP)
                 +--------v---------+
                |    MCP Server     |
                | 11 Generic Tools  |
                 +--------+---------+
                          |
                 +--------v---------+
                |    Registry       |  <-- Declarative resource definitions
                |  28 Toolsets      |      (data files, not code)
                |  124 Resource Types|
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
  tools/                            # 11 generic MCP tools
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
    harness-ask.ts
  resources/                        # MCP resource providers
    pipeline-yaml.ts
    execution-summary.ts
  prompts/                          # MCP prompt templates
    build-deploy-app.ts             # DevOps: end-to-end build & deploy workflow
    debug-pipeline.ts               # DevOps: debug failed executions
    create-pipeline.ts              # DevOps: generate pipeline from requirements
    onboard-service.ts              # DevOps: onboard new service
    dora-metrics.ts                 # DevOps: DORA metrics review
    setup-gitops.ts                 # DevOps: GitOps application setup
    chaos-resilience.ts             # DevOps: chaos experiment design
    feature-flag-rollout.ts         # DevOps: progressive flag rollout
    migrate-to-template.ts          # DevOps: extract templates from pipeline
    delegate-health.ts              # DevOps: delegate health check
    developer-scorecard.ts          # DevOps: IDP scorecard review
    optimize-costs.ts               # FinOps: cost optimization
    cloud-cost-breakdown.ts         # FinOps: cost deep-dive
    commitment-utilization.ts       # FinOps: RI/savings plan analysis
    cost-anomaly.ts                 # FinOps: anomaly investigation
    rightsizing.ts                  # FinOps: rightsizing recommendations
    security-review.ts              # DevSecOps: security issue review
    vulnerability-triage.ts         # DevSecOps: vulnerability triage
    sbom-compliance.ts              # DevSecOps: SBOM compliance audit
    supply-chain-audit.ts           # DevSecOps: supply chain audit
    exemption-review.ts             # DevSecOps: exemption approval
    access-control-audit.ts         # DevSecOps: access control audit
    code-review.ts                  # Harness Code: PR code review
    pr-summary.ts                   # Harness Code: auto-generate PR summary
    branch-cleanup.ts               # Harness Code: stale branch cleanup
    pending-approvals.ts            # Approvals: find and act on pending approvals
  utils/
    cli.ts                          # CLI arg parsing (transport, port)
    errors.ts                       # Error normalization
    logger.ts                       # stderr-only logger
    progress.ts                     # MCP progress & logging notifications
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

## Elicitation

Write tools (`harness_create`, `harness_update`, `harness_delete`, `harness_execute`) use [MCP elicitation](https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/elicitation) to prompt the user for confirmation before making changes. This gives real human-in-the-loop approval — the user sees what's about to happen and accepts or declines.

**How it works:**

1. The LLM calls a write tool (e.g. `harness_create` with a pipeline body)
2. The server sends an elicitation request to the client with a summary of the operation
3. The user sees the details and clicks **Accept** or **Decline**
4. If accepted, the operation proceeds. If declined, it's blocked and the LLM is told

**Client support:**

| Client | Elicitation Support |
|--------|-------------------|
| Cursor | Yes |
| VS Code (Copilot) | Yes |
| Claude Desktop | Not yet |
| Windsurf | Not yet |
| MCP Inspector | Yes |

Elicitation behavior varies by operation severity when client support is missing:
For clients that don't support elicitation:

- `harness_create`, `harness_update`, and `harness_execute` proceed without a dialog (best effort).
- Destructive operations are blocked if confirmation cannot be obtained (`harness_delete`).

If elicitation fails at runtime, the same rules apply: non-destructive writes continue, destructive writes are blocked.

## Safety

- **Secrets are never exposed.** The `secret` resource type returns metadata only (name, type, scope) — secret values are never included in any response.
- **Write operations use elicitation when available.** `harness_create`, `harness_update`, `harness_delete`, and `harness_execute` attempt MCP elicitation before proceeding (see [Elicitation](#elicitation)).
- **Destructive writes fail closed.** If confirmation cannot be obtained, `harness_delete` is blocked instead of executing blindly.
- **CORS restricted to same-origin.** The HTTP transport only allows same-origin requests, preventing CSRF attacks from malicious websites targeting the MCP server on localhost.
- **HTTP rate limiting.** The HTTP transport enforces 60 requests per minute per IP to prevent request flooding.
- **API rate limiting.** The Harness API client enforces a 10 requests/second limit to avoid hitting upstream rate limits.
- **AI agent rate limiting.** The `harness_ask` tool is rate limited to 5 requests/minute with a burst of 3. Each call triggers LLM inference on the Harness backend, so this prevents runaway token costs from agent loops or abuse.
- **Pagination bounds enforced.** List queries are capped at 10,000 items total and 100 per page to prevent memory exhaustion.
- **Retries with backoff.** Transient failures (HTTP 429, 5xx) are retried with exponential backoff and jitter.
- **Localhost binding.** The HTTP transport binds to `127.0.0.1` by default — not accessible from the network.
- **No stdout logging.** All logs go to stderr to avoid corrupting the stdio JSON-RPC transport.

## Complementary Skills

The Harness MCP server pairs well with **[Harness Skills](https://github.com/thisrohangupta/harness-skills)** — a collection of ready-made Claude Code skills (slash commands) designed for common Harness workflows. Install them alongside this MCP server to get high-level automation like `/deploy`, `/rollback`, `/triage`, and more without writing custom prompts.

## Troubleshooting & Common Pitfalls

| Symptom | Likely Cause | What to Do |
|---------|--------------|------------|
| `HARNESS_ACCOUNT_ID is required when the API key is not a PAT...` | API key is not in PAT format (`pat.<accountId>.<tokenId>.<secret>`) so account ID cannot be inferred | Set `HARNESS_ACCOUNT_ID` explicitly |
| `Unknown transport: "..."` on startup | Unsupported CLI transport arg | Use `stdio` or `http` only |
| `Invalid HARNESS_TOOLSETS: ...` on startup | One or more toolset names are not recognized | Use only names from [Toolset Filtering](#toolset-filtering) (exact match) |
| `Unknown tool "harness_ask"` in MCP client | `HARNESS_READ_ONLY=true` or `HARNESS_TOOLSETS` excludes `intelligence` | Disable read-only mode for mutating/AI agent operations, and include `intelligence` in `HARNESS_TOOLSETS` |
| HTTP `mcp-session-id header is required...` | A session request was sent without session header | Send `initialize` first, then include `mcp-session-id` on `POST/GET/DELETE /mcp` |
| HTTP `Session not found...` | Session expired (30 min idle TTL) or already closed | Re-run `initialize` to create a new session, then retry with new header |
| HTTP `405 Method Not Allowed` on `/mcp` | Unsupported method for MCP endpoint | Use `POST`, `GET`, `DELETE`, or `OPTIONS` only |
| HTTP `Invalid request` | Invalid JSON body or request body exceeded `HARNESS_MAX_BODY_SIZE_MB` | Validate JSON payload size/shape; increase `HARNESS_MAX_BODY_SIZE_MB` if needed |
| `Unknown resource_type "..."` from tools | Resource type is misspelled or filtered out via `HARNESS_TOOLSETS` | Call `harness_describe` (with optional `search_term`) to discover valid types |
| `Missing required field "... for path parameter ..."` | A project/org scoped call is missing identifiers | Set `HARNESS_DEFAULT_ORG_ID`/`HARNESS_DEFAULT_PROJECT_ID` or pass `org_id`/`project_id` per tool call |
| `Read-only mode is enabled ... operations are not allowed` | `HARNESS_READ_ONLY=true` blocks create/update/delete/execute | Set `HARNESS_READ_ONLY=false` if write operations are intended |
| Pipeline run fails pre-flight with unresolved required inputs | Provided `inputs` did not cover required runtime placeholders | Fetch `runtime_input_template`, supply missing simple keys, or use `input_set_ids` for structural inputs |
| `Operation declined by user` | User declined the elicitation confirmation dialog | The user chose not to proceed — verify the operation details and retry if intended |
| `body.template_yaml (or body.yaml) is required` for template create/update | Template APIs expect full YAML payload | Provide full `template_yaml` string in `body`; for deletes, pass `version_label` to delete one version (omit to delete all versions) |
| `HARNESS_BASE_URL must use HTTPS` on startup | `HARNESS_BASE_URL` is set to an HTTP URL | Use HTTPS, or set `HARNESS_ALLOW_HTTP=true` for local development |

## License

Apache 2.0
