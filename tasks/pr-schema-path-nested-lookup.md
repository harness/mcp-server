# PR: fix: resolve nested harness_schema paths like EnvironmentV1

**Branch:** `fix/schema-path-nested-lookup`  
**Base:** `main`

## Summary

- Add recursive schema path navigation for `harness_schema` so nested type definitions are discoverable by single-segment paths (e.g. `EnvironmentV1` under `pipeline_v1`)
- Fixes `Path 'EnvironmentV1' not found in pipeline_v1 schema` when agents call `harness_schema(resource_type="pipeline_v1", path="EnvironmentV1")`
- Extracts navigation logic to `src/utils/schema-path-navigation.ts` with unit tests

## How schema path lookup works

When an agent calls `harness_schema(resource_type="pipeline_v1", path="...")`, the server walks the schema tree under `definitions.pipeline_v1` in three steps:

```
definitions.pipeline_v1
├── pipeline          ← top-level key
├── Clone
├── stages
│   └── unified
│       └── EnvironmentV1   ← nested, NOT at top level
└── ...
```

### 1. Direct key lookup — `resourceDefs[path]`

Looks for `path` as an immediate child of `definitions.<resource_type>`.

**Works:**

- `harness_schema(resource_type="pipeline_v1", path="pipeline")` → `definitions.pipeline_v1.pipeline`
- `harness_schema(resource_type="trigger", path="trigger_source")` → `definitions.trigger.trigger_source`

**Fails (moves to step 2):**

- `harness_schema(resource_type="pipeline_v1", path="EnvironmentV1")` — no top-level `EnvironmentV1` key

### 2. Dot-separated path traversal

Splits `path` on `.` and walks one level at a time from `definitions.<resource_type>`.

**Works:**

- `harness_schema(resource_type="pipeline_v1", path="stages.unified.EnvironmentV1")`
  - `stages` → `unified` → `EnvironmentV1` ✓

**Fails for single-segment nested names (moves to step 3):**

- `path="EnvironmentV1"` with no dots — same as step 1 for this case

### 3. Nested fallback (new)

If steps 1–2 fail and `path` has **no dots**, depth-first search the tree for a key matching `path` whose value is a schema definition.

**Works (this was the bug):**

- `harness_schema(resource_type="pipeline_v1", path="EnvironmentV1")`
  - Finds `definitions.pipeline_v1.stages.unified.EnvironmentV1` without requiring the full dot path

| Call | Step 1 (direct) | Step 2 (dots) | Step 3 (nested) |
|------|-----------------|---------------|-----------------|
| `path="pipeline"` | ✅ | — | — |
| `path="trigger_source"` (trigger) | ✅ | — | — |
| `path="stages.unified.EnvironmentV1"` | ❌ | ✅ | — |
| `path="EnvironmentV1"` | ❌ | ❌ | ✅ (new) |

Existing behavior for paths that already worked is unchanged. Step 3 only adds support for nested type names agents use without knowing the full dot path.

## Test plan

- [x] `pnpm test tests/utils/schema-path-navigation.test.ts`
- [x] `pnpm typecheck`
- [ ] Verify `harness_schema(resource_type="pipeline_v1", path="EnvironmentV1")` returns the environment definition in MCP Inspector
