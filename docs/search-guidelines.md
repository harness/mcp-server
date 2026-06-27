# Making Resources Searchable

This guide explains how semantic search works in `harness_search` and what you need to do when adding a new resource type to make it discoverable.

## How It Works

`harness_search` uses a two-stage approach:

1. **Semantic routing** — a local ONNX embedding model (`all-MiniLM-L6-v2`) searches a `knowledge` corpus of static content indexed at startup. High-confidence hits (score ≥ 0.5) predict which resource types are relevant, narrowing the scatter-gather from ~163 types to a handful.

2. **Scatter-gather** — keyword `list` calls run only against the predicted types (or all types if routing misses).

The quality of step 1 depends entirely on what's indexed in the `knowledge` corpus.

## What Gets Indexed Automatically

At server startup, `SearchManager.indexStaticContent()` indexes three things into the `knowledge` corpus:

| Content | Source | Indexed fields |
|---------|--------|----------------|
| Resource definitions | Registry | `resource_type`, `displayName`, `description`, supported operations |
| Examples | `src/data/examples/` | `resourceType`, `name`, `description`, `tags` |
| Schemas | `src/data/schemas/` | schema name, title, description |

This means **every registered resource type gets a baseline search entry for free**. But the quality of routing depends on how descriptive these fields are.

---

## Checklist: Adding a New Resource Type

### 1. Write a good `displayName` and `description` in the registry

The resource definition's `displayName` and `description` are the primary routing signal. Be specific and include domain terminology users might search for.

```typescript
// ✗ Weak — generic, no domain terms
displayName: "Secret",
description: "Manage secrets",

// ✓ Strong — includes aliases users actually type
displayName: "Secret",
description: "Manage encrypted credentials, API keys, tokens, and passwords. Supports GitHub, AWS, GCP, DockerHub, and SSH key secrets.",
```

**Rule of thumb:** if a user types a query containing words that should route to your type, those words need to appear somewhere in `displayName`, `description`, or an example's tags.

### 2. Add examples with descriptive tags

Examples are the second routing signal. Add at least one example for new resource types in `src/data/examples/`. The `tags` field drives semantic matching — include technology names, use-case keywords, and synonyms.

```typescript
{
  name: "github-pat-secret",
  resourceType: "secret",
  description: "Store a GitHub personal access token as a Harness secret",
  tags: ["github", "token", "pat", "credentials", "api-key", "git"],
  // ...
}
```

### 3. Test routing locally

After adding your resource, run the credential-free routing benchmark:

```bash
pnpm build
pnpm search:benchmark
```

The benchmark uses `tests/fixtures/search-routing-golden.json` and the static
`knowledge` corpus only. It does not call Harness APIs or require
`HARNESS_API_KEY`. For machine-readable output:

```bash
pnpm search:benchmark -- --json
```

To make the benchmark fail when any golden case misses an expected type:

```bash
pnpm search:benchmark -- --fail-on-miss
```

To compare a candidate embedding model without editing source:

```bash
pnpm build
pnpm search:benchmark -- --model=Xenova/bge-small-en-v1.5
pnpm search:benchmark -- --model=Xenova/e5-small-v2
```

For live end-to-end smoke coverage against a real account, run:

```bash
HARNESS_API_KEY=<pat> HARNESS_ACCOUNT_ID=<id> node scripts/smoke-test-search.mjs
```

The live smoke test verifies MCP wiring, API calls, and account behavior. Use
the benchmark for model/threshold comparisons; use the smoke test for runtime
integration confidence.

Or test a specific query manually via the MCP inspector — look for
`semantic_routed: true` and `types_skipped > 0` in the response.

To test routing in isolation (no live API needed):

```typescript
import { extractRoutingTypes } from "../src/tools/harness-search.js";

const mockResults = [{
  id: "resource-def:secret",
  score: 0.55,
  corpus: "knowledge",
  content: "",
  metadata: { resource_type: "secret", type: "resource_definition" },
}];

const routed = extractRoutingTypes(mockResults, ["secret", "connector", "pipeline"]);
// → ["secret"]
```

---

## Routing Thresholds

| Threshold | Value | Purpose |
|-----------|-------|---------|
| `SEMANTIC_ROUTING_THRESHOLD` | 0.5 | Minimum score to use a hit for routing (scatter-gather narrowing) |
| `SEMANTIC_DISPLAY_THRESHOLD` | 0.35 | Minimum score to show a hit as a tier-0 result (display only) |

If your resource type isn't routing but you think it should, check the actual score by calling `provider.search()` directly and logging scores. Usually the fix is richer content, not a lower threshold.

## Golden Routing Benchmark

The golden set in `tests/fixtures/search-routing-golden.json` is the baseline
for search-model and threshold decisions. Each case contains:

| Field | Meaning |
|-------|---------|
| `query` | User-like search phrase |
| `mode` | `specific`, `cross_domain`, or `ambiguous` |
| `expectedTypes` | Resource types that must be searched when routing narrows |
| `acceptableTypes` | Extra routed types that are reasonable but not required |
| `description` | Why the label exists |

The benchmark reports:

| Metric | Use |
|--------|-----|
| Expected-type recall | Whether expected resource types remain in the target set |
| False negatives | Count of expected types missed by semantic routing |
| Average searched types | Scatter-gather reduction versus the full candidate set |
| Average latency | Per-query embedding search latency |
| Init + static index time | Startup cost for the local model and static corpus |
| RSS delta | Approximate memory added by model loading and indexing |

### Model Comparison Workflow

When evaluating a new local embedding model:

1. Run the baseline model first:

   ```bash
   pnpm build
   pnpm search:benchmark -- --json --model=Xenova/all-MiniLM-L6-v2
   ```

2. Run candidate models with the same fixture and threshold:

   ```bash
   pnpm search:benchmark -- --json --model=Xenova/bge-small-en-v1.5
   pnpm search:benchmark -- --json --model=Xenova/e5-small-v2
   pnpm search:benchmark -- --json --model=Xenova/all-MiniLM-L12-v2
   ```

3. Compare `summary.expectedTypeRecall`, `summary.falseNegativeCount`,
   `summary.averageSearchedTypes`, `summary.averageLatencyMs`, `initMs`, and
   `rssDeltaMb`.

4. Inspect failed cases before choosing a model. A lower
   `averageSearchedTypes` is only useful if the model does not skip important
   resource types.

5. If changing the default model, update both `DEFAULT_EMBEDDING_MODEL` in
   `src/search/local-provider.ts` and the Docker preload model in
   `scripts/preload-hf-model.mjs`, then rerun the benchmark and Docker build.

Initial comparison captured on 2026-06-26 with the 40-case golden set:

| Model | Pass | Recall | False negatives | Avg searched | Avg latency |
|-------|------|--------|-----------------|--------------|-------------|
| `Xenova/all-MiniLM-L6-v2` | 36/40 | 91.1% | 4 | 66.83/168 | 3.07 ms |
| `Xenova/bge-small-en-v1.5` | 38/40 | 95.6% | 2 | 18.57/168 | 21.87 ms |
| `Xenova/e5-small-v2` | 37/40 | 93.3% | 3 | 16.70/168 | 15.54 ms |
| `Xenova/all-MiniLM-L12-v2` | 37/40 | 93.3% | 3 | 58.60/168 | 4.77 ms |

On that run, `Xenova/bge-small-en-v1.5` was the strongest candidate by recall
and scatter-gather reduction, but it still had long-tail misses. Treat this as
directional, not a permanent benchmark result; rerun after changing the golden
set, indexed content, thresholds, model package, Node version, or runtime host.

When updating the golden set:

1. Use only resource types that support `list`; `harness_search` cannot
   scatter-gather get-only resources.
2. Prefer user phrases over internal API names.
3. Include obvious, cross-domain, and ambiguous queries.
4. Add synonyms to registry descriptions or examples before lowering
   thresholds.

## Model / Threshold Upgrade Criteria

Run `pnpm build && pnpm search:benchmark` before changing:

- `EMBEDDING_MODEL` in `src/search/local-provider.ts`
- `SEMANTIC_ROUTING_THRESHOLD` or `SEMANTIC_DISPLAY_THRESHOLD` in
  `src/tools/harness-search.ts`
- Static corpus construction in `src/search/manager.ts`
- Resource descriptions or examples that affect routing

Upgrade only when the candidate model or threshold:

1. Has zero critical false negatives for `specific` and `cross_domain` cases.
2. Improves or preserves expected-type recall versus the current MiniLM
   baseline.
3. Preserves useful scatter-gather reduction (`averageSearchedTypes` should not
   jump without a recall gain).
4. Keeps startup time, query latency, and RSS delta acceptable for local MCP
   usage.
5. Still works with Docker model preloading via `scripts/preload-hf-model.mjs`.

Do not compare raw cosine scores across models. Re-run the benchmark and retune
thresholds because each embedding model has its own score distribution.

## Safety Floor

Even when semantic routing fires, `SEMANTIC_ROUTING_SAFETY_FLOOR` types (`pipeline`, `service`, `environment`, `connector`) are always included in the scatter-gather. This prevents confident-but-wrong routing from silently skipping core CI/CD entities.

If your resource type is equally fundamental, add it to `SEMANTIC_ROUTING_SAFETY_FLOOR` in `src/tools/harness-search.ts`.

---

## Dynamic / Account-Agnostic Types

Some resource types return account-agnostic data (e.g. `connector_catalogue`, account-scoped `template`). These are indexed into the `knowledge` corpus on first successful `harness_list` call rather than at startup. To mark a type as globally indexable, add it to `GLOBAL_TYPES` in `src/search/manager.ts` (see roadmap — not yet implemented).

## Corpus Reference

| Corpus | Content | TTL | Account-scoped |
|--------|---------|-----|----------------|
| `knowledge` | Static reference: resource defs, examples, schemas | Permanent | No — shared globally |
| `entities` | Live Harness objects fetched from API | 30 minutes | Yes — isolated per account |
| `docs` | Harness documentation | Permanent | No (not yet implemented) |
