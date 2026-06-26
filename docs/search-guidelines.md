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

After adding your resource, run the smoke test to verify routing fires:

```bash
HARNESS_API_KEY=<pat> HARNESS_ACCOUNT_ID=<id> node scripts/smoke-test-search.mjs
```

Or test a specific query manually via the MCP inspector — look for `semantic_routed: true` and `types_skipped > 0` in the response.

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
