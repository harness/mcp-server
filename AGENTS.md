# AGENTS.md — Harness.io MCP Server

Registry-based MCP server: 11 consolidated tools (`harness_list`, `harness_get`, `harness_create`, `harness_update`, `harness_delete`, `harness_execute`, `harness_search`, `harness_describe`, `harness_diagnose`, `harness_status`, `harness_schema`) dispatching across 219+ resource types. TypeScript (Node.js 20+), ESM, pnpm, Zod v4.

---

## Commands

```bash
pnpm install           # install deps
pnpm build             # tsc → build/
pnpm dev               # tsc --watch
pnpm typecheck         # tsc --noEmit
pnpm test              # vitest run (118 test files, 2510 tests, ~9s)
pnpm standards:check   # run coding-standards and structural validation tests
pnpm start             # stdio transport (requires HARNESS_API_KEY)
pnpm start:http        # HTTP transport (node build/index.js http)
pnpm inspect           # MCP Inspector against stdio build
pnpm docs:generate     # generate docs from build/ — run pnpm build first
pnpm docs:check        # CI check (reads build/); stale build = wrong count and CI fail
```

---

## Project Structure

```
src/
├── index.ts            # Entrypoint — stdio/HTTP transport setup
├── config.ts           # Env var validation (Zod); see .env.example for all vars
├── registry/
│   ├── index.ts        # Core dispatch (~50K) — ResourceDefinition, EndpointSpec
│   ├── types.ts        # Registry types: ResourceDefinition, EndpointSpec, OperationPolicy
│   ├── extractors.ts   # Response shape extractors for all resource types
│   ├── scope-utils.ts  # Scope resolution utilities
│   └── toolsets/       # 41 declarative toolset definition files (pure data — add new resources here)
├── tools/              # 11 consolidated tool handlers
├── prompts/            # ~33 prompt templates (one per workflow)
├── resources/          # MCP resources (pipeline YAML, execution summary)
├── client/
│   └── harness-client.ts  # HTTP client — auth, retry, pagination
├── data/               # Example data and JSON schemas for entity validation
├── search/             # Cross-resource keyword search
├── audit/              # Audit manager
└── utils/              # Errors, logger, elicitation, deep-links, body normalizer
```

---

## Non-Obvious Patterns

### Logging — stdout is the JSON-RPC wire

Stdio transport uses stdin/stdout for JSON-RPC. A single `console.log()` corrupts the protocol silently.

```typescript
// ❌ NEVER — corrupts JSON-RPC
console.log("anything");

// ✅ ALWAYS — stderr is safe
import { createLogger } from "./utils/logger.js";
const log = createLogger("component-name");
log.info("message", { field: "value" });
```

### Zod v4 — .describe() must be LAST

```typescript
import * as z from "zod/v4";   // always explicit subpath — never import { z } from "zod"

z.string().min(1).optional().describe("Org ID")  // ✅ description survives
z.string().describe("Org ID").min(1).optional()  // ❌ description lost — each call creates a new instance
```

### Adding a new Harness resource

Add a declarative toolset file in `src/registry/toolsets/` — no new tool registration, no schema changes, no prompt updates needed. The 11 tools stay fixed; dispatch is data-driven. Do NOT add per-endpoint tool handlers.

### docs:generate requires a fresh build

`pnpm docs:generate` reads from `build/`. Running it against a stale build produces wrong resource counts and fails `docs:check` in CI.

```bash
pnpm build && pnpm docs:generate   # always pair them
```

### HARNESS_API_KEY is optional in multi-user mode

Single-user mode: `HARNESS_API_KEY` required, used for every session.
Multi-user mode (`HARNESS_MCP_MODE=multi-user`): `HARNESS_API_KEY` must NOT be set; sessions supply credentials via `x-harness-api-key` header.

PAT/SAT tokens embed the account ID (`pat.<accountId>.<tokenId>.<secret>`), so `HARNESS_ACCOUNT_ID` is only needed when the key lacks an embedded segment.

---

## Task Tracking

This repo uses `tasks/` for agent task management:

- `tasks/todo.md` — write the plan here before starting; mark items complete as you go
- `tasks/lessons.md` — append a lesson after any correction or mistake; read it at the start of a session if working on a known problem area

---

## Key Environment Variables

See `.env.example` for the full list. Non-obvious ones:

| Var | Purpose |
|-----|---------|
| `HARNESS_MCP_MODE` | `single-user` (default) or `multi-user` |
| `HARNESS_TOOLSETS` | Comma-separated toolset names to restrict exposed tools |
| `HARNESS_READ_ONLY` | Block all write operations (`true`/`false`) |
| `HARNESS_AUTO_APPROVE_RISK` | Auto-approve operations at or below this risk level (`none` \| `read` \| `low_write` \| `medium_write` \| `high_write` \| `destructive` \| `all`; default `none`) |
| `HARNESS_FME_API_KEY` | Feature Management Engine (Split.io) key; falls back to `HARNESS_API_KEY` if unset |
| `HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP` | Set `true` for local HTTP dev without auth token |
| `HARNESS_MCP_ALLOWED_HOSTS` | Comma-separated allowed hostnames for HTTP Host-header validation |
| `HARNESS_MCP_TRUST_PROXY` | Reverse proxy/load-balancer hop count for client IP resolution (default `0`) |
| `HARNESS_ALLOW_HTTP` | Allow non-HTTPS base URL (default `false`) |

Deprecated aliases (still work, emit deprecation warning to stderr):
- `HARNESS_DEFAULT_ORG_ID` → use `HARNESS_ORG`
- `HARNESS_DEFAULT_PROJECT_ID` → use `HARNESS_PROJECT`

---

## Key Files

- `src/config.ts` — Full Zod schema with all env vars, validation rules, and deprecation handling
- `src/registry/index.ts` — Registry dispatch; read before modifying any resource definition
- `src/registry/types.ts` — `ResourceDefinition`, `EndpointSpec`, `OperationPolicy` types
- `src/tools/index.ts` — The 11 tool registrations
- `.env.example` — All supported env vars with documentation

---

## Boundaries

### ✅ Safe to run without asking
- `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm inspect`
- `pnpm docs:generate` (after `pnpm build`)

### ⚠️ Ask first
- Add or remove npm packages
- Change public tool contract (tool names, input/output schema) in `src/tools/`
- Add new tool handlers (vs. adding a declarative toolset in `src/registry/toolsets/`)

### 🚫 Never
- Use `console.log()` — stdout is the JSON-RPC transport
- Use `import { z } from "zod"` — always `import * as z from "zod/v4"`
- Put `HARNESS_API_KEY` in multi-user mode deployment
- Put internal Jira ticket IDs in PR titles, descriptions, or commit messages — describe the user-facing change
- Run `pnpm docs:generate` without `pnpm build` first
