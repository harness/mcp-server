# PR #149 Review: Agent Pipelines Tools/Resources/Prompt

**PR**: https://github.com/thisrohangupta/harness-mcp-v2/pull/149
**Author**: @patelraj0602
**+5719 / -4** across 8 files

---

## Summary

This PR adds first-class support for AI agent pipelines — a new Harness feature. It includes:

1. **New toolset** (`agent-pipelines`) with `agent` and `agent_run` resource types
2. **New JSON Schema** (`agent-pipeline.ts`) for agent pipeline YAML validation via `harness_schema`
3. **New prompt** (`create-agent`) for guided agent creation
4. **Schema tool updates** to reference the new agent-pipeline schema in descriptions

---

## Verdict: Generally Follows Standards, but Has Functional Issues

The PR largely follows the established codebase structure and conventions. However, there are several functional bugs, missing patterns, and a few architectural concerns that should be addressed before merging.

---

## What Matches Standards Well

| Area | Assessment |
|------|-----------|
| **Toolset structure** | Correctly follows `ToolsetDefinition` with `name`, `displayName`, `description`, `resources` |
| **ResourceDefinition fields** | Uses correct `resourceType`, `displayName`, `description`, `toolset`, `scope`, `identifierFields`, etc. |
| **BodySchema definitions** | Properly typed with `description` and `fields: BodyFieldSpec[]` |
| **Prompt pattern** | Uses `registerCreateAgentPrompt(server)` naming, correct registration pattern |
| **Zod import** | Uses `import * as z from "zod/v4"` correctly |
| **Type-only imports** | Uses `import type` where appropriate |
| **ESM extensions** | All imports use `.js` extensions |
| **ToolsetName type** | Correctly extends the union type in `types.ts` |
| **Schema index** | Follows the existing pattern: default import, add to `SCHEMAS` object |
| **Registry registration** | Correctly imports and adds to `ALL_TOOLSETS` |

---

## Issues Found

### P0: Functional Bugs

#### 1. `listFilterFields` Advertised but Not Mapped to `queryParams`

The `agent` resource advertises `role` and `status` filters in `listFilterFields`, but these are **not mapped** in the list operation's `queryParams`:

```typescript
// Advertised filters (shown to agents via harness_describe):
listFilterFields: [
  { name: "search_term", description: "Filter agents by name or keyword" },
  { name: "role", description: "Filter by agent role", enum: ["system", "custom"] },
  { name: "status", description: "Filter by agent status", enum: ["active", "inactive", "deleted"] },
],

// Actual queryParams (only search_term is wired up):
queryParams: {
  search_term: "searchTerm",
  // role and status are MISSING
},
```

**Impact**: `harness_describe` will tell agents these filters exist, but when agents pass `role="system"` or `status="active"`, the values are silently dropped. This is a misleading contract.

**Fix**: Either add `role: "role"` and `status: "status"` to `queryParams`, or remove them from `listFilterFields` if the API doesn't support server-side filtering.

---

### P1: Missing Patterns

#### 2. `passthrough` Extractor Used for All Operations

Every operation uses `passthrough` as the response extractor. Existing toolsets use `ngExtract`, `pageExtract`, `v1ListExtract()` etc. to:
- Strip wrapper metadata from responses
- Normalize list pagination into `{ items, total, page }` structure
- Return only actionable data

The CLAUDE.md states: *"Strip unnecessary metadata — return only what's actionable."*

**Fix**: Determine the actual response shape from the agents API and use/create appropriate extractors. If the API already returns clean responses, document why `passthrough` is intentional.

#### 3. No Pagination Support on List Operations

Neither `agent` list nor `agent_run` list map `page`/`size` query parameters. All other list operations in the codebase support pagination via `page` and `size` (or `limit`) query params.

**Fix**: Add `page: "page"` and `size: "size"` (or whatever the agents API uses) to `queryParams` for both list operations.

#### 4. Missing `diagnosticHint` on Both Resources

Most non-trivial resources in the codebase include a `diagnosticHint` to help LLMs troubleshoot issues. Neither `agent` nor `agent_run` has one.

**Suggested**:
```typescript
diagnosticHint: "If agent creation fails, verify: (1) uid is unique and uses only lowercase/underscores, (2) spec is valid YAML matching agent-pipeline schema, (3) connectors referenced in spec exist. Use harness_schema(resource_type='agent-pipeline') to validate YAML structure."
```

#### 5. Missing `relatedResources` Between `agent` and `agent_run`

These two resources are clearly related but don't declare it. The `relatedResources` field helps LLMs understand the resource graph.

**Suggested** (on `agent`):
```typescript
relatedResources: [
  { resourceType: "agent_run", relationship: "child", description: "Execution runs for this agent" },
  { resourceType: "pipeline", relationship: "related", description: "Agents extend pipeline constructs" },
],
```

---

### P2: Architectural Concerns

#### 6. Prompt is Excessively Long (584 Lines)

The `create-agent.ts` prompt is 584 lines — roughly 8x the size of `create-pipeline.ts` (73 lines). The Server Instructions Anti-Bloat Rules state:

> *"No per-resource documentation. That belongs in `actionDescription`, `executeHint`, `diagnosticHint`, or `bodySchema.description` on the resource definition."*

Much of the prompt content is reference documentation (default configurations, YAML examples, MCP server setup guides, expression syntax) that should live in:
- `executeHint` / `diagnosticHint` on the resource definition
- `bodySchema.description` for field-level guidance
- `actionDescription` on execute actions
- The `harness_schema` tool output (which already exposes the schema)

**Recommendation**: Trim the prompt to ~100-150 lines of **workflow guidance** (phases 1-5 steps). Move reference material to resource metadata where it's surfaced via `harness_describe`.

#### 7. Schema File Uses Manual Restructuring Hack

The `agent-pipeline.ts` schema does a manual restructure at the bottom:

```typescript
const restructuredSchema = {
  ...schema,
  title: "agent-pipeline",
  definitions: {
    "agent-pipeline": schema.definitions.pipeline
  }
};
```

The existing schemas (pipeline, template, trigger) don't need this because their `title` matches the definition root key. This means the upstream schema source uses `pipeline` as the definition key even for agent pipelines.

**Suggestion**: If feasible, update `scripts/sync-schemas.js` to handle this remapping during sync so the schema file stays auto-generated. If not feasible, the current approach is acceptable but should be documented in the sync script.

#### 8. Commented-Out Execute Action

The `executeActions` section is entirely commented out with `// TODO: Re-enable once backend is ready`. While this is transparent, it means:
- The `agentExecuteSchema` const is defined but never used (dead code)
- The `executeHint` on the resource references execution but execution isn't available

**Fix**: Either remove `agentExecuteSchema` and `executeHint` until the backend is ready, or keep them but add a note in `executeHint` that execution is coming soon.

---

### P3: Minor Issues

#### 9. `@ts-nocheck` on Schema File

The schema file uses `@ts-nocheck` and `Record<string, any>`. This is consistent with the existing schema files (pipeline, template, trigger all likely use this pattern for auto-generated JSON Schema data), so it's acceptable.

#### 10. Schema Tool Description Hardcodes Path Examples

The changes to `harness-schema.ts` hardcode schema-specific path examples:

```typescript
"For 'agent-pipeline': path='Agent' (agent structure), path='stages' (stage definitions), path='steps' (step types). " +
```

This goes against the "data over prose" principle — every new schema would require updating this description string. Ideally, the summary output from `getSummary()` already surfaces available sections, making these hardcoded examples redundant.

**Suggestion**: Keep the generic description and let `getSummary()` do its job. At most, add `"agent-pipeline"` to the example in the main description.

#### 11. `generateAgentUid` Helper in Toolset File

The `generateAgentUid` function adds business logic to the toolset file. Existing toolsets keep `bodyBuilder` logic minimal. This is minor since the function is small and self-contained, but it could be a utility function in `src/utils/` if reuse is anticipated.

---

## File-by-File Summary

| File | Verdict | Notes |
|------|---------|-------|
| `src/data/schemas/agent-pipeline.ts` | **Acceptable** | Large auto-generated schema; `@ts-nocheck` consistent with pattern; manual restructure is documented |
| `src/data/schemas/index.ts` | **Good** | Follows exact existing pattern |
| `src/prompts/create-agent.ts` | **Needs work** | Way too long; reference docs should move to resource metadata |
| `src/prompts/index.ts` | **Good** | Follows existing pattern; import placement is correct |
| `src/registry/index.ts` | **Good** | Follows existing pattern; placement after `pipelinesToolset` makes sense |
| `src/registry/toolsets/agent-pipelines.ts` | **Needs fixes** | Functional bugs with filters; missing pagination, diagnosticHint, relatedResources; passthrough extractors |
| `src/registry/types.ts` | **Good** | Correctly adds to ToolsetName union |
| `src/tools/harness-schema.ts` | **Minor issue** | Hardcoded path examples; better to keep generic |

---

## Checklist Status from PR Template

- [ ] **Tests pass** — No tests added for the new toolset, prompt, or schema. Should have at minimum: schema loading test, toolset registration test, prompt registration test.
- [ ] **Typecheck passes** — The schema file uses `@ts-nocheck`, so it will pass typecheck but bypasses type safety.

---

## Fixes Applied

All issues except test coverage have been addressed in follow-up commits:

1. **Fixed `listFilterFields` / `queryParams` mismatch** — wired up `role`, `status` filters to queryParams
2. **Added pagination support** — `page`/`size` params on both list operations
3. **Added `diagnosticHint`** to both `agent` and `agent_run` resources
4. **Added `relatedResources`** linking agent ↔ agent_run and agent → pipeline
5. **Trimmed the prompt** from 584 → ~85 lines; moved reference docs to resource metadata
6. **Removed dead code** — `agentExecuteSchema` and `executeHint` removed (execute action is commented out)
7. **Replaced blanket `passthrough` extractors** — agent list uses `v1ListExtract()`, agent_run uses custom `{items, total}` extractor
8. **Cleaned up harness-schema.ts** — removed hardcoded per-schema path examples, kept dynamic descriptions
9. **Typecheck passes** ✅ and **all 681 tests pass** ✅

### Remaining: tests for the new toolset and prompt (not addressed — low risk since these are declarative definitions)
