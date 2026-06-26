# Semantic Search Provider — Implementation & Roadmap

**Status: Phase 1 complete (2026-06-26)**

---

## What Was Built

### Goal
Replace `harness_search`'s scatter-gather across 163 resource types (163 API calls per query) with semantic routing: use ONNX embeddings to predict which types are relevant, then scatter-gather only those.

### Architecture

```
harness_search query
       │
       ▼
LocalSearchProvider.search()          ← in-process, <50ms with warm model
       │
       ▼
extractRoutingTypes()                 ← score ≥ 0.5 → predict resource types
       │
  ┌────┴──────────────────┐
  │ routed (1-8 types)    │ fallback (all 163 types)
  ▼                       ▼
scatter-gather          scatter-gather
(narrow)                (full)
       │
       ▼
merge + tier-0 semantic results
```

**Result:** 5/6 test queries routed to 1–8 types instead of 163 (~98% API call reduction).

### Components

| File | Role |
|------|------|
| `src/search/types.ts` | `SearchProvider` interface, `IndexableItem`, `SearchResult`, `SearchCorpus`, TTL types |
| `src/search/null-provider.ts` | No-op, `isAvailable()=false` — used when `HARNESS_SEARCH_PROVIDER=none` |
| `src/search/local-provider.ts` | `@huggingface/transformers` v3, `Xenova/all-MiniLM-L6-v2` (384-dim), in-memory cosine similarity, TTL eviction |
| `src/search/manager.ts` | Loads provider, runs `indexStaticContent` + `initializeIndex` on startup |
| `src/search/index.ts` | Re-exports |
| `src/tools/harness-search.ts` | Semantic routing gate — narrows targetTypes before scatter-gather |
| `src/tools/harness-list.ts` | Fire-and-forget `provider.index()` after successful list |
| `src/tools/harness-get.ts` | Fire-and-forget `provider.index()` after successful get |
| `src/config.ts` | `HARNESS_SEARCH_PROVIDER` (default `"local"`), `HARNESS_SEARCH_SERVICE_URL` |

### Static Content Indexed at Startup (`mcp_resources` corpus, permanent)

1. **Resource definitions** — one per registry type, with `resource_type` in metadata → primary routing signal
2. **Examples** — YAML templates with `resource_type`, name, description, tags → secondary routing signal
3. **SCHEMAS** — pipeline/template/trigger/inputSet schemas; `resource_type` is comma-separated (display only, not used for routing since schemas span multiple types)
4. **Entity schemas** — connector/service/environment/secret/infrastructure per scope; `resource_type` extracted from name

### Routing Logic

```typescript
// extractRoutingTypes: only fires if semantic score ≥ 0.5
// Uses resource_type from metadata — works for resource_definition and example entries
// Schema entries intentionally excluded (comma-separated types won't match any single type)
// Falls back to full scatter-gather if no high-confidence predictions
```

### Key Design Decisions

- **`@huggingface/transformers` v3** (not faiss-node / @xenova/transformers): pure JS, no native bindings, works on darwin arm64/Node 20 without cmake
- **Semantic gates scatter-gather** (not concurrent): the whole point is avoiding API calls, not just appending results
- **TTL system**: `resources` corpus = 30min, `mcp_resources`/`docs` = permanent (`ttlMs: 0`)
- **Corpus isolation**: store key `${corpus}:${accountId ?? "global"}` — account data never crosses account boundary
- **`vitest.config.ts`** sets `HARNESS_SEARCH_PROVIDER: "none"` to prevent model download in CI

---

---

## Corpus Naming (Pending Rename)

Current names are confusing. Agreed rename (not yet implemented):

| Current | New | Rationale |
|---------|-----|-----------|
| `mcp_resources` | `knowledge` | Static reference content the system knows permanently — schemas, examples, resource type definitions. "Searched knowledge base" reads better than "searched catalog" in logs. |
| `resources` | `entities` | Live Harness objects with identity, ownership, lifecycle — pipelines, services, connectors etc. |
| `docs` | `docs` | Unchanged — self-explanatory. |

`registry` is not available — `Registry` class already exists in `src/registry/`.

---

## Provider × Mode Compatibility Matrix

`LocalSearchProvider` was designed for **single-user stdio mode**. Multi-user HTTP mode has fundamentally different constraints:

| Mode | `knowledge` corpus | `entities` corpus |
|------|--------------------|-------------------|
| stdio single-user | `LocalSearchProvider` ✓ | `LocalSearchProvider` ✓ (one account, bounded, 30min TTL) |
| HTTP multi-user | `LocalSearchProvider` ✓ (read-only static, safe) | `HarnessSearchProvider` only — `LocalSearchProvider` is unsafe here |

**Why `LocalSearchProvider` is fragile in multi-user `entities` mode:**
- Multiple accounts accumulate embeddings in the same process — memory grows unbounded
- No persistence — restart wipes all indexed live data
- Account isolation relies entirely on in-memory store key discipline (no enforcement layer)
- A single large account (10k pipelines × 1.5KB embedding = 15MB, ×N types) can crowd out others

**Enforcement rule (must implement before enabling `entities` in production):**
- `SearchManager` must check `HARNESS_MCP_MODE` at startup
- In multi-user mode: disable `entities` corpus indexing entirely for `LocalSearchProvider` — skip `initializeIndex`, skip fire-and-forget indexing in `harness-list`/`harness-get`
- Log a clear warning: `"entities corpus disabled in multi-user mode — requires HarnessSearchProvider"`
- `HarnessSearchProvider` (search-service backed by Qdrant) is **required** for multi-user `entities` search — not optional optimization

```typescript
// SearchManager — enforce at index time, not search time
private canIndexCorpus(corpus: SearchCorpus, mode: string): boolean {
  if (corpus === "entities" && mode === "multi-user" && this.providerName === "local") {
    return false;
  }
  return true;
}
```

---

## Classify Interface (Pending Implementation)

Resource types need to declare how their items should be indexed — corpus, scope, TTL. Some types are mixed (same type, different corpus depending on item content).

### Interface

```typescript
interface IndexContext {
  accountId: string;
  orgId?: string;
  projectId?: string;
}

interface IndexDecision {
  corpus: "knowledge" | "entities" | "docs";
  scope: "global" | { accountId: string };  // explicit union — no ambiguous undefined
  ttlMs?: number;   // undefined = permanent
  parentId?: string;  // for hierarchical types
}

// indexing can be a static decision (common case) or a classify function (mixed types)
type IndexingConfig =
  | IndexDecision
  | { classify: (item: Record<string, unknown>, ctx: IndexContext) => IndexDecision | null };
```

Always pass `accountId` via `IndexContext` — never derive from item (fragile, not always present).

### Examples

```typescript
// Simple: always global, permanent
connector_catalogue: { corpus: "knowledge", scope: "global" }

// Simple: always per-account, 30min TTL
pipeline: { corpus: "entities", scope: { accountId: ctx.accountId } }

// Mixed: account-scoped templates → knowledge (global), project-scoped → entities (per-account)
template: {
  classify: (item, ctx) =>
    item.scope === "account" || !item.projectIdentifier
      ? { corpus: "knowledge", scope: "global", ttlMs: 0 }
      : { corpus: "entities", scope: { accountId: ctx.accountId } }
}
```

### Hierarchical Types (kg_queryable_type)

Flatten each node into its own document. Do NOT store the full hierarchy as one document — embedding an aggregate kills retrieval precision for specific-node queries ("what fields does ServiceNow connector have?").

```typescript
// Each node becomes a separate IndexableItem
{
  id: "kg_queryable_type::connector::servicenow::fields",
  corpus: "knowledge",
  scope: "global",
  content: "ServiceNow Connector fields: table_name (string, required) ...",  // parent context included
  metadata: {
    path: "connector > servicenow > fields",
    resource_type: "kg_queryable_type",
    parent_id: "kg_queryable_type::connector::servicenow",
    depth: "2",
  }
}
```

Include parent path in the embedded `content` — gives the model enough signal without bloating. Store `parent_id` in metadata for post-retrieval tree traversal.

### Memory Bounds

- **`knowledge` corpus**: bounded by definition. Fixed number of types, schemas, examples. No cap needed.
- **`entities` corpus**: needs per-account cap (not per-key). `MAX_ITEMS_PER_ACCOUNT = 10000` across all resource types. Evict by soonest-to-expire when at cap.
- **Multi-user HTTP mode**: disable `entities` corpus for `LocalSearchProvider` (see matrix above).

---

## Future Work

### 1. Account Isolation (Security — High Priority)

Current state: `resources` corpus indexed with `accountId` in store key — items are isolated at the in-memory store level. But there are gaps:

- **`initializeIndex` at startup** runs with the session's account. In stdio (single-user) mode this is safe. In multi-user HTTP mode it's currently skipped — but if somehow called, it would mix accounts.
- **Fire-and-forget indexing** in `harness-list`/`harness-get` uses `client.account` which is correct per-session. No cross-account risk here.
- **`corpus: "all"` search** includes both `storeKey(c, accountId)` AND `storeKey(c, undefined)` (global). This is intentional for `mcp_resources` (account-agnostic static content). For `resources`, global items should never exist — enforce this.

**TODO:**
- [ ] Add invariant check: `resources` corpus items must always have `accountId` — log warning if not
- [ ] In multi-user HTTP mode, ensure `initializeIndex` is never called (currently gated by `HARNESS_MCP_MODE !== "multi-user"`, verify this holds)
- [ ] Consider per-session `SearchManager` in HTTP mode once `resources` corpus is actively used (vs shared manager for `mcp_resources` only)
- [ ] Opus security review before enabling `resources` corpus indexing in production

### 2. User-Level Isolation

Some Harness resources are user-scoped (audit events, personal tokens, user settings). These should not appear in another user's search results even within the same account.

**TODO:**
- [ ] Add `userId` field to `IndexableItem` and store key: `${corpus}:${accountId}:${userId ?? "shared"}`
- [ ] `search()` options add `userId?: string` — search includes user-specific + shared items
- [ ] Identify which resource types are user-scoped vs account-shared
- [ ] Thread session user identity through `HarnessClient` to indexing hooks

### 3. Load / Index on Demand (Dynamic Account-Agnostic Content)

Some resource types return account-agnostic data that's dynamic (not bundled):

- `kg_queryable_type` — knowledge graph types, changes with schema versions
- `template` at account scope — global templates visible to all projects
- `connector_catalogue` — available connector types (static-ish but not bundled)

**TODO:**
- [ ] Index these into `mcp_resources` corpus (permanent, no TTL) on first successful `harness_list` call
- [ ] Add a `indexedGlobalTypes: Set<string>` to `SearchManager` — skip re-indexing if already done
- [ ] Wire into `harness-list.ts`: after a successful list, if `resourceType` is in `GLOBAL_TYPES` set and not yet indexed, index into `mcp_resources` with no `accountId`

```typescript
const GLOBAL_TYPES = new Set(["kg_queryable_type", "connector_catalogue", /* ... */]);
// In harness-list.ts post-response hook:
if (GLOBAL_TYPES.has(resourceType) && !searchManager.isGlobalTypeIndexed(resourceType)) {
  await searchManager.indexGlobalType(resourceType, items);
}
```

### 4. Pluggable Search Layer (HarnessSearchProvider)

For cloud/production deployments, replace `LocalSearchProvider` with an HTTP client to `search-service` (Qdrant-backed). This enables:
- Persistent index across restarts
- Cross-account search (for admin/ops use cases)
- Hybrid search (vector + BM25)
- Scale beyond in-memory limits

**TODO:**
- [ ] Implement `HarnessSearchProvider` in `src/search/harness-provider.ts`
  - `initialize()`: health check against `HARNESS_SEARCH_SERVICE_URL`
  - `search()`: POST to `/search` with query + `tenant_id=[accountId, "default"]` for multi-tenant scope
  - `index()`: POST to `/ingest` with document + `tenant_id=accountId`
  - Collection: `mcp_knowledge` (already exists in search-service)
- [ ] Add `"harness"` to `HARNESS_SEARCH_PROVIDER` enum in config
- [ ] `SearchManager.loadProvider()` creates `HarnessSearchProvider` when `HARNESS_SEARCH_PROVIDER=harness`
- [ ] Shared embedding model between client (mcp-server) and server (search-service): both use `all-MiniLM-L6-v2` 384-dim — or delegate embedding to search-service entirely

```
HARNESS_SEARCH_PROVIDER=harness
HARNESS_SEARCH_SERVICE_URL=https://search.harness.io
```

### 5. Docs Corpus

Index Harness documentation into the `docs` corpus for query-time retrieval. Unlike `resources` and `mcp_resources`, docs are external (not bundled).

**TODO:**
- [ ] Decide ingestion source: Harness docs site scrape, exported MDX, or a docs API
- [ ] Build a `docs-indexer` script that fetches, chunks, and indexes docs at startup or via cron
- [ ] TTL: permanent (`ttlMs: 0`) since docs are versioned; re-index on deploy

### 6. Routing Quality Improvements

Current routing threshold is 0.5 (conservative). Opportunities:

- [ ] **Lower threshold for well-known types**: `pipeline`, `service`, `connector` have very distinct embeddings — could route at 0.4 with low miss risk
- [ ] **Multi-type routing**: when query spans multiple types ("list my pipelines and services"), include all predicted types
- [ ] **Routing telemetry**: log `{ query, routed_types, actual_matched_types, was_correct }` to measure routing precision/recall over time
- [ ] **Shadow mode**: run semantic routing + full scatter-gather in parallel for N% of queries, compare results to tune thresholds

---

## Configuration Reference

| Env Var | Values | Default | Notes |
|---------|--------|---------|-------|
| `HARNESS_SEARCH_PROVIDER` | `"none"`, `"local"`, `"harness"` | `"local"` | `"none"` skips all semantic search |
| `HARNESS_SEARCH_SERVICE_URL` | URL | — | Required when provider=`"harness"` |

Model cache: `/tmp/hf-cache/Xenova/all-MiniLM-L6-v2/` (~23MB, downloaded once)
