# Spec 001: Registry as Contract — OperationPolicy

**Status:** Draft
**Author:** Quality Review Follow-up
**Date:** 2026-05-02
**Depends on:** None (foundational)
**Unblocks:** P3 (fail-closed elicitation), P4 (autonomous modes), P5 (retry policy), P10 (write quality contract)

---

## Problem

The registry dispatches operations but does not enforce a contract. There is no concept of how risky an operation is, whether it should retry on failure, or what confirmation behavior applies. The only safety signal is a boolean `blockWithoutConfirmation` on `EndpointSpec`, which is set on exactly 4 out of ~175 endpoint specs.

Consequences:
- Execute actions like `pipeline.run`, `gitops_application.sync`, and `fme_feature_flag.kill` proceed without confirmation on clients that lack MCP elicitation (Claude Desktop, Windsurf).
- The HTTP client retries all operations identically, including non-idempotent POST creates — risking duplicate resources.
- There is no shared vocabulary for risk, so each new tool handler reinvents its own safety logic.

## Solution

Add a required `OperationPolicy` to every `EndpointSpec`. The policy declares the risk level and retry behavior for each operation. Tool handlers and the HTTP client read the policy instead of ad-hoc booleans.

## Type Definitions

All types are added to `src/registry/types.ts`.

### RiskLevel

```typescript
export type RiskLevel =
  | "read"            // No side effects (list, get, diff, blame)
  | "low_write"       // Reversible, low blast radius (most creates/updates)
  | "medium_write"    // Meaningful impact, may need review (stop, interrupt, config changes)
  | "high_write"      // Production impact (run pipeline, sync gitops, toggle FF, approve)
  | "destructive";    // Irreversible (all deletes)
```

### RetryPolicy

```typescript
export type RetryPolicy =
  | "safe"                      // Retry freely (GET, idempotent PUT)
  | "idempotency_key_required"  // Retry only with a stable key (future — for APIs that support it)
  | "do_not_retry";             // Surface failure to caller, no automatic retry (non-idempotent POST, DELETE)
```

### OperationPolicy

```typescript
export interface OperationPolicy {
  risk: RiskLevel;
  retryPolicy: RetryPolicy;
}
```

### Helper

```typescript
/**
 * Returns true when the risk level requires blocking the operation
 * if user confirmation cannot be obtained (e.g. client lacks elicitation).
 */
export function isBlockingRisk(risk: RiskLevel): boolean {
  return risk === "high_write" || risk === "destructive";
}
```

## Changes to EndpointSpec

```diff
 export interface EndpointSpec {
   method: HttpMethod;
   path: string;
+  /** Declares the risk level and retry behavior for this operation. */
+  operationPolicy: OperationPolicy;
   // ... all other fields unchanged ...
-  /**
-   * When true, block the operation if user confirmation cannot be obtained.
-   * Used for high-risk operations like protection rules. Default: false.
-   */
-  blockWithoutConfirmation?: boolean;
 }
```

`operationPolicy` is **required**, not optional. Every endpoint spec — read, write, and execute — must declare its policy. This is deliberate: the dispatch code can always rely on the field without null checks, and the contract is absolute.

`blockWithoutConfirmation` is **removed**. Its semantics are fully captured by `operationPolicy.risk >= "high_write"`.

## Changes to PreflightContext

The current `PreflightContext` types `client` and `registry` as `unknown` to avoid circular imports. This is fragile as preflight hooks scale. Extract minimal interfaces:

```typescript
export interface HarnessClientInterface {
  request<T>(path: string, options?: Record<string, unknown>): Promise<T>;
  getConfig(): {
    HARNESS_ACCOUNT_ID?: string;
    HARNESS_DEFAULT_ORG_ID: string;
    HARNESS_DEFAULT_PROJECT_ID?: string;
  };
}

export interface RegistryDispatchInterface {
  dispatch(
    client: HarnessClientInterface,
    resourceType: string,
    operation: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
  getResourceDefinition(resourceType: string): ResourceDefinition | undefined;
}

export interface PreflightContext {
  client: HarnessClientInterface;
  input: Record<string, unknown>;
  registry: RegistryDispatchInterface;
  signal?: AbortSignal;
}
```

The concrete `HarnessClient` and `Registry` classes implement these interfaces. No circular import.

## Risk Classification Rules

These are the defaults. Individual endpoint specs can override when the default doesn't fit.

### CRUD operations

| Pattern | Risk | Retry | Rationale |
|---|---|---|---|
| `list` | `read` | `safe` | No side effects |
| `get` | `read` | `safe` | No side effects |
| `create` (general) | `low_write` | `do_not_retry` | POST is not idempotent |
| `create` (protection/security rules) | `medium_write` | `do_not_retry` | Security-sensitive |
| `update` (general) | `low_write` | `safe` | PUT is idempotent |
| `update` (protection/security rules) | `high_write` | `safe` | Security-sensitive, idempotent |
| `delete` (all) | `destructive` | `do_not_retry` | Irreversible |

### Execute actions

| Pattern | Risk | Retry | Examples |
|---|---|---|---|
| Read-only actions | `read` | `safe` | `commit.diff`, `commit.diff_stats`, `file_content.blame`, `chaos_fault.get_yaml`, `chaos_experiment_template.list_revisions`, `eval_dataset.export` |
| Low-impact actions | `low_write` | `safe` | `connector.test_connection`, `gitops_application.refresh`, `eval_suite.export_yaml` |
| Medium-impact actions | `medium_write` | `do_not_retry` | `chaos_experiment.stop`, `chaos_loadtest.stop`, `execution.interrupt`, `gitops_application.cancel_operation` |
| High-impact actions | `high_write` | `do_not_retry` | See list below |

### Execute actions classified as `high_write`

These are the actions with production blast radius. They must block on clients without elicitation.

- **Pipelines:** `pipeline.run`, `pipeline_v1.run`, `pipeline.retry`
- **Chaos:** `chaos_experiment.run`, `chaos_loadtest.run`
- **GitOps:** `gitops_application.sync`, `gitops_application.bulk_sync`
- **Feature Flags:** `fme_feature_flag.kill`, `fme_feature_flag.restore`, `fme_feature_flag.archive`, `fme_feature_flag.unarchive`
- **Approvals:** `approval_instance.approve`, `approval_instance.reject`
- **Freeze:** `freeze_window.toggle_status`, `global_freeze.manage`
- **STO:** `security_exemption.approve`, `security_exemption.reject`, `security_exemption.promote`
- **IDP:** `idp_workflow.execute`
- **SCS:** `scs_sbom_drift.calculate`
- ~~**Chaos DR:** `chaos_dr_test.create`~~ — reclassified to `low_write`: the create endpoint scaffolds a DR test definition (name, identifier, description) but does NOT trigger execution; running the test requires executing the backing pipeline separately

## Behavioral Changes

### Tool handlers

#### `harness-create.ts`

```diff
- const blockWithoutConfirmation = !!def.operations.create?.blockWithoutConfirmation;
+ const risk = def.operations.create!.operationPolicy.risk;

  const elicitResult = await confirmViaElicitation({
    server,
    toolName: "harness_create",
    message: `Create ${def.displayName}...`,
-   destructive: blockWithoutConfirmation,
+   destructive: isBlockingRisk(risk),
  });
```

#### `harness-update.ts`

Same pattern — replace `blockWithoutConfirmation` with `isBlockingRisk(operationPolicy.risk)`.

#### `harness-execute.ts`

This is the **biggest behavioral change**. Currently execute actions do not pass `destructive`, so they always proceed on clients without elicitation.

```diff
+ const actionSpec = def.executeActions?.[args.action];
+ const risk = actionSpec?.operationPolicy.risk ?? "low_write";

  const elicitResult = await confirmViaElicitation({
    server,
    toolName: "harness_execute",
    message: `Execute ${args.action} on ${def.displayName}...`,
+   destructive: isBlockingRisk(risk),
  });
```

After this change, `pipeline.run`, `gitops_application.sync`, `fme_feature_flag.kill`, and other high-risk actions will block on Claude Desktop and Windsurf unless confirmed.

#### `harness-delete.ts`

No change. Already hardcodes `destructive: true`, consistent with all deletes being `risk: "destructive"`.

### Elicitation module

`src/utils/elicitation.ts` — no changes required. The `destructive` boolean parameter stays as-is. Tool handlers derive it from `isBlockingRisk(operationPolicy.risk)`.

### Registry dispatch

`src/registry/index.ts` — no changes to `dispatch()` or `dispatchExecute()` for this spec. `operationPolicy` is data on the spec, consumed by tool handlers. Future specs (P5: retry policy) will have the dispatch layer read `operationPolicy.retryPolicy`.

## Backfill Strategy

~175 endpoint specs across ~30 toolset files need `operationPolicy` added. The backfill is large but mechanical.

### Grouping

**Group A — Read-only toolsets (8 files, trivial)**
`audit.ts`, `dashboards.ts`, `dbops.ts`, `logs.ts`, `registries.ts`, `secrets.ts`, `sei.ts`, `settings.ts`

All specs get `operationPolicy: { risk: "read", retryPolicy: "safe" }`.

**Group B — Simple write toolsets (10 files, mechanical)**
`agents.ts`, `connectors.ts`, `environments.ts`, `governance.ts`, `infrastructure.ts`, `overrides.ts`, `platform.ts`, `services.ts`, `templates.ts`, `access-control.ts`

Follow default classification rules: creates = `low_write`/`do_not_retry`, updates = `low_write`/`safe`, deletes = `destructive`/`do_not_retry`, reads = `read`/`safe`.

**Group C — Complex toolsets with execute actions (13 files, per-action judgment)**
`pipelines.ts`, `chaos.ts`, `gitops.ts`, `feature-flags.ts`, `ccm.ts`, `freeze.ts`, `pull-requests.ts`, `repositories.ts`, `scs.ts`, `sto.ts`, `ai-evals.ts`, `delegates.ts`, `idp.ts`

Each execute action needs individual risk classification per the table above.

### Implementation pattern

For a typical CRUD resource:

```typescript
operations: {
  list: {
    method: "GET",
    path: "/ng/api/servicesV2",
    operationPolicy: { risk: "read", retryPolicy: "safe" },
    // ... existing fields
  },
  get: {
    method: "GET",
    path: "/ng/api/servicesV2/{serviceIdentifier}",
    operationPolicy: { risk: "read", retryPolicy: "safe" },
    // ... existing fields
  },
  create: {
    method: "POST",
    path: "/ng/api/servicesV2",
    operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
    // ... existing fields
  },
  update: {
    method: "PUT",
    path: "/ng/api/servicesV2",
    operationPolicy: { risk: "low_write", retryPolicy: "safe" },
    // ... existing fields
  },
  delete: {
    method: "DELETE",
    path: "/ng/api/servicesV2/{serviceIdentifier}",
    operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
    // ... existing fields
  },
},
```

For an execute action:

```typescript
executeActions: {
  run: {
    method: "POST",
    path: "/pipeline/api/pipeline/execute/{pipelineIdentifier}",
    operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
    actionDescription: "Execute a pipeline",
    // ... existing fields
  },
},
```

## Test Plan

### Structural validation (`tests/registry/structural-validation.test.ts`)

Add assertions:
- Every endpoint spec in `operations` has `operationPolicy`
- Every endpoint spec in `executeActions` has `operationPolicy`
- `operationPolicy.risk` is a valid `RiskLevel` value
- `operationPolicy.retryPolicy` is a valid `RetryPolicy` value
- All `delete` operations have `risk: "destructive"`
- All `list` and `get` operations have `risk: "read"`
- No endpoint spec has `blockWithoutConfirmation` (removed field)

### Elicitation unit tests (`tests/utils/elicitation.test.ts`)

Add tests for `isBlockingRisk`:
- `"read"` → false
- `"low_write"` → false
- `"medium_write"` → false
- `"high_write"` → true
- `"destructive"` → true

### Integration tests (`tests/integration/elicitation-flow.test.ts`)

Add scenarios:
- `harness_create` with `high_write` resource + no elicitation → blocked
- `harness_create` with `low_write` resource + no elicitation → proceeds
- `harness_execute` with `high_write` action + no elicitation → blocked (new behavior)
- `harness_execute` with `low_write` action + no elicitation → proceeds
- `harness_execute` with `high_write` action + elicitation accepted → proceeds

### Doc updates

- `docs/testing/repo_rule/test_plan.md` — replace `blockWithoutConfirmation` references with `operationPolicy.risk: "high_write"`
- `docs/testing/space_rule/test_plan.md` — same

## Migration Checklist

- [ ] Add `RiskLevel`, `RetryPolicy`, `OperationPolicy`, `isBlockingRisk` to `src/registry/types.ts`
- [ ] Add `HarnessClientInterface`, `RegistryDispatchInterface` to `src/registry/types.ts`
- [ ] Update `PreflightContext` to use typed interfaces
- [ ] Add required `operationPolicy` to `EndpointSpec`
- [ ] Remove `blockWithoutConfirmation` from `EndpointSpec`
- [ ] Update `harness-create.ts` to use `isBlockingRisk(operationPolicy.risk)`
- [ ] Update `harness-update.ts` to use `isBlockingRisk(operationPolicy.risk)`
- [ ] Update `harness-execute.ts` to read risk from action spec and gate accordingly
- [ ] Backfill Group A: read-only toolsets (8 files)
- [ ] Backfill Group B: simple write toolsets (10 files)
- [ ] Backfill Group C: complex toolsets with execute actions (13 files)
- [ ] Add structural validation tests
- [ ] Add `isBlockingRisk` unit tests
- [ ] Add integration tests for risk-gated elicitation
- [ ] Update test plan docs
- [ ] Build + typecheck + full test run passes

## What This Does NOT Cover

This spec focuses on the registry contract and the elicitation gating that falls out of it. The following are separate follow-on specs:

- **P3 (fail-closed elicitation):** Chat-based confirmation fallback for low-risk ops on non-elicitation clients. This spec gives P3 the risk levels it needs.
- **P4 (autonomous modes):** `HARNESS_AUTONOMOUS_MODE` env var with risk-based mode tiers. This spec gives P4 the `operationPolicy.risk` to compare against.
- **P5 (retry policy):** HTTP client reads `operationPolicy.retryPolicy` to decide whether to retry. This spec puts the policy on every spec; P5 wires it into the HTTP layer.
- **P10 (write quality contract):** Structural linter requiring `bodySchema`, `preflight`, etc. on writes. This spec establishes the registry-as-contract pattern that P10 extends.
