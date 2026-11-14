# Issue 007: Stale Contribution Guides, Broken Code Examples in `CONTRIBUTING.md`, and Outdated Architecture Documentation

**Status:** Fixed in `fix/registry-taxonomy-and-dispatch-guardrails`
**Date:** 2026-11-13
**Related:** `CONTRIBUTING.md`, `AGENTS.md`, `docs/architecture.md`, `docs/coding-standards.md`, `docs/gemini.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `scripts/generate-docs.js`

---

## 1. Problem Statement

Auditing the repository's contributor, agent, and architecture documentation revealed multiple places where the documentation either lagged several releases behind the runtime or showed code examples that violated the repository's own enforced standards:

| File | Finding | Impact |
|---|---|---|
| `CONTRIBUTING.md:194` | Showed `optionalParam: z.string().describe("Optional context").optional()` — placing `.describe()` **before** `.optional()` | Directly violates Coding Standard Rule 8 (`AGENTS.md:72`, `docs/coding-standards.md:119`): in Zod v4, `.optional()` creates a new wrapper instance and strips the `.describe()` metadata from the MCP schema |
| `CONTRIBUTING.md:85` & `docs/coding-standards.md:220` | Showed `listFilterFields: ["search_term"]` (`string[]`) in the "Adding a New Resource" template | Does not compile under TypeScript (`listFilterFields` is `FilterFieldSpec[]`: `[{ name: "search_term", description: "..." }]`) |
| `CONTRIBUTING.md` | Had zero mention of `EndpointSpec.scope`, `compactItem` / `skipCompact` on `harness_list`, `HARNESS_SCHEMA_MODE=compact` budget, or the rule against 1-endpoint-per-`resource_type` sprawl | Contributors repeatedly hit missing fields under default compaction or created separate `*_detail` / `*_stats` / `*_v3` resource types |
| `docs/architecture.md:3` | Linked to `[Spec 001](../specs/001-registry-contract.md)` | Broken link (`specs/` directory does not exist) |
| `docs/architecture.md:11, 239-245` | Stated `operationPolicy.retryPolicy` is *"declared on every spec but NOT yet consumed by the HTTP client (Future: P5)"* | False — `Registry.executeSpec` forwards `retryPolicy` and `HarnessClient.isSafeRetry()` (`src/client/harness-client.ts:174`) actively enforces it |
| `docs/architecture.md:95` | Stated `harness_delete` uses `Hardcoded risk: "destructive"` | Fixed in `src/tools/harness-delete.ts:96` to read `def.operations.delete!.operationPolicy.risk` |
| `docs/architecture.md:195` | Stated `HarnessClientInterface` omits `request()` and requires double-casting `client as unknown as HarnessClient` | False — `HarnessClientInterface` (`src/registry/types.ts:82-88`) declares both `getCurrentUserId()` and `request<T>(options: RequestOptions): Promise<T>` |
| `docs/architecture.md:169, 255, 266` | Stated `31 toolset files` and referenced `HARNESS_AUTONOMOUS_MODE` | There are 50 toolset files, and the actual env var is `HARNESS_AUTO_APPROVE_RISK` |
| `AGENTS.md:3, 36, 129` | Listed `219+ resource types`, `45 declarative toolset definition files`, omitted `oauth-proxy` from `HARNESS_MCP_MODE`, and noted manual README regex gaps | Outdated counts and missing taxonomy/compaction rules |
| `docs/gemini.md:3` | Hardcoded `202 resource types across 33 default toolsets` | Not wired into `scripts/generate-docs.js`, so it drifted by 72 resource types and 11 toolsets |
| `.github/PULL_REQUEST_TEMPLATE.md` | Only checked basic registry plumbing; did not check resource taxonomy consolidation (`EndpointSpec.scope`, `executeActions`, no `_v1`/`_v2`/`_v3` suffixes) or `compactItem` | Reviewers had to catch endpoint-as-resource sprawl manually |

---

## 2. Fixes Implemented in This Branch

1. **`CONTRIBUTING.md` & `docs/coding-standards.md`:**
   - Fixed the `listFilterFields` example to use `FilterFieldSpec[]` (`[{ name: "search_term", description: "..." }]`).
   - Fixed the Zod v4 prompt `argsSchema` example to chain `.describe()` **last** (`z.string().optional().describe("Optional context")`).
   - Added §6 in `CONTRIBUTING.md` and §13–§14 in `docs/coding-standards.md` covering resource taxonomy, `EndpointSpec.scope`, `compactItem` / `skipCompact`, and toolset content boundaries.
2. **`docs/architecture.md`:**
   - Removed the broken `../specs/001-registry-contract.md` link and obsolete "Future: P5" / `HARNESS_AUTONOMOUS_MODE` sections.
   - Updated `harness_delete`, `HarnessClientInterface`, `EndpointSpec.scope`, `HarnessClient` retry behavior, and the 50-toolset count.
3. **`AGENTS.md`, `docs/gemini.md`, `.github/PULL_REQUEST_TEMPLATE.md`, and `scripts/generate-docs.js`:**
   - Updated `AGENTS.md` with current counts (274+ default / 318+ total resource types across 50 toolsets), `oauth-proxy` mode, and taxonomy/compaction rules.
   - Wired `docs/gemini.md` and the architecture diagram's `| N Toolsets (M default) |` pattern into `scripts/generate-docs.js` so `pnpm docs:generate` and `pnpm docs:check` keep them automatically synchronized.
   - Added resource taxonomy and `compactItem` checks to `.github/PULL_REQUEST_TEMPLATE.md`.
