# Issue 004: `harness_describe(toolset=...)` Payload Bloat (108.9 KB Single-Call Dump for `chaos`)

**Status:** Fixed in `fix/registry-taxonomy-and-dispatch-guardrails`
**Date:** 2026-11-13
**Related:** `src/tools/harness-describe.ts`, `src/registry/index.ts`, `docs/schema-budget.md`

---

## 1. Problem Statement

`docs/schema-budget.md` carefully budgets `tools/list` (≤ 22.5 KB in compact mode) and `harness_describe(operation=...)` (reducing catalog payloads from 38.1 KB to 10.6–20.5 KB).

However, when an agent calls `harness_describe(toolset="<name>")` (without `operation`), `src/tools/harness-describe.ts:119-130` previously called `registry.describe()`, which serialized the **entire uncompacted definition** of every resource in that toolset — including multi-paragraph `description`s, 2,000-character `diagnosticHint` playbooks, `relatedResources` graphs, and all `listFilterFields` with full enum arrays.

### Empirical Payload Sizes Before Fix (`main` @ `v3.2.41`)

| Tool Call | Bytes Returned | Approx. Tokens | Comparison |
|---|---:|---:|---|
| `harness_describe()` (no args — all 44 default toolsets) | 38,156 B | ~9,500 | Baseline summary of 274 resources |
| `harness_describe(operation="list", toolset="chaos")` | 2,869 B | ~715 | Compact operation-filtered view |
| **`harness_describe(toolset="chaos")`** | **108,961 B** | **~27,240** | **2.85× larger than the entire 44-toolset summary** |
| **`harness_describe(toolset="scs")`** | **38,915 B** | **~9,730** | Larger than all 44 default toolsets combined |
| **`harness_describe(toolset="ccm")`** | **25,801 B** | **~6,450** | 25 resources with full filter enums |
| **`harness_describe(toolset="gitops")`** | **20,544 B** | **~5,135** | 17 resources with full filter/hint dumps |
| **`harness_describe(toolset="ai-evals")`** | **18,622 B** | **~4,655** | 19 resources |
| **`harness_describe(toolset="feature-flags")`** | **18,342 B** | **~4,585** | 19 resources |
| **Sum across all 50 toolsets** | **411,731 B** | **~102,930** | Unbounded per-resource detail in toolset listing |

When an LLM called `harness_describe(toolset="chaos")` to see which resource types belong to the `chaos` toolset, it paid **~27,240 input tokens** on the very next turn — wiping out the token savings of `HARNESS_SCHEMA_MODE=compact` (`docs/schema-budget.md` recorded Sonnet 5.5 averaging 24.9k input tokens *across an entire multi-turn task*).

---

## 2. Solution & Measured Benefit

In `Registry.describeToolset(toolsetName, compact)` (`src/registry/index.ts`) and `src/tools/harness-describe.ts`:
- `registry.describe()` (the programmatic API used by internal callers and structural tests) remains 100% unchanged.
- When `harness_describe(toolset="<name>")` is called in `compact` schema mode (`registry.compactSchemas`), each resource entry in the toolset listing includes its discovery fields (`resource_type`, `displayName`, `description` truncated to the first sentence / ≤ 200 chars, `scope`, `supportedScopes`, `operations`, `executeActions`, `identifierFields`, and `aliases`) and omits the heavy per-resource `listFilterFields`, `diagnosticHint`, and `relatedResources` (with a `hint` pointing to `harness_describe(resource_type="<type>")` for full details on a specific resource).

### Before vs. After Payload Sizes (`compact` mode)

| Tool Call | Before (Bytes) | After (Bytes) | Reduction |
|---|---:|---:|---:|
| `harness_describe(toolset="chaos")` | 108,961 B | **14,582 B** | **-86.6% (-94.4 KB)** |
| `harness_describe(toolset="scs")` | 38,915 B | **9,036 B** | **-76.8% (-29.9 KB)** |
| `harness_describe(toolset="ccm")` | 25,801 B | **6,988 B** | **-72.9% (-18.8 KB)** |
| `harness_describe(toolset="gitops")` | 20,544 B | **4,886 B** | **-76.2% (-15.7 KB)** |
| `harness_describe(toolset="ai-evals")` | 18,622 B | **5,359 B** | **-71.2% (-13.3 KB)** |
| `harness_describe(toolset="feature-flags")` | 18,342 B | **5,668 B** | **-69.1% (-12.7 KB)** |
| `harness_describe(toolset="sto")` | 16,107 B | **2,696 B** | **-83.3% (-13.4 KB)** |
| `harness_describe(toolset="iacm")` | 11,359 B | **2,425 B** | **-78.7% (-8.9 KB)** |
| **Sum across all 50 toolsets** | **412,120 B** | **108,172 B** | **-73.8% (-303.9 KB)** |
