## Harness MCP Server 2.0

An MCP (Model Context Protocol) server that gives AI agents full access to the Harness.io platform through 11 consolidated tools and 203 resource types.

## Why Use This MCP Server

Most MCP servers map one tool per API endpoint. For a platform as broad as Harness, that means 240+ tools — and LLMs get worse at tool selection as the count grows. Context windows fill up with schemas, and every new endpoint means new code.

This server is built differently:

- **11 tools, 203 resource types.** A registry-based dispatch system routes `harness_list`, `harness_get`, `harness_create`, etc. to any Harness resource — pipelines, services, environments, orgs, projects, feature flags, cost data, and more. The LLM picks from 11 tools instead of hundreds.
- **Full platform coverage.** 33 default toolsets spanning CI/CD, GitOps, Feature Flags, Cloud Cost Management, Security Testing, Chaos Engineering, Database DevOps, Internal Developer Portal, Software Supply Chain, Infrastructure as Code Management, Governance, Service Overrides, Visualizations, and more. Opt-in Ansible coverage is available when you need inventory and playbook data.
- **Multi-project workflows out of the box.** Agents discover organizations and projects dynamically — no hardcoded env vars needed. Ask "show failed executions across all projects" and the agent can navigate the full account hierarchy.
- **32 prompt templates.** Pre-built prompts for common workflows: build & deploy apps end-to-end, debug failed pipelines, review DORA metrics, triage vulnerabilities, optimize cloud costs, audit access control, plan feature flag rollouts, review pull requests, approve pending pipelines, and more.
- **Works everywhere.** Stdio transport for local clients (Claude Desktop, Cursor, Windsurf), HTTP transport for remote/shared deployments, Docker and Kubernetes ready.
- **Zero-config start.** Just provide a Harness API key. Account ID is auto-extracted from PAT and SAT tokens, org/project defaults are optional, and toolset filtering lets you expose only what you need.
- **Extensible by design.** Adding a new Harness resource means adding a declarative data file — no new tool registration, no schema changes, no prompt updates.

## Prerequisites

Before installing or running the server, you need a Harness API key:

1. Log in to your [Harness account](https://app.harness.io)
2. Go to **My Profile** → **API Keys** → **+ New API Key**
3. Create a new **Token** under the API key — this generates a PAT or SAT in the format `<prefix>.<accountId>.<tokenId>.<secret>`
4. Save the token somewhere secure — you'll need it in the next step

> For detailed instructions, see the [Harness API Quickstart](https://developer.harness.io/docs/platform/automation/api/api-quickstart/).

## Quick Start

### Option 0: Hosted Harness MCP

If your Harness account has the hosted MCP service enabled, clients that support remote MCP servers can connect directly to the managed endpoint instead of running the server locally.

> **Important:** The hosted MCP service uses **Harness Platform OAuth**, not `HARNESS_API_KEY`. It must also be enabled/configured per account by **Harness Support** before the endpoint can be used.

See [Hosted Harness MCP](#hosted-harness-mcp) for configuration examples.

### Option 1: npx (Recommended)

No install required — just run it:

```bash
HARNESS_API_KEY=pat.xxx.xxx.xxx npx harness-mcp-v2@latest
```

Or configure the API key in your AI client (see [Client Configuration](#client-configuration) below).

```bash
# Stdio transport (default — for Claude Desktop, Cursor, Windsurf, etc.)
HARNESS_API_KEY=pat.xxx npx harness-mcp-v2

# HTTP transport (for remote/shared deployments)
HARNESS_API_KEY=pat.xxx npx harness-mcp-v2 http --port 8080
```

> **Note:** The account ID is auto-extracted from PAT and SAT tokens (`pat.<accountId>...` or `sat.<accountId>...`), so `HARNESS_ACCOUNT_ID` is only needed for API keys without an embedded account segment.

### Option 2: Global Install

```bash
npm install -g harness-mcp-v2

# Then run directly
harness-mcp-v2
```

### Option 3: Build from Source

For development or customization:

```bash
git clone https://github.com/harness/mcp-server.git
cd mcp-server
pnpm install
pnpm build

# Run
pnpm start              # Stdio transport
pnpm start:http         # HTTP transport
pnpm inspect            # Test with MCP Inspector
```

### Anthropic MCP Directory bundle

The MCPB bundle manifest lives in `[mcp-directory/](mcp-directory/)`, and the bundle icon is tracked at `[icon.png](icon.png)` in the repository root. Copy `mcp-directory/manifest.json` to the bundle root after `pnpm build` so the generated archive contains root-level `manifest.json`, `icon.png`, `build/`, `package.json`, and production `node_modules/`.

To keep the archive small, build MCPB packages from a staging directory:

```bash
pnpm prepare:mcpb
```

The staged package is written to `dist/mcpb/` with production dependencies installed using npm's flat layout.

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


| Endpoint  | Method    | Description                                                      |
| --------- | --------- | ---------------------------------------------------------------- |
| `/mcp`    | `POST`    | MCP JSON-RPC endpoint (initialize + session requests)            |
| `/mcp`    | `GET`     | SSE stream for server-initiated messages (progress, elicitation) |
| `/mcp`    | `DELETE`  | Terminate an active MCP session                                  |
| `/mcp`    | `OPTIONS` | CORS preflight                                                   |
| `/health` | `GET`     | Health check — returns `{ "status": "ok", "sessions": <count> }` |


The HTTP transport runs in **session-based mode**. A new MCP session is created on `initialize`, the server returns an `mcp-session-id` header, and subsequent requests for that session must include the same header.

Operational constraints in HTTP mode:

- Set `HARNESS_MCP_AUTH_TOKEN` for any shared or remotely reachable deployment. When set, every `POST`, `GET`, and `DELETE` request to `/mcp` must include `Authorization: Bearer <token>`.
- Non-loopback binds require `HARNESS_MCP_AUTH_TOKEN` by default. To run unauthenticated on a non-loopback interface anyway, set `HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP=true` explicitly.
- `POST /mcp` without `mcp-session-id` must be an `initialize` request.
- `POST /mcp`, `GET /mcp`, and `DELETE /mcp` for existing sessions require the `mcp-session-id` header.
- `GET /mcp` is used for SSE notifications (progress updates and elicitation prompts).
- Idle sessions are reaped after 30 minutes.
- `GET /health` is the only non-MCP endpoint.
- Request body size is capped by `HARNESS_MAX_BODY_SIZE_MB` (default `10` MB).
- Set `x-harness-pipeline-version: 0` or `1` on the `initialize` request to select V0 or V1 pipeline resources for that HTTP session.
- Set `x-harness-auto-approve-risk: none|low_write|medium_write|high_write|all` on the `initialize` request to choose a stricter per-session auto-approval threshold. The server caps this value at the deployment-level `HARNESS_AUTO_APPROVE_RISK`, so a session can reduce but not expand the configured approval ceiling.

#### Multi-User Mode

Set `HARNESS_MCP_MODE=multi-user` for shared HTTP deployments where each client authenticates as a different Harness user. In this mode:

- `HARNESS_API_KEY` must **not** be set in the server config — the server holds no Harness credentials.
- Each session must provide `x-harness-api-key` on the `initialize` request. `x-harness-account-id` is required only when the API key does not embed an account segment.
- Sessions may also provide `x-harness-org` and `x-harness-project` headers to set default scope for that session.
- The Harness API key flows through to every Harness API call for that session, so the audit trail in Harness reflects the real user.
- `HARNESS_MCP_AUTH_TOKEN` is independent and can still be used as an additional transport-layer gate.

```bash
# Health check
curl http://localhost:3000/health

# MCP initialize request (capture mcp-session-id response header)
# In multi-user mode, x-harness-api-key is required on initialize.
# x-harness-account-id is needed only for API keys without an embedded account segment.
curl -i -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $HARNESS_MCP_AUTH_TOKEN" \
  -H "x-harness-api-key: $HARNESS_API_KEY" \
  -H "x-harness-account-id: $HARNESS_ACCOUNT_ID" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# Subsequent MCP request (use returned session ID)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $HARNESS_MCP_AUTH_TOKEN" \
  -H "mcp-session-id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# Terminate session
curl -X DELETE http://localhost:3000/mcp \
  -H "Authorization: Bearer $HARNESS_MCP_AUTH_TOKEN" \
  -H "mcp-session-id: <session-id>"
```

`HARNESS_MCP_ALLOWED_HOSTS` controls Host-header validation for DNS-rebinding protection, and CORS limits browser origins. Neither is authentication; use `HARNESS_MCP_AUTH_TOKEN` or an authenticated gateway/reverse proxy for access control.

### Client Configuration

> **Note:** `HARNESS_ORG` and `HARNESS_PROJECT` are optional. They set the org ID and project ID used when not specified per tool call. Agents can discover orgs and projects dynamically using `harness_list(resource_type="organization")` and `harness_list(resource_type="project")`. The deprecated names `HARNESS_DEFAULT_ORG_ID` and `HARNESS_DEFAULT_PROJECT_ID` are still accepted for backward compatibility.

#### Hosted Harness MCP

Harness also supports a hosted MCP endpoint for accounts that have the managed service enabled. This is useful when you want a shared remote MCP endpoint instead of running `npx harness-mcp-v2` or self-hosting the HTTP transport yourself.

> **Important:** Hosted MCP authentication uses **Harness Platform OAuth**. It does **not** use `HARNESS_API_KEY` in the client config. Hosted MCP availability is configured per Harness account, so you will need to work with **Harness Support** to enable/configure the setting before using it.
>
> The hosted endpoint `https://mcp.harness.io/mcp` is a managed service. Client-side MCP config in Claude, Cursor, or Cowork cannot override which Harness environment it routes to. For Harness0 or another private Harness SaaS environment, ask Harness Support to enable/configure hosted MCP for that environment, or run the local/self-hosted server and set `HARNESS_BASE_URL` to the target Harness host.

**Hosted MCP example:**

```json
{
  "mcpServers": {
    "harness-prod1-mcp": {
      "url": "https://mcp.harness.io/mcp",
      "auth": {
        "CLIENT_ID": "mcp-client"
      }
    }
  }
}
```

**Example with both hosted and local entries:**

```json
{
  "mcpServers": {
    "harness-hosted": {
      "url": "https://mcp.harness.io/mcp",
      "auth": {
        "CLIENT_ID": "mcp-client"
      }
    },
    "harness-local": {
      "command": "npx",
      "args": ["harness-mcp-v2"],
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx"
      }
    }
  }
}
```

> **Troubleshooting `npx ENOENT` or `node: No such file or directory`**
>
> GUI apps (Cursor, Claude Desktop, Windsurf, VS Code) don't inherit your shell's `PATH`, so they often can't find `npx` or `node`. Fix this by using absolute paths and explicitly setting `PATH` in the `env` block:
>
> ```json
> {
>   "mcpServers": {
>     "harness": {
>       "command": "/absolute/path/to/npx",
>       "args": ["-y", "harness-mcp-v2"],
>       "env": {
>         "HARNESS_API_KEY": "pat.xxx.xxx.xxx",
>         "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
>       }
>     }
>   }
> }
> ```
>
> Find your paths with `which npx` and `which node` in a terminal, then make sure the directory containing `node` is included in the `PATH` value above. Common locations:
>
> - **Homebrew (macOS):** `/opt/homebrew/bin/npx`
> - **nvm:** `~/.nvm/versions/node/v20.x.x/bin/npx` (run `nvm which current` to find the exact path)
> - **System Node:** `/usr/local/bin/npx`

#### Claude Desktop (`claude_desktop_config.json`)

npx (zero install)

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

node (local install)

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

#### Claude Code (via `claude mcp add`)

npx (zero install)

```bash
claude mcp add harness -- npx harness-mcp-v2
```

node (local install)

```bash
npm install -g harness-mcp-v2
claude mcp add harness -- harness-mcp-v2
```

Then set `HARNESS_API_KEY` in your environment or `.env` file.

#### Cursor (`.cursor/mcp.json`)

npx (zero install)

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

node (local install)

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

#### Windsurf (`~/.windsurf/mcp.json`)

npx (zero install)

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

node (local install)

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

Using a local build from source?

Replace the command with the path to your built `index.js`:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/harness-mcp-v2/build/index.js", "stdio"]
}
```

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


| Variable                    | Required | Default                     | Description                                                                                                                                                                                                                                           |
| --------------------------- | -------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HARNESS_MCP_MODE`          | No       | `single-user`               | Deployment mode: `single-user` (API key in config, used for all sessions) or `multi-user` (HTTP only, per-session credentials via `x-harness-api-key` and optional `x-harness-account-id` headers)                                                   |
| `HARNESS_API_KEY`           | Yes*     | --                          | Harness personal access token or service account token. Required in `single-user` mode. Must NOT be set in `multi-user` mode                                                                                                                          |
| `HARNESS_ACCOUNT_ID`        | No       | *(from PAT/SAT)*            | Harness account identifier. Auto-extracted from PAT/SAT tokens in single-user mode; multi-user sessions can provide their own via `x-harness-account-id` when the API key does not embed one                                                          |
| `HARNESS_BASE_URL`          | No       | `https://app.harness.io`    | Harness API/UI base URL for local stdio or self-hosted HTTP deployments. Set this to environments such as `https://harness0.harness.io` when running the server yourself. It does not affect the managed `https://mcp.harness.io/mcp` hosted endpoint |
| `HARNESS_ORG`               | No       | --                          | Organization ID. Used when `org_id` is not specified per tool call. If omitted, `org_id` must be provided explicitly. Agents can also discover orgs dynamically via `harness_list(resource_type="organization")`                                      |
| `HARNESS_PROJECT`           | No       | --                          | Project ID. Used when `project_id` is not specified per tool call. Agents can also discover projects dynamically via `harness_list(resource_type="project")`                                                                                          |
| `HARNESS_API_TIMEOUT_MS`    | No       | `30000`                     | HTTP request timeout in milliseconds                                                                                                                                                                                                                  |
| `HARNESS_MAX_RETRIES`       | No       | `3`                         | Retry count for transient failures (429, 5xx)                                                                                                                                                                                                         |
| `HARNESS_MAX_BODY_SIZE_MB`  | No       | `10`                        | Max HTTP request body size in MB for `http` transport                                                                                                                                                                                                 |
| `HARNESS_RATE_LIMIT_RPS`    | No       | `10`                        | Client-side request throttle (requests per second) to Harness APIs                                                                                                                                                                                    |
| `LOG_LEVEL`                 | No       | `info`                      | Log verbosity: `debug`, `info`, `warn`, `error`                                                                                                                                                                                                       |
| `HARNESS_TOOLSETS`          | No       | *(defaults)*                | Comma-separated toolset list. Empty loads default toolsets. Supports `+name` to explicitly include opt-in toolsets and `-name` to remove defaults (see [Toolset Filtering](#toolset-filtering))                                                       |
| `HARNESS_READ_ONLY`         | No       | `false`                     | Block all mutating operations (create, update, delete, execute). Only list and get are allowed. Useful for shared/demo environments                                                                                                                   |
| `HARNESS_AUTO_APPROVE_RISK` | No       | `none`                      | Risk-based auto-approve threshold for autonomous workflows. Operations at or below this risk proceed without confirmation. Values: `none`, `low_write`, `medium_write`, `high_write`, `all`. See [Elicitation](#elicitation)                          |
| `HARNESS_SKIP_ELICITATION`  | No       | `false`                     | **Deprecated** — use `HARNESS_AUTO_APPROVE_RISK=all` instead. Kept for backward compatibility                                                                                                                                                         |
| `HARNESS_ALLOW_HTTP`        | No       | `false`                     | Allow non-HTTPS `HARNESS_BASE_URL`. By default, the server enforces HTTPS for security. Set to `true` only for local development against a non-TLS Harness instance                                                                                   |
| `HARNESS_PIPELINE_VERSION`  | No       | `0`                         | **(Alpha)** Pipeline YAML version. `0` loads the `pipeline` resource type and excludes `pipeline_v1`; `1` loads `pipeline_v1` and excludes `pipeline`. HTTP sessions can override this at initialize time with `x-harness-pipeline-version: 0` or `1` |
| `HARNESS_MCP_ALLOWED_HOSTS` | No       | --                          | Comma-separated hostnames allowed by HTTP transport Host-header validation. `mcp.harness.io` is allowed by default for localhost binds; add proxy/custom domains here                                                                                 |
| `HARNESS_MCP_AUTH_TOKEN`    | No       | --                          | Bearer token required on `/mcp` HTTP routes when set. Required by default when HTTP transport binds to a non-loopback host                                                                                                                             |
| `HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP` | No | `false`         | Explicitly allow unauthenticated HTTP transport on non-loopback binds. Use only behind another authenticated control                                                                                                                                    |
| `HARNESS_MCP_LOG_FILE`      | No       | `~/.claude/harness-mcp.log` | File used for stdio disconnect/crash diagnostics when stderr may no longer be available                                                                                                                                                               |
| `HARNESS_AUDIT_FILE`        | No       | --                          | Append audit events to a newline-delimited JSON file in addition to stderr                                                                                                                                                                             |
| `HARNESS_AUDIT_WEBHOOK_URL` | No       | --                          | HTTPS endpoint that receives batched audit events. HTTP URLs require `HARNESS_ALLOW_HTTP=true` for local development                                                                                                                                   |
| `HARNESS_AUDIT_WEBHOOK_TOKEN` | No     | --                          | Optional bearer token sent to the audit webhook                                                                                                                                                                                                        |
| `HARNESS_AUDIT_WEBHOOK_BATCH_SIZE` | No | `10`                       | Number of audit events to batch before webhook flush                                                                                                                                                                                                   |
| `HARNESS_AUDIT_WEBHOOK_FLUSH_MS` | No  | `5000`                     | Max time to hold audit events before webhook flush                                                                                                                                                                                                     |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No     | --                          | Enables OpenTelemetry audit spans when the optional OpenTelemetry packages are installed                                                                                                                                                               |


### HTTPS Enforcement

`HARNESS_BASE_URL` must use HTTPS by default. If you set a non-HTTPS URL (e.g. `http://localhost:8080`), the server will refuse to start with:

```
HARNESS_BASE_URL must use HTTPS (got "http://..."). If you need HTTP for local development, set HARNESS_ALLOW_HTTP=true.
```

### Audit Logging

All write operations (`harness_create`, `harness_update`, `harness_delete`, `harness_execute`) emit structured audit events. The stderr sink is always active; additional sinks are enabled by configuration:

- `HARNESS_AUDIT_FILE` appends newline-delimited JSON events for local collection.
- `HARNESS_AUDIT_WEBHOOK_URL` posts batched events to an HTTPS webhook, optionally with `HARNESS_AUDIT_WEBHOOK_TOKEN`.
- `OTEL_EXPORTER_OTLP_ENDPOINT` enables audit spans when the optional OpenTelemetry packages are installed.

Each event includes the tool name, resource type, operation, identifiers, timestamp, and confirmation method. Audit sinks are best-effort telemetry; a webhook delivery issue is logged and does not retry or replay the mutating Harness operation.

## Tools Reference

The server exposes 11 MCP tools. Most API tools accept `org_id` and `project_id` as optional overrides — if omitted, they fall back to `HARNESS_ORG` and `HARNESS_PROJECT`. `harness_describe` is local metadata only and does not use org/project scope.

**URL support:** Most API-facing tools accept a `url` parameter — paste a Harness UI URL and the server auto-extracts org, project, resource type, resource ID, pipeline ID, and execution ID. `harness_describe` does not accept `url`.

**Scope support:** Resource types with account/org/project variants expose `supportedScopes` in `harness_describe`. Pass `resource_scope` when you need a specific level:

- `resource_scope: "account"` sends only `accountIdentifier`.
- `resource_scope: "org"` sends `accountIdentifier` and `orgIdentifier`.
- `resource_scope: "project"` sends account, org, and project identifiers.

Current multi-scope resources include `connector`, `service`, `environment`, `infrastructure`, `secret`, and `template`. If `resource_scope` is omitted, the registry uses the resource's default scope and configured defaults, except resources marked as optional scope may omit org/project unless explicitly passed. Harness URLs can also set the scope automatically when the path contains account-level or project-level context.

**Structured output:** Every tool declares an MCP `outputSchema`. `harness_list` normalizes list-like Harness responses into object-shaped structured content so strict clients can validate it: top-level arrays become `{ "items": [...], "total": <count>, "page": <page> }`, and common wrapper keys such as `content`, `data`, `body`, `objects`, or `features` are hoisted to `items` when needed. The text response still contains the compact JSON payload returned to all clients.


| Tool               | Description                                                                                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `harness_describe` | Discover available resource types, operations, and fields. No API call — returns local registry metadata.                                                                                                                                                                                                             |
| `harness_schema`   | Fetch exact JSON Schema definitions for creating/updating resources. Supports deep drilling via `path` parameter.                                                                                                                                                                                                     |
| `harness_list`     | List resources of a given type with filtering, search, and pagination.                                                                                                                                                                                                                                                |
| `harness_get`      | Get a single resource by its identifier.                                                                                                                                                                                                                                                                              |
| `harness_create`   | Create a new resource. Supports inline and remote (Git-backed) pipelines. Prompts for user confirmation via [elicitation](#elicitation).                                                                                                                                                                              |
| `harness_update`   | Update an existing resource. Supports inline and remote (Git-backed) pipelines. Prompts for user confirmation via [elicitation](#elicitation).                                                                                                                                                                        |
| `harness_delete`   | Delete a resource. Prompts for user confirmation via [elicitation](#elicitation). Destructive.                                                                                                                                                                                                                        |
| `harness_execute`  | Execute an action on a resource (run/retry pipeline, import pipeline from Git, toggle flag, sync app). Prompts for user confirmation via [elicitation](#elicitation). For pipeline runs, use the runtime-input workflow below (supports `branch`/`tag`/`pr_number`/`commit_sha` shorthand expansion).                 |
| `harness_search`   | Search across multiple resource types in parallel with a single query.                                                                                                                                                                                                                                                |
| `harness_diagnose` | Diagnose `pipeline`, `connector`, `delegate`, and `gitops_application` resources (aliases: `execution` -> `pipeline`, `gitops_app` -> `gitops_application`). For pipelines, returns stage/step timing and failure details; for connectors/delegates/GitOps apps, returns targeted health and troubleshooting signals. |
| `harness_status`   | Get a real-time project health dashboard — recent executions, failure rates, and deep links.                                                                                                                                                                                                                          |


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
  "inputs": { "tag": "v1.2.3" },
  "wait": true
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

**List database schemas filtered by migration type:**

```json
{ "resource_type": "database_schema", "migration_type": "Liquibase" }
```

**List database instances for a schema:**

```json
{ "resource_type": "database_instance", "dbschema_id": "my_schema" }
```

**Get the resolved LLM authoring pipeline for a schema and instance:**

```json
{ "resource_type": "database_llm_authoring_pipeline", "resource_id": "my_schema", "dbinstance_id": "prod_db" }
```

**List snapshot object names (e.g. tables) for a schema instance:**

```json
{
  "resource_type": "database_snapshot_object",
  "dbschema_id": "my_schema",
  "dbinstance_id": "prod_db",
  "object_type": "Table"
}
```

**Get full snapshot metadata for specific named objects:**

```json
{
  "resource_type": "database_snapshot_object",
  "resource_id": "prod_db",
  "params": {
    "dbschema_id": "my_schema",
    "object_type": "Table",
    "object_names": ["users", "orders"]
  }
}
```

### Pipeline Run Workflow (Recommended)

Use this sequence to reduce execution-time input errors:

1. **Discover required runtime inputs**
  - `harness_get(resource_type="runtime_input_template", resource_id="<pipeline_id>")`
  - The returned template shows `<+input>` placeholders that need values.
2. **Choose input strategy**
  - **Simple variables:** pass flat key-value `inputs` (for example `{"branch":"main","env":"prod"}`).
  - **Complex/structural inputs:** use `input_set_ids` (CI codebase/build blocks and nested template inputs are best handled this way).
  - **CI codebase shorthand keys (pipeline run only):**

    | Shorthand key | Expanded structure                                     |
    | ------------- | ------------------------------------------------------ |
    | `branch`      | `build.type=branch`, `build.spec.branch=<value>`       |
    | `tag`         | `build.type=tag`, `build.spec.tag=<value>`             |
    | `pr_number`   | `build.type=PR`, `build.spec.number=<value>`           |
    | `commit_sha`  | `build.type=commitSha`, `build.spec.commitSha=<value>` |

  - **Constraint:** shorthand expansion is skipped when `inputs.build` is already present (explicit `build` wins).
3. **Execute the run**
  - `harness_execute(resource_type="pipeline", action="run", resource_id="<pipeline_id>", ...)`
  - For Git-backed pipelines whose YAML should be loaded from a non-default branch, pass `params.pipeline_branch` (sent to Harness as `pipelineBranchName`):

    ```json
    {
      "resource_type": "pipeline",
      "action": "run",
      "resource_id": "deploy_app",
      "params": { "pipeline_branch": "feature/new-stage" },
      "inputs": { "branch": "main" },
      "wait": true
    }
    ```
4. **Optional: combine both**
  - Use `input_set_ids` for the base shape and `inputs` for simple overrides.

If required fields are unresolved, the tool returns a pre-flight error with expected keys and suggested input sets. You can inspect available shorthand mappings with `harness_describe(resource_type="pipeline")` (`executeActions.run.inputShorthands`).

### Pipeline Execute Wait Mode

For `pipeline.run`, `pipeline.retry`, and `pipeline_v1.run`, pass `wait: true` to let the server poll until the execution reaches a terminal status. This keeps a pipeline launch and status check in one tool call instead of asking the client or LLM to run a polling loop.

```json
{
  "resource_type": "pipeline",
  "action": "run",
  "resource_id": "deploy_app",
  "inputs": { "branch": "main" },
  "wait": true,
  "wait_timeout_seconds": 900,
  "wait_poll_interval_seconds": 5
}
```

Wait mode behavior:

- Default timeout is 600 seconds; allowed range is 10 seconds to 7200 seconds.
- Initial poll interval defaults to 3 seconds, backs off by 1.5x, and caps at 30 seconds.
- On success or failure, the response includes fields such as `execution_id`, `execution_status`, `execution_terminal`, `execution_elapsed_ms`, and `execution_poll_count`.
- If the timeout fires, the original trigger still succeeded; the response includes `execution_timed_out: true` and `_wait.hint` with the last observed status.
- If polling fails after the trigger succeeds, the response includes `_wait.error` and a recheck hint. Do not blindly rerun the pipeline unless you have confirmed the first execution is not running.
- Failed terminal statuses include `_diagnose_hint` pointing to `harness_diagnose(resource_type="execution", options={execution_id: "..."})`.

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


| Mode                      | Description                                             | When to use                                                        |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| **Inline**                | Pipeline YAML stored in Harness                         | Default. Simplest setup, no Git required.                          |
| **Remote (External Git)** | Pipeline YAML stored in GitHub, GitLab, Bitbucket, etc. | Teams using Git-backed pipeline-as-code with an external provider. |
| **Remote (Harness Code)** | Pipeline YAML stored in a Harness Code repository       | Teams using Harness's built-in Git hosting.                        |


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

**List input sets for a pipeline:**

```json
{
  "resource_type": "input_set",
  "pipeline_id": "my-pipeline"
}
```

**Get a specific input set:**

```json
{
  "resource_type": "input_set",
  "resource_id": "prod-inputs",
  "pipeline_id": "my-pipeline"
}
```

**Create an input set:**

```json
{
  "resource_type": "input_set",
  "pipeline_id": "my-pipeline",
  "body": "inputSet:\n  name: Production Inputs\n  identifier: prod_inputs\n  pipeline:\n    identifier: my-pipeline\n    variables:\n      - name: env\n        type: String\n        value: production"
}
```

**Update an input set:**

```json
{
  "resource_type": "input_set",
  "resource_id": "prod_inputs",
  "pipeline_id": "my-pipeline",
  "body": "inputSet:\n  name: Production Inputs\n  identifier: prod_inputs\n  pipeline:\n    identifier: my-pipeline\n    variables:\n      - name: env\n        type: String\n        value: production\n      - name: replicas\n        type: String\n        value: \"3\""
}
```

**Delete an input set:**

```json
{
  "resource_type": "input_set",
  "resource_id": "prod_inputs",
  "pipeline_id": "my-pipeline"
}
```

## Resource Types

203 resource types organized across 33 toolsets. Each resource type supports a subset of CRUD operations and optional execute actions.

### Platform


| Resource Type  | List | Get | Create | Update | Delete | Execute Actions |
| -------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `organization` | x    | x   | x      | x      | x      |                 |
| `project`      | x    | x   | x      | x      | x      |                 |


### Pipelines


| Resource Type             | List | Get | Create | Update | Delete | Execute Actions     |
| ------------------------- | ---- | --- | ------ | ------ | ------ | ------------------- |
| `pipeline`                | x    | x   | x      | x      | x      | `run`, `retry`      |
| `pipeline_v1` **(Alpha)** | x    | x   | x      | x      | x      | `run`               |
| `execution`               | x    | x   |        |        |        | `interrupt`         |
| `trigger`                 | x    | x   | x      | x      | x      |                     |
| `pipeline_summary`        |      | x   |        |        |        |                     |
| `input_set`               | x    | x   | x      | x      | x      |                     |
| `runtime_input_template`  |      | x   |        |        |        |                     |
| `approval_instance`       | x    |     |        |        |        | `approve`, `reject` |


Only one pipeline YAML resource type is loaded at startup. By default `HARNESS_PIPELINE_VERSION=0` exposes `pipeline` and hides `pipeline_v1`; set `HARNESS_PIPELINE_VERSION=1` to expose `pipeline_v1` and hide `pipeline`. In HTTP mode, include `x-harness-pipeline-version: 0` or `1` on the `initialize` request to choose the version for that session.

### AI Agents


| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
| ------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `agent`       | x    | x   | x      | x      | x      |                 |
| `agent_run`   | x    |     |        |        |        |                 |


### Services


| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
| ------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `service`     | x    | x   | x      | x      | x      |                 |


### Environments


| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
| ------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `environment` | x    | x   | x      | x      | x      | `move_configs`  |


### Connectors


| Resource Type         | List | Get | Create | Update | Delete | Execute Actions   |
| --------------------- | ---- | --- | ------ | ------ | ------ | ----------------- |
| `connector`           | x    | x   | x      | x      | x      | `test_connection` |
| `connector_catalogue` | x    |     |        |        |        |                   |


### Infrastructure


| Resource Type    | List | Get | Create | Update | Delete | Execute Actions |
| ---------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `infrastructure` | x    | x   | x      | x      | x      | `move_configs`  |


### Secrets


| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
| ------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `secret`      | x    | x   |        |        |        |                 |


### Execution Logs


| Resource Type   | List | Get | Create | Update | Delete | Execute Actions |
| --------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `execution_log` |      | x   |        |        |        |                 |


### Audit Trail


| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
| ------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `audit_event` | x    | x   |        |        |        |                 |


### Delegates


| Resource Type    | List | Get | Create | Update | Delete | Execute Actions           |
| ---------------- | ---- | --- | ------ | ------ | ------ | ------------------------- |
| `delegate`       | x    |     |        |        |        |                           |
| `delegate_token` | x    | x   | x      |        | x      | `revoke`, `get_delegates` |


### Code Repositories


| Resource Type  | List | Get | Create | Update | Delete | Execute Actions      |
| -------------- | ---- | --- | ------ | ------ | ------ | -------------------- |
| `repository`   | x    | x   | x      | x      |        |                      |
| `branch`       | x    | x   | x      |        | x      |                      |
| `commit`       | x    | x   | x      |        |        | `diff`, `diff_stats` |
| `file_content` |      | x   |        |        |        | `blame`              |
| `tag`          | x    |     | x      |        | x      |                      |
| `repo_rule`    | x    | x   |        |        |        |                      |
| `space_rule`   | x    | x   |        |        |        |                      |

`commit` creation commits one or more file actions directly through the Harness Code API without cloning. Pass `body.title`, `body.branch`, and `body.actions`; each action is `CREATE`, `UPDATE`, `DELETE`, or `MOVE`, and `UPDATE` requires the current blob SHA.


### Artifact Registries


| Resource Type      | List | Get | Create | Update | Delete | Execute Actions |
| ------------------ | ---- | --- | ------ | ------ | ------ | --------------- |
| `registry`         | x    | x   |        |        |        |                 |
| `artifact`         | x    |     |        |        |        |                 |
| `artifact_version` | x    |     |        |        |        |                 |
| `artifact_file`    | x    |     |        |        |        |                 |


### Templates


| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
| ------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `template`    | x    | x   | x      | x      | x      |                 |

Template operations use the Harness Template service paths (`/template/api/templates...`). Create and update require the full template YAML string in `body.template_yaml` or `body.yaml`; `version_label` targets a specific version for update/delete, while deleting without `version_label` deletes all versions.


### Dashboards


| Resource Type    | List | Get | Create | Update | Delete | Execute Actions |
| ---------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `dashboard`      | x    | x   |        |        |        |                 |
| `dashboard_data` |      | x   |        |        |        |                 |


### Database DevOps


| Resource Type                     | List | Get | Create | Update | Delete | Execute Actions |
| --------------------------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `database_schema`                 | x    | x   | x      | x      | x      |                 |
| `database_instance`               | x    | x   | x      | x      | x      |                 |
| `database_snapshot_object`        | x    | x   |        |        |        |                 |
| `database_llm_authoring_pipeline` |      | x   |        |        |        |                 |


### Internal Developer Portal (IDP)


| Resource Type           | List | Get | Create | Update | Delete | Execute Actions |
| ----------------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `idp_entity`            | x    | x   |        |        |        |                 |
| `scorecard`             | x    | x   |        |        |        |                 |
| `scorecard_check`       | x    | x   |        |        |        |                 |
| `scorecard_stats`       |      | x   |        |        |        |                 |
| `scorecard_check_stats` |      | x   |        |        |        |                 |
| `idp_score`             | x    | x   |        |        |        |                 |
| `idp_workflow`          | x    |     |        |        |        | `execute`       |
| `idp_tech_doc`          | x    |     |        |        |        |                 |


### Pull Requests


| Resource Type  | List | Get | Create | Update | Delete | Execute Actions |
| -------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `pull_request` | x    | x   | x      | x      |        | `close`, `merge` |
| `pr_reviewer`  | x    |     | x      |        |        | `submit_review` |
| `pr_comment`   | x    |     | x      |        |        |                 |
| `pr_check`     | x    |     |        |        |        |                 |
| `pr_activity`  | x    |     |        |        |        |                 |

Use `harness_execute(resource_type="pull_request", action="close", ...)` for an explicit close operation. `harness_update` also accepts `body.state` (`open` or `closed`) and routes state changes to the dedicated Harness Code PR state endpoint; send title/description edits in a separate update call.


### Feature Flags


| Resource Type                       | List | Get | Create | Update | Delete | Execute Actions                           |
| ----------------------------------- | ---- | --- | ------ | ------ | ------ | ----------------------------------------- |
| `fme_workspace`                     | x    |     |        |        |        |                                           |
| `fme_environment`                   | x    |     |        |        |        |                                           |
| `fme_feature_flag`                  | x    | x   | x      | x      | x      | `kill`, `restore`, `archive`, `unarchive` |
| `fme_feature_flag_definition`       |      | x   |        |        |        |                                           |
| `fme_rollout_status`                | x    |     |        |        |        |                                           |
| `fme_rule_based_segment`            | x    | x   | x      |        | x      |                                           |
| `fme_rule_based_segment_definition` | x    |     |        | x      |        | `enable`, `disable`, `change_request`     |
| `feature_flag`                      | x    | x   | x      |        | x      | `toggle`                                  |


**FME (Split.io) resources** — `fme_`* resources use the Split.io API (`api.split.io`) and are scoped by workspace ID rather than org/project. Auth uses `HARNESS_API_KEY` as a Bearer token. `fme_feature_flag` supports full lifecycle management: create (requires `traffic_type_id`), list, get, update metadata, delete, and kill/restore/archive/unarchive execute actions. `fme_rule_based_segment` provides CRUD for targeting segments, while `fme_rule_based_segment_definition` manages environment-specific segment rules with enable/disable and change request approval flows. Use `feature_flag` for the Harness CF admin API which supports environment-specific definitions, create, delete, and toggle.

### GitOps


| Resource Type              | List | Get | Create | Update | Delete | Execute Actions |
| -------------------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `gitops_agent`             | x    | x   |        |        |        |                 |
| `gitops_application`       | x    | x   |        |        |        | `sync`          |
| `gitops_cluster`           | x    | x   |        |        |        |                 |
| `gitops_repository`        | x    | x   |        |        |        |                 |
| `gitops_applicationset`    | x    | x   |        |        |        |                 |
| `gitops_repo_credential`   | x    | x   |        |        |        |                 |
| `gitops_app_event`         | x    |     |        |        |        |                 |
| `gitops_pod_log`           |      | x   |        |        |        |                 |
| `gitops_managed_resource`  | x    |     |        |        |        |                 |
| `gitops_resource_action`   | x    |     |        |        |        |                 |
| `gitops_dashboard`         |      | x   |        |        |        |                 |
| `gitops_app_resource_tree` |      | x   |        |        |        |                 |


### Chaos Engineering


| Resource Type                | List | Get | Create | Update | Delete | Execute Actions        |
| ---------------------------- | ---- | --- | ------ | ------ | ------ | ---------------------- |
| `chaos_experiment`           | x    | x   | x      |        | x      | `run`, `stop`          |
| `chaos_experiment_run`       |      | x   |        |        |        |                        |
| `chaos_experiment_variable`  | x    |     |        |        |        |                        |
| `chaos_component_variable`   |      | x   |        |        |        |                        |
| `chaos_input_set`            | x    | x   | x      | x      | x      |                        |
| `chaos_experiment_template`  | x    | x   |        |        | x      | `create_from_template` |
| `chaos_probe`                | x    | x   | x      |        | x      | `enable`, `verify`     |
| `chaos_probe_in_run`         | x    |     |        |        |        |                        |
| `chaos_probe_template`       | x    | x   |        |        | x      |                        |
| `chaos_infrastructure`       | x    |     |        |        |        |                        |
| `chaos_k8s_infrastructure`   | x    | x   |        |        |        | `check_health`         |
| `chaos_environment`          | x    |     |        |        |        |                        |
| `chaos_hub`                  | x    | x   | x      | x      | x      |                        |
| `chaos_hub_fault`            | x    |     |        |        |        |                        |
| `chaos_fault`                | x    | x   |        |        | x      |                        |
| `chaos_fault_template`       | x    | x   |        |        | x      |                        |
| `chaos_fault_experiment_run` | x    |     |        |        |        |                        |
| `chaos_action`               | x    | x   |        |        | x      |                        |
| `chaos_action_template`      | x    | x   |        |        | x      |                        |
| `chaos_loadtest`             | x    | x   | x      |        | x      | `run`, `stop`          |
| `chaos_application_map`      | x    | x   |        |        |        |                        |
| `discovered_namespace`       | x    |     |        |        |        |                        |
| `discovered_service`         | x    |     |        |        |        |                        |
| `discovered_network_map`     | x    |     |        |        |        |                        |
| `chaos_guard_condition`      | x    | x   |        |        | x      |                        |
| `chaos_guard_rule`           | x    | x   |        |        | x      | `enable`               |
| `chaos_recommendation`       | x    | x   |        |        |        |                        |
| `chaos_risk`                 | x    | x   |        |        |        |                        |
| `chaos_dr_test`              | x    |     | x      |        |        |                        |


### Cloud Cost Management (CCM)


| Resource Type                | List | Get | Create | Update | Delete | Execute Actions                                                                |
| ---------------------------- | ---- | --- | ------ | ------ | ------ | ------------------------------------------------------------------------------ |
| `cost_perspective`           | x    | x   | x      | x      | x      |                                                                                |
| `cost_breakdown`             | x    |     |        |        |        |                                                                                |
| `cost_timeseries`            | x    |     |        |        |        |                                                                                |
| `cost_summary`               | x    | x   |        |        |        |                                                                                |
| `cost_recommendation`        | x    | x   |        |        |        | `update_state`, `override_savings`, `create_jira_ticket`, `create_snow_ticket` |
| `cost_anomaly`               | x    |     |        |        |        |                                                                                |
| `cost_anomaly_summary`       |      | x   |        |        |        |                                                                                |
| `cost_category`              | x    | x   |        |        |        |                                                                                |
| `cost_account_overview`      |      | x   |        |        |        |                                                                                |
| `cost_filter_value`          | x    |     |        |        |        |                                                                                |
| `cost_recommendation_stats`  |      | x   |        |        |        |                                                                                |
| `cost_recommendation_detail` |      | x   |        |        |        |                                                                                |
| `cost_commitment`            |      | x   |        |        |        |                                                                                |


### Software Engineering Insights (SEI)

SEI resources are consolidated for token efficiency. Use `metric` or `aspect` params for DORA, team/org-tree details, and AI insights.


| Resource Type             | List | Get | Create | Update | Delete | Execute Actions                                                                                          |
| ------------------------- | ---- | --- | ------ | ------ | ------ | -------------------------------------------------------------------------------------------------------- |
| `sei_metric`              | x    |     |        |        |        |                                                                                                          |
| `sei_productivity_metric` |      | x   |        |        |        |                                                                                                          |
| `sei_dora_metric`         |      | x   |        |        |        | Pass `metric`: deployment_frequency, change_failure_rate, mttr, lead_time, or *_drilldown                |
| `sei_team`                | x    | x   |        |        |        |                                                                                                          |
| `sei_team_detail`         | x    |     |        |        |        | Pass `aspect`: integrations, developers, integration_filters                                             |
| `sei_org_tree`            | x    | x   |        |        |        |                                                                                                          |
| `sei_org_tree_detail`     | x    | x   |        |        |        | Pass `aspect`: efficiency_profile, productivity_profile, business_alignment_profile, integrations, teams |
| `sei_business_alignment`  | x    | x   |        |        |        | Pass `aspect`: feature_metrics, feature_summary, drilldown for get                                       |
| `sei_ai_usage`            | x    | x   |        |        |        | Pass `aspect`: metrics, breakdown, summary, top_languages                                                |
| `sei_ai_adoption`         | x    | x   |        |        |        | Pass `aspect`: metrics, breakdown, summary                                                               |
| `sei_ai_impact`           |      | x   |        |        |        | Pass `aspect`: pr_velocity, rework                                                                       |
| `sei_ai_raw_metric`       | x    |     |        |        |        |                                                                                                          |


### Software Supply Chain Assurance (SCS)


| Resource Type              | List | Get | Create | Update | Delete | Execute Actions |
| -------------------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `scs_artifact_source`      | x    |     |        |        |        |                 |
| `artifact_security`        | x    | x   |        |        |        |                 |
| `scs_artifact_component`   | x    |     |        |        |        |                 |
| `scs_artifact_remediation` |      | x   |        |        |        |                 |
| `scs_chain_of_custody`     |      | x   |        |        |        |                 |
| `scs_compliance_result`    | x    |     |        |        |        |                 |
| `code_repo_security`       | x    | x   |        |        |        |                 |
| `scs_sbom`                 |      | x   |        |        |        |                 |


### Security Testing Orchestration (STO)


| Resource Type           | List | Get | Create | Update | Delete | Execute Actions                |
| ----------------------- | ---- | --- | ------ | ------ | ------ | ------------------------------ |
| `security_issue`        | x    |     |        |        |        |                                |
| `security_issue_filter` | x    |     |        |        |        |                                |
| `security_exemption`    | x    |     | x      |        |        | `approve`, `reject`, `promote` |

`security_exemption` create is a `high_write` operation. The server derives `requester_id` from the authenticated PAT, sets `exemptFutureOccurrences=true`, and defaults `duration_days` to 30 when not provided. For listing exemptions, pass a small explicit page size (for example `filters: { "status": "Pending", "size": 5 }`) and follow the `_nextPageHint` returned in each response.


### Access Control


| Resource Type     | List | Get | Create | Update | Delete | Execute Actions |
| ----------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `user`            | x    | x   |        |        |        |                 |
| `user_group`      | x    | x   | x      |        | x      |                 |
| `service_account` | x    | x   | x      |        | x      |                 |
| `role`            | x    | x   | x      |        | x      |                 |
| `role_assignment` | x    |     | x      |        |        |                 |
| `resource_group`  | x    | x   | x      |        | x      |                 |
| `permission`      | x    |     |        |        |        |                 |


### Governance


| Resource Type       | List | Get | Create | Update | Delete | Execute Actions |
| ------------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `policy`            | x    | x   | x      | x      | x      |                 |
| `policy_set`        | x    | x   | x      | x      | x      |                 |
| `policy_evaluation` | x    | x   |        |        |        |                 |


### Deployment Freeze


| Resource Type   | List | Get | Create | Update | Delete | Execute Actions |
| --------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `freeze_window` | x    | x   | x      | x      | x      | `toggle_status` |
| `global_freeze` |      | x   |        |        |        | `manage`        |


### Service Overrides


| Resource Type      | List | Get | Create | Update | Delete | Execute Actions |
| ------------------ | ---- | --- | ------ | ------ | ------ | --------------- |
| `service_override` | x    | x   | x      | x      | x      |                 |


### Settings


| Resource Type | List | Get | Create | Update | Delete | Execute Actions |
| ------------- | ---- | --- | ------ | ------ | ------ | --------------- |
| `setting`     | x    |     |        |        |        |                 |


### Visualizations

Inline PNG chart visualizations rendered from Harness data. These are metadata-only resource types with no API operations — they exist so the LLM can discover available chart types via `harness_describe`. Use `include_visual=true` on supported tools (`harness_diagnose`, `harness_list`, `harness_status`) to generate charts.


| Resource Type             | Description                                         | How to Generate                                       |
| ------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| `visual_timeline`         | Gantt chart of pipeline stage execution over time   | `harness_diagnose` with `visual_type: "timeline"`     |
| `visual_stage_flow`       | DAG flowchart of pipeline stages and steps          | `harness_diagnose` with `visual_type: "flow"`         |
| `visual_health_dashboard` | Project health overview with status indicators      | `harness_status` with `include_visual: true`          |
| `visual_pie_chart`        | Donut chart of execution status breakdown           | `harness_list` with `visual_type: "pie"`              |
| `visual_bar_chart`        | Bar chart of execution counts by pipeline           | `harness_list` with `visual_type: "bar"`              |
| `visual_timeseries`       | Daily execution trend over 30 days                  | `harness_list` with `visual_type: "timeseries"`       |
| `visual_architecture`     | Pipeline YAML architecture diagram (stages → steps) | `harness_diagnose` with `visual_type: "architecture"` |


## MCP Prompts

### DevOps


| Prompt                         | Description                                                                                                                                                                                                                                                                                                                                                                           | Parameters                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `build-deploy-app`             | End-to-end CI/CD workflow: scan a git repo, generate CI pipeline (build & push Docker image), discover or generate K8s manifests, create CD pipeline, and deploy — with auto-retry on CI failures (up to 5 attempts) and CD failures (up to 3 attempts with user permission). On exhausted retries, provides Harness UI deep links to all created resources for manual investigation. | `repoUrl` (required), `imageName` (required), `projectId` (optional), `namespace` (optional)         |
| `debug-pipeline-failure`       | Analyze a failed execution: accepts an execution ID, pipeline ID, or Harness URL. Gets stage/step breakdown, failure details, delegate info, and failed step logs via `harness_diagnose`, then provides root cause analysis and suggested fixes. Automatically follows chained pipeline failures.                                                                                     | `executionId` (optional), `projectId` (optional)                                                     |
| `create-pipeline`              | Generate a new pipeline YAML from natural language requirements, reviewing existing resources for context                                                                                                                                                                                                                                                                             | `description` (required), `projectId` (optional)                                                     |
| `create-agent`                 | Interactively build a Harness AI agent — check existing agents, gather requirements, generate agent YAML spec using the agent-pipeline schema, confirm with user, then create or update via `harness_create`/`harness_update`                                                                                                                                                         | `agent_name` (required), `task_description` (required), `org_id` (optional), `project_id` (optional) |
| `onboard-service`              | Walk through onboarding a new service with environments and a deployment pipeline                                                                                                                                                                                                                                                                                                     | `serviceName` (required), `projectId` (optional)                                                     |
| `dora-metrics-review`          | Review DORA metrics (deployment frequency, change failure rate, MTTR, lead time) with Elite/High/Medium/Low classification and improvement recommendations                                                                                                                                                                                                                            | `teamRefId` (optional), `dateStart` (optional), `dateEnd` (optional)                                 |
| `setup-gitops-application`     | Guide through onboarding a GitOps application — verify agent, cluster, repo, and create the application                                                                                                                                                                                                                                                                               | `agentId` (required), `projectId` (optional)                                                         |
| `chaos-resilience-test`        | Design a chaos experiment to test service resilience with fault injection, probes, and expected outcomes                                                                                                                                                                                                                                                                              | `serviceName` (required), `projectId` (optional)                                                     |
| `feature-flag-rollout`         | Plan and execute a progressive feature flag rollout across environments with safety gates                                                                                                                                                                                                                                                                                             | `flagIdentifier` (required), `projectId` (optional)                                                  |
| `migrate-pipeline-to-template` | Analyze an existing pipeline and extract reusable stage/step templates from it                                                                                                                                                                                                                                                                                                        | `pipelineId` (required), `projectId` (optional)                                                      |
| `delegate-health-check`        | Check delegate connectivity, health, token status, and troubleshoot infrastructure issues                                                                                                                                                                                                                                                                                             | `projectId` (optional)                                                                               |
| `developer-portal-scorecard`   | Review IDP scorecards for services and identify gaps to improve developer experience                                                                                                                                                                                                                                                                                                  | `projectId` (optional)                                                                               |
| `pending-approvals`            | Find pipeline executions waiting for approval, show details, and offer to approve or reject                                                                                                                                                                                                                                                                                           | `projectId` (optional), `orgId` (optional), `pipelineId` (optional)                                  |


### FinOps


| Prompt                          | Description                                                                                              | Parameters                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `optimize-costs`                | Analyze cloud cost data, surface recommendations and anomalies, prioritized by potential savings         | `projectId` (optional)                             |
| `cloud-cost-breakdown`          | Deep-dive into cloud costs by service, environment, or cluster with trend analysis and anomaly detection | `perspectiveId` (optional), `projectId` (optional) |
| `commitment-utilization-review` | Analyze reserved instance and savings plan utilization to find waste and optimize commitments            | `projectId` (optional)                             |
| `cost-anomaly-investigation`    | Investigate cost anomalies — determine root cause, impacted resources, and remediation                   | `projectId` (optional)                             |
| `rightsizing-recommendations`   | Review and prioritize rightsizing recommendations, optionally create Jira or ServiceNow tickets          | `projectId` (optional), `minSavings` (optional)    |


### DevSecOps


| Prompt                      | Description                                                                                                   | Parameters                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `security-review`           | Review security issues across Harness resources and suggest remediations by severity                          | `projectId` (optional), `severity` (optional, default: `critical,high`) |
| `vulnerability-triage`      | Triage security vulnerabilities across pipelines and artifacts, prioritize by severity and exploitability     | `projectId` (optional), `severity` (optional)                           |
| `sbom-compliance-check`     | Audit SBOM and compliance posture for artifacts — license risks, policy violations, component vulnerabilities | `artifactId` (optional), `projectId` (optional)                         |
| `supply-chain-audit`        | End-to-end software supply chain security audit — provenance, chain of custody, policy compliance             | `projectId` (optional)                                                  |
| `security-exemption-review` | Review pending security exemptions and make batch approval or rejection decisions                             | `projectId` (optional)                                                  |
| `bulk-exemption-create`     | Create justified security exemptions for multiple STO issues with explicit scope and duration guidance        | `projectId` (required), `exemption_type` (required), `reason` (required), issue filters (optional) |
| `access-control-audit`      | Audit user permissions, over-privileged accounts, and role assignments to enforce least-privilege             | `projectId` (optional), `orgId` (optional)                              |


### Harness Code


| Prompt           | Description                                                                                                                                  | Parameters                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `code-review`    | Review a pull request — analyze diff, commits, checks, and comments to provide structured feedback on bugs, security, performance, and style | `repoId` (required), `prNumber` (required), `projectId` (optional)                                               |
| `pr-summary`     | Auto-generate a PR title and description from the commit history and diff of a branch                                                        | `repoId` (required), `sourceBranch` (required), `targetBranch` (optional, default: main), `projectId` (optional) |
| `branch-cleanup` | Analyze branches in a repository and recommend stale or merged branches to delete                                                            | `repoId` (required), `projectId` (optional)                                                                      |


## MCP Resources


| Resource URI                                   | Description                                                      | MIME Type                 |
| ---------------------------------------------- | ---------------------------------------------------------------- | ------------------------- |
| `pipeline:///{pipelineId}`                     | Pipeline YAML definition                                         | `application/x-yaml`      |
| `pipeline:///{orgId}/{projectId}/{pipelineId}` | Pipeline YAML (with explicit scope)                              | `application/x-yaml`      |
| `executions:///recent`                         | Last 10 pipeline execution summaries                             | `application/json`        |
| `schema:///pipeline`                           | Harness pipeline JSON Schema                                     | `application/schema+json` |
| `schema:///template`                           | Harness template JSON Schema                                     | `application/schema+json` |
| `schema:///trigger`                            | Harness trigger JSON Schema                                      | `application/schema+json` |
| `schema:///pipeline_v1` **(Alpha)**            | Harness V1 pipeline JSON Schema (simplified stages/steps format) | `application/schema+json` |
| `schema:///agent-pipeline`                     | Harness AI agent pipeline JSON Schema                            | `application/schema+json` |


## Toolset Filtering

By default, 33 of 34 toolsets are enabled. One toolset is opt-in and excluded from the defaults:

- **`ansible`** — Harness Ansible (inventories, playbooks, hosts, activity). Opt-in because it is project-scoped and adds concepts many users do not need.

### Adding toolsets with `+` prefix

Use the `+` prefix to explicitly include opt-in toolsets alongside all defaults:

```bash
# Explicitly include Ansible alongside all defaults
HARNESS_TOOLSETS=+ansible
```

### Removing default toolsets

Use the `-` prefix to exclude toolsets you don't need:

```bash
# Remove chaos and ccm from defaults
HARNESS_TOOLSETS=-chaos,-ccm
```

### Combining + and -

```bash
# Add Ansible, remove chaos
HARNESS_TOOLSETS=+ansible,-chaos
```

### Explicit allowlist

An explicit comma-separated list (no prefixes) replaces the defaults entirely. Only the listed toolsets are enabled:

```bash
# Only expose pipelines, services, and connectors
HARNESS_TOOLSETS=pipelines,services,connectors
```

Available toolset names:


| Toolset                 | Resource Types                                                                                                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform`              | organization, project                                                                                                                                                                                                                                                                           |
| `pipelines`             | pipeline, pipeline_v1, execution, trigger, pipeline_summary, input_set, approval_instance                                                                                                                                                                                                       |
| `agents`                | agent, agent_run                                                                                                                                                                                                                                                                                |
| `services`              | service                                                                                                                                                                                                                                                                                         |
| `environments`          | environment                                                                                                                                                                                                                                                                                     |
| `connectors`            | connector, connector_catalogue                                                                                                                                                                                                                                                                  |
| `infrastructure`        | infrastructure                                                                                                                                                                                                                                                                                  |
| `secrets`               | secret                                                                                                                                                                                                                                                                                          |
| `logs`                  | execution_log                                                                                                                                                                                                                                                                                   |
| `audit`                 | audit_event                                                                                                                                                                                                                                                                                     |
| `delegates`             | delegate, delegate_token                                                                                                                                                                                                                                                                        |
| `repositories`          | repository, branch, commit, file_content, tag, repo_rule, space_rule                                                                                                                                                                                                                            |
| `registries`            | registry, artifact, artifact_version, artifact_file                                                                                                                                                                                                                                             |
| `templates`             | template                                                                                                                                                                                                                                                                                        |
| `dashboards`            | dashboard, dashboard_data                                                                                                                                                                                                                                                                       |
| `idp`                   | idp_entity, scorecard, scorecard_check, scorecard_stats, scorecard_check_stats, idp_score, idp_workflow, idp_tech_doc                                                                                                                                                                           |
| `pull-requests`         | pull_request, pr_reviewer, pr_comment, pr_check, pr_activity                                                                                                                                                                                                                                    |
| `feature-flags`         | fme_workspace, fme_environment, fme_feature_flag, fme_feature_flag_definition, fme_rollout_status, fme_rule_based_segment, fme_rule_based_segment_definition, feature_flag                                                                                                                      |
| `gitops`                | gitops_agent, gitops_application, gitops_cluster, gitops_repository, gitops_applicationset, gitops_repo_credential, gitops_app_event, gitops_pod_log, gitops_managed_resource, gitops_resource_action, gitops_dashboard, gitops_app_resource_tree                                               |
| `chaos`                 | chaos_experiment, chaos_experiment_run, chaos_experiment_variable, chaos_component_variable, chaos_input_set, chaos_experiment_template, chaos_probe, chaos_probe_in_run, chaos_probe_template, chaos_infrastructure, chaos_k8s_infrastructure, chaos_environment, chaos_hub, chaos_hub_fault, chaos_fault, chaos_fault_template, chaos_fault_experiment_run, chaos_action, chaos_action_template, chaos_loadtest, chaos_application_map, discovered_namespace, discovered_service, discovered_network_map, chaos_guard_condition, chaos_guard_rule, chaos_recommendation, chaos_risk, chaos_dr_test |
| `ccm`                   | cost_perspective, cost_breakdown, cost_timeseries, cost_summary, cost_recommendation, cost_anomaly, cost_anomaly_summary, cost_category, cost_account_overview, cost_filter_value, cost_recommendation_stats, cost_recommendation_detail, cost_commitment                                       |
| `sei`                   | sei_metric, sei_productivity_metric, sei_dora_metric, sei_team, sei_team_detail, sei_org_tree, sei_org_tree_detail, sei_business_alignment, sei_ai_usage, sei_ai_adoption, sei_ai_impact, sei_ai_raw_metric                                                                                     |
| `scs`                   | scs_artifact_source, artifact_security, scs_artifact_component, scs_artifact_remediation, scs_chain_of_custody, scs_compliance_result, code_repo_security, scs_sbom                                                                                                                             |
| `sto`                   | security_issue, security_issue_filter, security_exemption                                                                                                                                                                                                                                       |
| `dbops`                 | database_schema, database_instance, database_snapshot_object, database_llm_authoring_pipeline                                                                                                                                                                                                   |
| `access_control`        | user, user_group, service_account, role, role_assignment, resource_group, permission                                                                                                                                                                                                            |
| `governance`            | policy, policy_set, policy_evaluation                                                                                                                                                                                                                                                           |
| `freeze`                | freeze_window, global_freeze                                                                                                                                                                                                                                                                    |
| `overrides`             | service_override                                                                                                                                                                                                                                                                                |
| `settings`              | setting                                                                                                                                                                                                                                                                                         |
| `visualizations`        | visual_timeline, visual_stage_flow, visual_health_dashboard, visual_pie_chart, visual_bar_chart, visual_timeseries, visual_architecture                                                                                                                                                         |
| `ai-evals`              | eval_dataset, eval_dataset_item, evaluation, eval_run, eval_run_item, eval_run_by_eval, eval_metric, eval_metric_set, eval_metric_set_entry, eval_suite, eval_suite_evaluation, eval_suite_run, eval_target, eval_model, eval_annotation, eval_analytics, eval_git_settings, eval_registry_item |
| `iacm`                  | iacm_workspace, iacm_resource, iacm_module, iacm_workspace_costs, iacm_activity_resource_change                                                                                                                                                                                                 |
| `ansible` *(opt-in)*    | ansible_inventory, ansible_playbook, ansible_host, ansible_host_activity, ansible_activity                                                                                                                                                                                                      |


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
                |  33 Toolsets      |      (data files, not code)
                |  203 Resource Types|
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
3. **Dispatch** resolves the resource definition, builds the HTTP request (path substitution, query params, `resource_scope`-aware account/org/project injection), calls the Harness API through `HarnessClient`, and extracts the relevant response data.
4. **Toolset filtering** (`HARNESS_TOOLSETS`) controls which resource definitions are loaded into the registry at startup.
5. **Structured output** is declared with MCP `outputSchema`; `harness_list` coerces arrays and common list wrappers into object-shaped `structuredContent` for strict clients.
6. **Deep links** are automatically appended to responses, providing direct Harness UI URLs for every resource.
7. **Compact mode** strips verbose metadata from list results, keeping only actionable fields (identity, status, type, timestamps, deep links) to minimize token usage.

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
    harness-schema.ts

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


| Client            | Elicitation Support |
| ----------------- | ------------------- |
| Cursor            | Yes                 |
| VS Code (Copilot) | Yes                 |
| Claude Desktop    | Not yet             |
| Windsurf          | Not yet             |
| MCP Inspector     | Yes                 |


Elicitation behavior varies by operation risk when client support is missing:


| Risk Level                                    | Client supports elicitation | Behavior                                          |
| --------------------------------------------- | --------------------------- | ------------------------------------------------- |
| `read`, `low_write`                           | any                         | Proceed silently (no confirmation needed)         |
| `medium_write`, `high_write`, `destructive`   | Yes                         | Prompt user — proceed on accept, block on decline |
| `medium_write`, `high_write`, `destructive`   | No                          | **BLOCK** (return error)                          |
| any (at or below `HARNESS_AUTO_APPROVE_RISK`) | any                         | Auto-approve without prompting                    |


If elicitation fails at runtime, operations at `medium_write` or above are blocked.

### Autonomous Mode

**Autonomous mode** means the server proceeds with all operations — including writes and destructive actions — without prompting for confirmation. Enable it by setting:

```bash
HARNESS_AUTO_APPROVE_RISK=all
```

This is the deployment-level ceiling: once set, individual sessions cannot escalate beyond it (though they can choose a stricter threshold per-session via the `x-harness-auto-approve-risk` header).

Or in your MCP client config:

```json
{
  "mcpServers": {
    "harness": {
      "command": "npx",
      "args": ["harness-mcp-v2"],
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx",
        "HARNESS_AUTO_APPROVE_RISK": "all"
      }
    }
  }
}
```

**Partial autonomy:** You can also auto-approve only up to a specific risk level while still prompting for higher-risk operations:

```bash
# Auto-approve reads and low-risk writes; prompt for medium_write, high_write, destructive
HARNESS_AUTO_APPROVE_RISK=low_write

# Auto-approve up to high-risk writes; only prompt for destructive operations
HARNESS_AUTO_APPROVE_RISK=high_write
```

| Value | What's auto-approved |
|---|---|
| `none` (default) | Nothing — no auto-approval threshold |
| `low_write` | Reads + low-risk writes |
| `medium_write` | Reads + low + medium-risk writes |
| `high_write` | Reads + low + medium + high-risk writes |
| `all` | Everything, including destructive operations |

> **Autonomous mode warning:** `HARNESS_AUTO_APPROVE_RISK=all` skips confirmation for **all** operations including `harness_delete`. Use with caution and consider pairing with `HARNESS_TOOLSETS` to restrict which resource types are available.

> **Migration note:** `HARNESS_SKIP_ELICITATION=true` is still supported and maps to `HARNESS_AUTO_APPROVE_RISK=all`. A deprecation warning is logged to stderr. If both are set, `HARNESS_AUTO_APPROVE_RISK` takes precedence.

## Safety

- **Secrets are never exposed.** The `secret` resource type returns metadata only (name, type, scope) — secret values are never included in any response.
- **Write operations use elicitation when available.** `harness_create`, `harness_update`, `harness_delete`, and `harness_execute` attempt MCP elicitation before proceeding (see [Elicitation](#elicitation)).
- **Medium-risk and above fail closed.** If confirmation cannot be obtained for `medium_write`, `high_write`, or `destructive` operations, they are blocked instead of executing blindly. Override with `HARNESS_AUTO_APPROVE_RISK` for autonomous workflows.
- **CORS restricted to same-origin.** The HTTP transport only allows same-origin requests, preventing CSRF attacks from malicious websites targeting the MCP server on localhost.
- **HTTP rate limiting.** The HTTP transport enforces 60 requests per minute per IP to prevent request flooding.
- **API rate limiting.** The Harness API client enforces a 10 requests/second limit to avoid hitting upstream rate limits.
- **Pagination bounds enforced.** List queries are capped at 10,000 items total and 100 per page to prevent memory exhaustion.
- **Retries with backoff.** Transient failures (HTTP 429, 5xx) are retried with exponential backoff and jitter.
- **Localhost binding.** The HTTP transport binds to `127.0.0.1` by default — not accessible from the network.
- **No stdout logging.** All logs go to stderr to avoid corrupting the stdio JSON-RPC transport.

## Complementary Skills

The Harness MCP server pairs well with **[Harness Skills](https://github.com/harness/harness-skills)** — a collection of ready-made Claude Code skills (slash commands) designed for common Harness workflows. Install them alongside this MCP server to get high-level automation like `/deploy`, `/rollback`, `/triage`, and more without writing custom prompts.

## Troubleshooting & Common Pitfalls


| Symptom                                                                          | Likely Cause                                                                                         | What to Do                                                                                                                           |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `HARNESS_ACCOUNT_ID is required when the API key does not include an account ID segment...` | API key is not in a supported account-scoped format (`pat.<accountId>...` or `sat.<accountId>...`) so account ID cannot be inferred | Set `HARNESS_ACCOUNT_ID` explicitly |
| `Unknown transport: "..."` on startup                                            | Unsupported CLI transport arg                                                                        | Use `stdio` or `http` only                                                                                                           |
| `Invalid HARNESS_TOOLSETS: ...` on startup                                       | One or more toolset names are not recognized                                                         | Use only names from [Toolset Filtering](#toolset-filtering) (exact match)                                                            |
| HTTP `mcp-session-id header is required...`                                      | A session request was sent without session header                                                    | Send `initialize` first, then include `mcp-session-id` on `POST/GET/DELETE /mcp`                                                     |
| HTTP `Session not found...`                                                      | Session expired (30 min idle TTL) or already closed                                                  | Re-run `initialize` to create a new session, then retry with new header                                                              |
| HTTP `405 Method Not Allowed` on `/mcp`                                          | Unsupported method for MCP endpoint                                                                  | Use `POST`, `GET`, `DELETE`, or `OPTIONS` only                                                                                       |
| HTTP `Invalid request`                                                           | Invalid JSON body or request body exceeded `HARNESS_MAX_BODY_SIZE_MB`                                | Validate JSON payload size/shape; increase `HARNESS_MAX_BODY_SIZE_MB` if needed                                                      |
| `Unknown resource_type "..."` from tools                                         | Resource type is misspelled or filtered out via `HARNESS_TOOLSETS`                                   | Call `harness_describe` (with optional `search_term`) to discover valid types                                                        |
| `Missing required field "... for path parameter ..."`                            | A project/org scoped call is missing identifiers                                                     | Set `HARNESS_ORG`/`HARNESS_PROJECT` or pass `org_id`/`project_id` per tool call                                                      |
| `resource_scope "org" requires org_id...` or `resource_scope "project" requires project_id...` | A multi-scope resource was forced to org/project scope without enough identifiers                     | Pass the missing `org_id`/`project_id`, configure `HARNESS_ORG`/`HARNESS_PROJECT`, or use `resource_scope: "account"` when supported |
| `Read-only mode is enabled ... operations are not allowed`                       | `HARNESS_READ_ONLY=true` blocks create/update/delete/execute                                         | Set `HARNESS_READ_ONLY=false` if write operations are intended                                                                       |
| Pipeline run fails pre-flight with unresolved required inputs                    | Provided `inputs` did not cover required runtime placeholders                                        | Fetch `runtime_input_template`, supply missing simple keys, or use `input_set_ids` for structural inputs                             |
| Pipeline CI shorthand (`branch`, `tag`, `pr_number`, `commit_sha`) did not apply | `inputs.build` was already provided, so shorthand expansion was intentionally skipped                | Remove `inputs.build` to use shorthand expansion, or keep full explicit `build` structure                                            |
| Pipeline run loaded the wrong YAML revision                                     | The pipeline definition is stored in Git and the run did not specify the desired pipeline branch      | Pass `params.pipeline_branch` on the `run` action; this maps to Harness `pipelineBranchName`                                         |
| `wait: true` returned `_wait.error`                                              | The pipeline trigger succeeded, but server-side polling failed                                       | Recheck the `execution_id` with `harness_get(resource_type="execution", ...)` before deciding whether to rerun                        |
| `wait: true` returned `execution_timed_out: true`                                | The execution did not reach a terminal status before `wait_timeout_seconds`                          | Use the returned `execution_id` to recheck status or diagnose the still-running execution                                             |
| Execution logs are empty or blob downloads return 403                           | Harness-hosted log blob URLs require the configured Harness client/auth path, especially for internal or self-managed hosts | Keep `HARNESS_BASE_URL` pointed at the target Harness host and use `harness_get(resource_type="execution_log", ...)` or `harness_diagnose(..., include_logs=true)` rather than bypassing the MCP client |
| `Operation declined by user`                                                     | User declined the elicitation confirmation dialog                                                    | The user chose not to proceed — verify the operation details and retry if intended                                                   |
| `body.template_yaml (or body.yaml) is required` for template create/update       | Template APIs expect full YAML payload                                                               | Provide full `template_yaml` string in `body`; for deletes, pass `version_label` to delete one version (omit to delete all versions) |
| `HARNESS_BASE_URL must use HTTPS` on startup                                     | `HARNESS_BASE_URL` is set to an HTTP URL                                                             | Use HTTPS, or set `HARNESS_ALLOW_HTTP=true` for local development                                                                    |


## License

MIT
