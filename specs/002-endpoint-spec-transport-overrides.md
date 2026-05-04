# Spec 002: EndpointSpec Transport Overrides

**Status:** Deferred (pre-approved pattern — implement when 8th+ transport quirk appears)
**Author:** Architecture Review Follow-up
**Date:** 2026-05-02
**Depends on:** 001 (OperationPolicy)
**Unblocks:** Cleaner extension model for future product integrations

---

## Problem

`EndpointSpec` has accumulated 7 optional fields that serve 1–3 modules each.
They are legitimate API-behavior quirks, but they bloat the shared contract that
every resource definition depends on. Each new Harness product integration risks
adding more module-specific fields:

| Field | Modules that use it | Purpose |
|---|---|---|
| `elkFallback` | scs (5 specs) | ELK-to-Mongo retry for ssca-manager |
| `headerBasedScoping` | sei, ai-evals, pipelines (~32 specs) | Scope via `Harness-Account` header |
| `injectAccountInBody` | gitops, ccm (6 specs) | gRPC-gateway body injection |
| `injectOrgQueryFallback` | platform (4 specs) | NG project POST needs org query param |
| `pageOneIndexed` | dashboards (1 spec) | 1-based pagination shim |
| `emptyOnErrorPatterns` | gitops (2 specs) | Swallow "no data" 500s |
| `responseType` | dashboards (1 spec) | Binary/buffer response |

Additionally, two dead fields exist today:

- **`EndpointSpec.scopeParams`** — declared in the interface but never set by
  any toolset and never read by `executeSpec`. Only `ResourceDefinition.scopeParams`
  is used.
- **`emptyOnErrorPatterns`** — set on 2 GitOps specs but `executeSpec` never
  reads it. The error-swallowing behavior was never wired up.

---

## Design Alternatives Considered

### Alternative A: Interface Extension / Inheritance

```typescript
// Core
interface EndpointSpec { method: HttpMethod; path: string; ... }

// Per-module extension
interface SCSEndpointSpec extends EndpointSpec { elkFallback?: boolean; }
interface SEIEndpointSpec extends EndpointSpec { headerBasedScoping?: boolean; }
```

**Why this doesn't work for us:**

The fundamental constraint is that `executeSpec` is a single centralized method
that receives `EndpointSpec` via `ResourceDefinition.operations`. If toolsets
define extended interfaces, the dispatch layer receives the base `EndpointSpec`
and *cannot see* extension fields without type narrowing.

To make it work you'd need one of:

1. **Type assertions in `executeSpec`** — e.g. `(spec as SCSEndpointSpec).elkFallback`.
   This defeats the purpose. Dispatch still knows about every module, and now
   with unsafe casts instead of optional typed fields.

2. **Generic `ResourceDefinition<T extends EndpointSpec>`** — the generic
   cascades to `ToolsetDefinition<T>`, the registry `Map`, every dispatch
   overload, and every tool handler. Massive complexity for no behavioral gain.

3. **Discriminated union** — `EndpointSpec = SCSEndpointSpec | SEIEndpointSpec | ...`
   Forces every consumer to narrow the union. Fields like `headerBasedScoping`
   span multiple products, so the discriminant doesn't align to product.

**Verdict:** Extension/inheritance models solve a problem we don't have.
They're useful when each subtype has **different logic** (polymorphic dispatch).
Here, all logic lives in **one function** (`executeSpec`), and the fields are
just configuration flags. Making them extensible via inheritance adds indirection
without benefit.

### Alternative B: Middleware / Plugin Chain

```typescript
interface RequestMiddleware {
  name: string;
  apply(
    request: RequestOptions,
    spec: EndpointSpec,
    def: ResourceDefinition,
  ): RequestOptions;
}
```

Each quirk becomes a middleware registered at startup. `executeSpec` runs the
chain instead of checking flags.

- **Pro:** Truly extensible — modules register behavior, not just data.
- **Con:** Over-engineered for ~7 boolean flags. Adds runtime indirection,
  makes the request pipeline harder to follow, and the "middleware" is still
  just `if (spec.someFlag)` behind a function pointer.
- **When it would be right:** If we had 20+ quirks, or quirks needed to
  compose/conflict-resolve with each other. We don't.

**Verdict:** Premature for the current scale. Could revisit if the quirk count
grows past ~15.

### Alternative C: Declaration Merging (Module Augmentation)

```typescript
// In scs.ts
declare module '../types.js' {
  interface EndpointSpec { elkFallback?: boolean; }
}
```

- **Pro:** Each module extends `EndpointSpec` in its own file.
- **Con:** The merged interface is still one big bag — just defined across
  scattered files. Makes the actual shape of `EndpointSpec` invisible in any
  single file. Order-dependent. IDE tooling is unreliable for merged interfaces.
  `executeSpec` still reads every field directly.

**Verdict:** Worse ergonomics than putting them in one place, with no real
decoupling benefit.

### Alternative D: `Record<string, unknown>` Extension Bag

Loses type safety entirely. Against project principles. Rejected without
further analysis.

---

## Chosen Solution: `TransportOverrides` Bag

Consolidate module-specific transport flags into a single typed interface.
`EndpointSpec` gets one optional field instead of seven.

### Type Definitions

Added to `src/registry/types.ts`:

```typescript
/**
 * Transport-level overrides for non-standard API behaviors.
 * Most EndpointSpecs don't need this — it's for product-specific quirks
 * (e.g. header-based scoping, ELK fallback, binary responses).
 *
 * New Harness product quirks go here, not on EndpointSpec directly.
 */
export interface TransportOverrides {
  /** ELK-to-Mongo fallback for ssca-manager endpoints. When true:
   *  1. First request sent with `enforce_elasticsearch=true`.
   *  2. On failure (4xx except 401/403, 5xx), retried with `enforce_elasticsearch=false`.
   *  Response includes `_data_source: "elasticsearch" | "mongodb"`. */
  elkFallback?: boolean;

  /** Scope via Harness-Account header instead of `accountIdentifier` query param.
   *  Also prevents automatic org/project injection into POST/PUT bodies. */
  headerBasedScoping?: boolean;

  /** Inject accountIdentifier into POST/PUT request body.
   *  `true` = field name "accountIdentifier".
   *  String value = custom field name (e.g. "accountId" for CCM APIs). */
  injectAccountInBody?: boolean | string;

  /** Add orgIdentifier query param even for account-scoped resources.
   *  Required for NG endpoints like POST /ng/api/projects. */
  injectOrgQueryFallback?: boolean;

  /** API uses 1-based pagination. The registry adds 1 to the 0-based
   *  `page` value from harness_list before sending the request. */
  pageOneIndexed?: boolean;

  /** When an API error message matches one of these patterns, return an empty
   *  result instead of throwing. For backends that return 500 for "no data"
   *  scenarios (e.g. disconnected GitOps agent). */
  emptyOnErrorPatterns?: RegExp[];

  /** Request binary (ArrayBuffer) response instead of JSON.
   *  Used for ZIP/file download endpoints. */
  responseType?: "json" | "buffer";
}
```

### Changes to `EndpointSpec`

```typescript
export interface EndpointSpec {
  method: HttpMethod;
  path: string;
  pathBuilder?: (...) => string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  staticQueryParams?: Record<string, string>;
  defaultQueryParams?: Record<string, string>;
  bodyBuilder?: (input: Record<string, unknown>) => unknown;
  headers?: Record<string, string>;
  responseExtractor?: (raw: unknown) => unknown;
  description?: string;
  bodySchema?: BodySchema;
  bodyWrapperKey?: string;
  operationPolicy: OperationPolicy;
  inputExpansions?: InputExpansionRule[];
  preflight?: (ctx: PreflightContext) => Promise<void>;

  /**
   * Optional transport-level overrides for non-standard API behaviors.
   * Most specs don't need this — only set for product-specific quirks.
   * See TransportOverrides for available options.
   */
  transportOverrides?: TransportOverrides;

  // REMOVED: elkFallback, headerBasedScoping, injectAccountInBody,
  //          injectOrgQueryFallback, pageOneIndexed, emptyOnErrorPatterns,
  //          responseType, scopeParams (dead field)
}
```

### Changes to `executeSpec` (src/registry/index.ts)

Every read of a module-specific field becomes a safe-access through the bag:

```
spec.elkFallback              → spec.transportOverrides?.elkFallback
spec.headerBasedScoping       → spec.transportOverrides?.headerBasedScoping
spec.injectAccountInBody      → spec.transportOverrides?.injectAccountInBody
spec.injectOrgQueryFallback   → spec.transportOverrides?.injectOrgQueryFallback
spec.pageOneIndexed           → spec.transportOverrides?.pageOneIndexed
spec.responseType             → spec.transportOverrides?.responseType
```

The `def.headerBasedScoping` path on `ResourceDefinition` is unchanged — it
remains the right abstraction level for "all operations on this resource use
header-based scoping."

### Wire `emptyOnErrorPatterns` (currently dead)

The field is set on 2 GitOps specs but `executeSpec` never reads it. Add the
intended behavior:

```typescript
// In executeSpec, after the main client.request call
} catch (err: unknown) {
  const overrides = spec.transportOverrides;
  if (overrides?.emptyOnErrorPatterns && err instanceof HarnessApiError) {
    const msg = err.message ?? "";
    if (overrides.emptyOnErrorPatterns.some(p => p.test(msg))) {
      log.warn(`Matched emptyOnErrorPattern for ${def.resourceType}; returning empty result`);
      return { items: [], total: 0, page: 0 };
    }
  }
  throw err;
}
```

### Remove dead `EndpointSpec.scopeParams`

`EndpointSpec.scopeParams` is declared but never set on any endpoint spec and
never read in `executeSpec` (only `def.scopeParams` on `ResourceDefinition` is
used). Remove it from `EndpointSpec`. `ResourceDefinition.scopeParams` is
unchanged.

---

## Why TransportOverrides Over Extension/Inheritance

The core insight: **the behavior consumer is singular** (`executeSpec`). When
one function reads all the flags, spreading the type definitions across an
inheritance hierarchy adds zero value — you still need the function to handle
every case, and now the cases are harder to find.

Extension/inheritance wins when:
- Each subtype carries its own behavior (polymorphism via method override)
- Consumers don't need to know about subtypes they don't handle
- The subtype taxonomy is stable and semantically meaningful

None of those apply here:
- `executeSpec` handles all transport quirks centrally
- Every quirk is consumed in the same function
- Quirks don't form a meaningful taxonomy (they're independent flags, not subtypes)

`TransportOverrides` is the right pattern for "bag of orthogonal configuration
flags consumed by a single function."

---

## Toolset Migration

| File | Fields to move into `transportOverrides` | Count |
|---|---|---|
| `scs.ts` | `elkFallback` | 5 |
| `sei.ts` | (only on ResourceDefinition — no EndpointSpec changes) | 0 |
| `ai-evals.ts` | (only on ResourceDefinition — no EndpointSpec changes) | 0 |
| `pipelines.ts` | (only on ResourceDefinition — no EndpointSpec changes) | 0 |
| `gitops.ts` | `injectAccountInBody`, `emptyOnErrorPatterns` | ~7 |
| `ccm.ts` | `injectAccountInBody` | ~1 |
| `platform.ts` | `injectOrgQueryFallback` | ~4 |
| `dashboards.ts` | `pageOneIndexed`, `responseType` | ~2 |

Note: `headerBasedScoping` in sei/ai-evals/pipelines is set on
`ResourceDefinition`, not individual `EndpointSpec` entries. Those files need
no changes. If any EndpointSpec-level `headerBasedScoping` usage exists, move
it into `transportOverrides`.

---

## Test Plan

### Structural Validation

Add to `tests/registry/structural-validation.test.ts`:

```typescript
it("no EndpointSpec uses removed top-level transport fields", () => {
  const removedFields = [
    "elkFallback", "headerBasedScoping", "injectAccountInBody",
    "injectOrgQueryFallback", "pageOneIndexed", "emptyOnErrorPatterns",
    "responseType", "scopeParams",
  ];
  for (const [type, def] of Object.entries(allResources)) {
    const allSpecs = [
      ...Object.entries(def.operations),
      ...Object.entries(def.executeActions ?? {}),
    ];
    for (const [op, spec] of allSpecs) {
      for (const field of removedFields) {
        expect((spec as any)[field]).toBeUndefined();
      }
    }
  }
});
```

### `emptyOnErrorPatterns` Wiring

```typescript
it("returns empty result when error matches emptyOnErrorPattern", async () => {
  // Mock client.request to throw HarnessApiError("No gitops agent found...")
  // Verify dispatch returns { items: [], total: 0, page: 0 }
});
```

### Regression

- `pnpm typecheck` — no type errors
- `pnpm test` — all existing tests pass (pure refactor)

---

## Migration Checklist

- [ ] Define `TransportOverrides` in `src/registry/types.ts`
- [ ] Add `transportOverrides?: TransportOverrides` to `EndpointSpec`
- [ ] Remove 7 old fields + dead `scopeParams` from `EndpointSpec`
- [ ] Update `executeSpec` to read from `spec.transportOverrides?.X`
- [ ] Wire `emptyOnErrorPatterns` error catching in `executeSpec`
- [ ] Migrate `scs.ts` (5 specs: elkFallback)
- [ ] Migrate `gitops.ts` (~7 specs: injectAccountInBody, emptyOnErrorPatterns)
- [ ] Migrate `ccm.ts` (~1 spec: injectAccountInBody)
- [ ] Migrate `platform.ts` (~4 specs: injectOrgQueryFallback)
- [ ] Migrate `dashboards.ts` (~2 specs: pageOneIndexed, responseType)
- [ ] Verify sei/ai-evals/pipelines have no EndpointSpec-level headerBasedScoping
- [ ] Add structural validation test for removed fields
- [ ] Add unit test for emptyOnErrorPatterns wiring
- [ ] `pnpm typecheck && pnpm test`
