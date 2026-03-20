# CLAUDE.md — Harness.io MCP Server

> You are building a production-grade MCP (Model Context Protocol) server that wraps the Harness.io REST API, enabling AI agents (Claude, Cursor, Windsurf, etc.) to interact with Harness CI/CD pipelines, services, environments, connectors, and platform entities through standardized tools and resources.

---

## Project Identity

- **Name**: `harness-mcp-server`
- **Runtime**: TypeScript (Node.js 20+)
- **SDK**: `@modelcontextprotocol/sdk` (v1.27+)
- **Transport**: Stdio (local) + Streamable HTTP (remote)
- **Schema Validation**: Zod v4 (import from `zod/v4`)
- **Build**: `tsc` with ES2022 target, ESM output
- **Package Manager**: pnpm

---

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity
- Map every new tool to a specific Harness API endpoint before writing code

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution
- Use subagents for: API endpoint discovery, Zod schema generation, test writing

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness
- For every MCP tool: test with `npx @modelcontextprotocol/inspector`

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

---

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

---

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **Type Safety**: Every tool input/output must be fully typed with Zod 4 schemas. No `any`. Import via `import * as z from "zod/v4"`.
- **Fail Loudly**: Never swallow errors. Surface Harness API errors with full context.
- **Idempotent Reads**: All read tools must be safe to call repeatedly with identical results.

---

## Architecture

### Directory Structure
```
harness-mcp-server/
├── src/
│   ├── index.ts                    # Server entrypoint + transport setup
│   ├── config.ts                   # Env var validation (Zod)
│   ├── client/
│   │   ├── harness-client.ts       # Core HTTP client (auth, base URL, retry)
│   │   ├── types.ts                # Shared Harness API response types
│   │   └── pagination.ts           # Generic paginator for list endpoints
│   ├── tools/
│   │   ├── index.ts                # Tool registry (auto-discovers all tools)
│   │   ├── pipelines.ts            # Pipeline CRUD + execution tools
│   │   ├── executions.ts           # Execution history, logs, status
│   │   ├── connectors.ts           # Connector management
│   │   ├── services.ts             # Service entity tools
│   │   ├── environments.ts         # Environment entity tools
│   │   ├── projects.ts             # Project + Org tools
│   │   ├── secrets.ts              # Secret management (read-only metadata)
│   │   ├── triggers.ts             # Pipeline trigger management
│   │   ├── delegates.ts            # Delegate health + status
│   │   ├── feature-flags.ts        # FF toggles and status
│   │   └── logs.ts                 # Execution log retrieval
│   ├── resources/
│   │   ├── index.ts                # Resource registry
│   │   ├── pipeline-yaml.ts        # Pipeline YAML as resource
│   │   └── execution-summary.ts    # Recent executions as resource
│   ├── prompts/
│   │   ├── index.ts                # Prompt registry
│   │   ├── debug-pipeline.ts       # "Debug this failed pipeline" prompt
│   │   ├── create-pipeline.ts      # "Create a new pipeline" prompt
│   │   └── optimize-pipeline.ts    # "Optimize this pipeline" prompt
│   └── utils/
│       ├── errors.ts               # Error normalization + MCP error mapping
│       ├── logger.ts               # stderr-only logger (CRITICAL for stdio)
│       └── rate-limiter.ts         # Client-side rate limiting
├── tests/
│   ├── tools/                      # Tool-level unit tests
│   ├── client/                     # HTTP client tests
│   └── integration/                # End-to-end with mock Harness API
├── tasks/
│   ├── todo.md                     # Current task tracking
│   └── lessons.md                  # Self-improvement log
├── .env.example                    # Required env vars documented
├── tsconfig.json
├── package.json
└── README.md
```

### Key Design Decisions

**1. Single HTTP Client Instance**
- One `HarnessClient` class wraps all API calls
- Handles auth header injection (`x-api-key`), base URL, retry with exponential backoff
- All tools receive the client via dependency injection — never instantiate their own

**2. Tool Registration Pattern**
- Each tool file exports a `register(server, client)` function
- `tools/index.ts` auto-imports and registers all tools
- Tools are grouped by Harness entity domain (pipelines, connectors, etc.)

**3. Harness Scoping Model**
- Harness uses a 3-tier hierarchy: Account → Organization → Project
- EVERY API call requires `accountIdentifier` (from env/config)
- Most calls require `orgIdentifier` + `projectIdentifier`
- Tools should accept optional org/project params, defaulting to config values

**4. Error Handling Strategy**
- Harness API errors follow: `{ status: "ERROR", code: "...", message: "..." }`
- Map Harness error codes to MCP-friendly error messages
- Include the `correlationId` in error responses for debugging
- Never expose raw API keys or tokens in error output

---

## Harness API Reference

### Authentication
```
Header: x-api-key: <HARNESS_API_KEY>
Base URL: https://app.harness.io
```
- Personal API tokens or Service Account tokens
- Token created in Harness UI → User Profile → API Keys

### API Versioning
- **GA (stable)**: `https://app.harness.io/ng/api/...` (ng = next-gen)
- **v1 Beta**: `https://app.harness.io/v1/...`
- **Pipeline APIs**: `https://app.harness.io/pipeline/api/...`
- **Log Service**: `https://app.harness.io/gateway/log-service/...`
- Prefer v1 endpoints where available; fall back to ng/api

### Pagination
- Query params: `page` (0-indexed), `size` (default 30, max 100)
- v1 beta: `limit` (default 30, max 100) + `page` param
- Response headers: `X-Total-Elements`, `X-Page-Number`, `X-Page-Size`
- Execution summary API hard limit: 10,000 records max

### Core Endpoints to Wrap

| Domain | Method | Endpoint | Tool Name |
|--------|--------|----------|-----------|
| **Projects** | GET | `/ng/api/projects` | `list_projects` |
| **Projects** | GET | `/ng/api/projects/{projectId}` | `get_project` |
| **Pipelines** | GET | `/pipeline/api/pipelines/list` | `list_pipelines` |
| **Pipelines** | GET | `/pipeline/api/pipelines/{pipelineId}` | `get_pipeline` |
| **Pipelines** | POST | `/pipeline/api/pipelines/v2` | `create_pipeline` |
| **Pipelines** | PUT | `/pipeline/api/pipelines/v2/{pipelineId}` | `update_pipeline` |
| **Execute** | POST | `/pipeline/api/pipeline/execute/{pipelineId}` | `execute_pipeline` |
| **Execute** | PUT | `/pipeline/api/pipeline/execute/interrupt/{planExecutionId}` | `interrupt_execution` |
| **Executions** | POST | `/pipeline/api/pipelines/execution/summary` | `list_executions` |
| **Executions** | GET | `/pipeline/api/pipelines/execution/{planExecutionId}` | `get_execution` |
| **Logs** | POST | `/gateway/log-service/blob/download` | `get_execution_logs` |
| **Connectors** | GET | `/ng/api/connectors` | `list_connectors` |
| **Connectors** | GET | `/ng/api/connectors/{connectorId}` | `get_connector` |
| **Connectors** | POST | `/ng/api/connectors/testConnection/{connectorId}` | `test_connector` |
| **Services** | GET | `/ng/api/servicesV2` | `list_services` |
| **Services** | GET | `/ng/api/servicesV2/{serviceId}` | `get_service` |
| **Environments** | GET | `/ng/api/environmentsV2` | `list_environments` |
| **Environments** | GET | `/ng/api/environmentsV2/{envId}` | `get_environment` |
| **Secrets** | GET | `/ng/api/v2/secrets` | `list_secrets` |
| **Delegates** | GET | `/ng/api/delegate-group-ng/v2` | `list_delegates` |
| **Triggers** | GET | `/pipeline/api/triggers` | `list_triggers` |
| **Triggers** | POST | `/pipeline/api/triggers` | `create_trigger` |
| **Feature Flags** | GET | `/cf/admin/features` | `list_feature_flags` |
| **Feature Flags** | PATCH | `/cf/admin/features/{featureId}` | `toggle_feature_flag` |
| **Input Sets** | GET | `/pipeline/api/inputSets` | `list_input_sets` |

### Common Query Parameters (Always Required)
```typescript
interface HarnessScope {
  accountIdentifier: string;   // Always from config
  orgIdentifier?: string;      // Default from config, overridable
  projectIdentifier?: string;  // Default from config, overridable
}
```

---

## Tool Design Rules

### Naming Convention
- Use `snake_case` for tool names: `list_pipelines`, `get_execution_logs`
- Prefix with verb: `list_`, `get_`, `create_`, `update_`, `delete_`, `execute_`, `test_`
- Match Harness domain language exactly

### Input Schema Rules
- Every tool MUST have a Zod schema for inputs
- Import Zod 4: `import * as z from "zod/v4"` — never `import { z } from "zod"`
- Use `z.string().describe("...")` — descriptions are critical for LLM tool selection
- **CRITICAL**: Always call `.describe()` LAST in the chain — Zod 4 creates new schema instances per method call, so `.describe()` before `.optional()` or `.default()` will lose the description
- Correct: `z.string().min(1).describe("Org ID").optional()`
- Wrong: `z.string().describe("Org ID").min(1).optional()` (description lost)
- Optional params with sensible defaults: `org_id` defaults to env config
- Pagination params optional: `page` defaults to 0, `size` defaults to 20

### Output Rules
- Return structured JSON, not raw API responses
- Strip unnecessary metadata — return only what's actionable
- For list tools: return `{ items: [...], total: number, page: number }`
- For execution tools: return `{ executionId: string, status: string, url: string }`
- Include Harness UI deep links where possible: `https://app.harness.io/ng/#/account/{accountId}/...`
- Truncate large log outputs — provide summary + offer full retrieval

### Tool Annotations
```typescript
// Always set annotations for every tool
annotations: {
  title: "Human-readable tool name",
  readOnlyHint: true,  // for GET operations
  destructiveHint: true, // for DELETE operations
  idempotentHint: true, // for PUT operations
  openWorldHint: true,  // always true — talks to Harness API
}
```

### Safety Rules
- **NEVER** expose secret values — only metadata (name, type, scope)
- **NEVER** delete pipelines/services/environments without explicit confirmation flow
- **NEVER** auto-execute pipelines — always return the execution plan first
- Write operations require `confirmation: true` input param
- Rate limit to max 10 requests/second client-side

---

## Environment Configuration

```bash
# .env — required
HARNESS_API_KEY=pat.xxxxx.xxxxx.xxxxx           # Personal access token or SA token
HARNESS_ACCOUNT_ID=abc123xyz                    # Account identifier
HARNESS_BASE_URL=https://app.harness.io         # Override for self-managed

# .env — optional defaults
HARNESS_DEFAULT_ORG=default                     # Default org identifier
HARNESS_DEFAULT_PROJECT=                        # Default project identifier
HARNESS_API_TIMEOUT_MS=30000                    # Request timeout
HARNESS_MAX_RETRIES=3                           # Retry count for transient failures
LOG_LEVEL=info                                  # debug | info | warn | error
```

### Config Validation (config.ts)
```typescript
import * as z from "zod/v4";

export const ConfigSchema = z.object({
  HARNESS_API_KEY: z.string().min(1, "HARNESS_API_KEY is required"),
  HARNESS_ACCOUNT_ID: z.string().optional(),
  HARNESS_BASE_URL: z.string().url().default("https://app.harness.io"),
  HARNESS_DEFAULT_ORG_ID: z.string().default("default"),
  HARNESS_DEFAULT_PROJECT_ID: z.string().optional(),
  HARNESS_API_TIMEOUT_MS: z.coerce.number().default(30000),
  HARNESS_MAX_RETRIES: z.coerce.number().default(3),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  HARNESS_TOOLSETS: z.string().optional(),
  HARNESS_MAX_BODY_SIZE_MB: z.coerce.number().default(10),
  HARNESS_RATE_LIMIT_RPS: z.coerce.number().default(10),
  HARNESS_READ_ONLY: z.coerce.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;
```

---

## Logging Rules (CRITICAL)

> **STDIO transport uses stdin/stdout for JSON-RPC. Writing to stdout WILL break the server.**

```typescript
// ❌ NEVER — corrupts JSON-RPC protocol
console.log("anything");

// ✅ ALWAYS — stderr is safe
console.error("[INFO] Server started");

// ✅ BEST — use structured logger to stderr
import { createLogger } from "./utils/logger.js";
const log = createLogger("pipelines");
log.info("Fetched 42 pipelines");
log.error("Harness API error", { status: 401, correlationId: "abc" });
```

---

## HTTP Client Pattern

```typescript
class HarnessClient {
  private baseUrl: string;
  private token: string;
  private accountId: string;
  private timeout: number;
  private maxRetries: number;

  async request<T>(path: string, options?: RequestOptions): Promise<T> {
    // 1. Inject auth header: x-api-key
    // 2. Inject accountIdentifier query param
    // 3. Retry on 429 (rate limit) and 5xx with exponential backoff
    // 4. Parse response — handle both { status: "SUCCESS", data: ... }
    //    and { status: "ERROR", code: ..., message: ... }
    // 5. Throw typed HarnessApiError on failure
    // 6. Log request/response to stderr (debug level)
  }

  // Convenience methods
  async get<T>(path: string, params?: Record<string, string>): Promise<T>;
  async post<T>(path: string, body?: unknown): Promise<T>;
  async put<T>(path: string, body?: unknown): Promise<T>;
  async delete<T>(path: string): Promise<T>;
}
```

### Retry Strategy
- Retry on: HTTP 429, 500, 502, 503, 504
- Backoff: 1s → 2s → 4s (exponential with jitter)
- Max retries from config (default: 3)
- Never retry on: 400, 401, 403, 404

---

## Resource Definitions

Resources provide read-only data that LLMs can reference without tool calls.

```typescript
// Pipeline YAML as a resource
server.resource(
  "pipeline://{orgId}/{projectId}/{pipelineId}",
  "Pipeline YAML definition",
  async (uri) => ({
    contents: [{ uri, mimeType: "application/x-yaml", text: pipelineYaml }]
  })
);

// Recent executions as a resource
server.resource(
  "executions://{orgId}/{projectId}/recent",
  "Last 10 pipeline executions",
  async (uri) => ({
    contents: [{ uri, mimeType: "application/json", text: JSON.stringify(executions) }]
  })
);
```

---

## Prompt Templates

### Debug Failed Pipeline
```typescript
server.prompt(
  "debug-pipeline-failure",
  "Analyze a failed pipeline execution and suggest fixes",
  [
    { name: "executionId", description: "The failed execution ID", required: true },
    { name: "projectId", description: "Project identifier", required: false },
  ],
  async ({ executionId, projectId }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Analyze this failed Harness pipeline execution and provide:
1. Root cause of the failure
2. Which step failed and why
3. Suggested fix
4. Similar past failures if identifiable

Execution ID: ${executionId}
Project: ${projectId || "default"}

Use get_execution and get_execution_logs tools to gather context.`
      }
    }]
  })
);
```

---

## Testing Strategy

### Unit Tests
- Mock `HarnessClient` for all tool tests
- Test Zod schema validation (valid + invalid inputs)
- Test error mapping (Harness error codes → MCP errors)
- Test pagination assembly

### Integration Tests
- Use `@modelcontextprotocol/inspector` for end-to-end validation
- Mock Harness API with `msw` (Mock Service Worker)
- Test full tool lifecycle: input → API call → response mapping
- Test auth failure handling
- Test rate limit backoff

### Test Command
```bash
# Unit tests
pnpm test

# Integration with MCP Inspector
npx @modelcontextprotocol/inspector node build/index.js

# Type checking
pnpm typecheck
```

---

## Implementation Priority (Build Order)

### Phase 1: Foundation (Day 1)
- [ ] Project scaffolding (package.json, tsconfig, pnpm)
- [ ] Config validation with Zod
- [ ] HarnessClient with auth, retry, error handling
- [ ] Logger (stderr only)
- [ ] Server entrypoint with stdio transport

### Phase 2: Read Tools (Day 2)
- [ ] `list_projects` / `get_project`
- [ ] `list_pipelines` / `get_pipeline`
- [ ] `list_executions` / `get_execution`
- [ ] `get_execution_logs`
- [ ] `list_connectors` / `get_connector` / `test_connector`
- [ ] `list_services` / `get_service`
- [ ] `list_environments` / `get_environment`

### Phase 3: Write Tools (Day 3)
- [ ] `execute_pipeline` (with confirmation gate)
- [ ] `interrupt_execution`
- [ ] `create_pipeline` / `update_pipeline`
- [ ] `list_triggers` / `create_trigger`
- [ ] `toggle_feature_flag`

### Phase 4: Resources + Prompts (Day 4)
- [ ] Pipeline YAML resources
- [ ] Execution summary resources
- [ ] Debug prompt template
- [ ] Create pipeline prompt template
- [ ] Optimize pipeline prompt template

### Phase 5: Production Hardening (Day 5)
- [ ] Streamable HTTP transport for remote deployment
- [ ] Rate limiter implementation
- [ ] Comprehensive error mapping
- [ ] Full test suite
- [ ] README + usage docs
- [ ] npm package publishing config

---

## Server Instructions (Anti-Bloat Rules)

The MCP server exposes an `instructions` string (in `src/index.ts`) that is sent to every AI agent on session init. This is prime real estate — every token counts.

### Hard Rules

1. **Cap at ~20 lines.** The instructions block must stay under 20 lines / ~500 tokens. If it exceeds this, refactor — move detail into `harness_describe` output or tool descriptions instead.
2. **No per-resource documentation.** Never add resource-specific usage examples to server instructions. That belongs in `actionDescription`, `executeHint`, `diagnosticHint`, or `bodySchema.description` on the resource definition.
3. **No feature-specific instructions.** Features like input expansions, codebase shorthands, or store type defaults are documented via `inputExpansions` rules (surfaced through `harness_describe` as `inputShorthands`) and tool-level descriptions — not in the global instructions block.
4. **Only universal patterns.** Server instructions should only contain patterns that apply to ALL tools: URL shortcut, discovery via `harness_describe`, common resource groups.
5. **Prefer data over prose.** When adding agent-facing guidance, express it as structured metadata on `EndpointSpec` or `ResourceDefinition` (e.g., `inputExpansions`, `bodySchema`, `diagnosticHint`). The `harness_describe` tool auto-surfaces this — no manual docs to maintain.

### Where to Put New Agent Guidance

| Guidance type | Where it goes |
|---|---|
| Universal tool pattern (applies to all tools) | `instructions` in `src/index.ts` |
| Resource-specific operation details | `description` on the `EndpointSpec` |
| Execute action usage | `actionDescription` + `executeHint` on the resource |
| Input shorthands / expansions | `inputExpansions` on `EndpointSpec` (auto-surfaced) |
| Required fields / body format | `bodySchema` on the `EndpointSpec` |
| Debugging / troubleshooting | `diagnosticHint` on the resource |
| Filter fields for list operations | `listFilterFields` on the resource |

---

## Common Pitfalls to Avoid

| Pitfall | Fix |
|---------|-----|
| `console.log()` in stdio mode | Use `console.error()` or stderr logger ONLY |
| Forgetting `accountIdentifier` param | Inject from config in HarnessClient automatically |
| Raw API response passthrough | Always map to clean, typed output objects |
| Exposing secret values | Only return secret metadata (name, type, scope) |
| Unbounded list queries | Always paginate, default size=20, max=100 |
| No retry on rate limits | Implement exponential backoff on HTTP 429 |
| Hardcoded base URL | Use config — self-managed Harness uses different URLs |
| Using `return` in tool handlers | MCP SDK expects last expression, not return |
| Missing tool descriptions | Every param needs `.describe()` — LLMs depend on it |
| Monolithic tool file | Split by domain (pipelines, connectors, etc.) |
| `.describe()` before `.optional()` | Zod 4 creates new instances — always call `.describe()` LAST in the chain |
| `import { z } from "zod"` | Use `import * as z from "zod/v4"` for explicit Zod 4 API |
| `error.errors` on ZodError | Zod 4 uses `error.issues` (`.errors` is removed) |
| `message` param for custom errors | Zod 4 uses unified `error` param: `z.string().min(5, { error: "Too short" })` |
| Adding docs to server `instructions` | Put resource-specific guidance in `actionDescription`, `executeHint`, `bodySchema`, or `inputExpansions` instead |
| Hardcoding input transformations | Use declarative `inputExpansions` on `EndpointSpec` — data, not code |

---

## Quick Reference: MCP SDK Patterns

### Register a Tool
```typescript
import * as z from "zod/v4";

server.registerTool(
  "harness_list",
  {
    description: "List Harness resources by type with filtering and pagination",
    inputSchema: {
      resource_type: z.string().describe("The type of resource to list (e.g. pipeline, service, environment)").optional(),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      page: z.number().describe("Page number, 0-indexed").default(0).optional(),
      size: z.number().min(1).max(100).describe("Page size (1–100)").default(20).optional(),
      search_term: z.string().describe("Filter results by name or keyword").optional(),
    },
    annotations: {
      title: "List Harness Resources",
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async (args) => {
    const result = await registry.dispatch(client, args.resource_type, "list", args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);
```

### Server Entrypoint
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "harness-mcp-server",
  version: "1.0.0",
  capabilities: { tools: {}, resources: {}, prompts: {} },
});

registerTools(server, registry, client);
registerResources(server, client);
registerPrompts(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[harness-mcp] Server connected via stdio");
```

### Zod 4 Import Convention
```typescript
// ✅ Always use the explicit v4 subpath
import * as z from "zod/v4";

// ❌ Never use the bare import — ambiguous across Zod versions
import { z } from "zod";
```

---

## Claude Code Integration

Add to Claude Desktop config (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "harness": {
      "command": "node",
      "args": ["/path/to/harness-mcp-server/build/index.js"],
      "env": {
        "HARNESS_API_KEY": "pat.xxx.xxx.xxx",
        "HARNESS_ACCOUNT_ID": "your-account-id",
        "HARNESS_DEFAULT_ORG": "default",
        "HARNESS_DEFAULT_PROJECT": "your-project"
      }
    }
  }
}
```

---

## References

- Harness API Docs: https://apidocs.harness.io/
- Harness Developer Hub: https://developer.harness.io/docs/
- Harness API Quickstart: https://developer.harness.io/docs/platform/automation/api/api-quickstart/
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- MCP Specification: https://modelcontextprotocol.io/specification/latest
- MCP Build Server Guide: https://modelcontextprotocol.io/docs/develop/build-server
- MCP Inspector: https://github.com/modelcontextprotocol/inspector
