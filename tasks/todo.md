# Module → Capability Rename — execution tracker

Branch: `module-capability-rename`. Plan: `tasks/module-rename-plan.md`.

## P0 — alias infrastructure ✅ DONE (commit f8e43840)
- `aliases?: string[]` on ResourceDefinition + ToolsetDefinition (types.ts).
- `resolveType()` at getResource / supportsOperation / getExecuteActions / auditBlockedAttempt.
- Toolset aliases merged into HARNESS_TOOLSETS parsing; load-time collision guards.
- tests/registry/aliases.test.ts (12 tests). Full suite green (3217).

## Parallel rename agents (worktree-isolated, opus)
- P1  iacm → infrastructure + move CD infra-def → environments as `infrastructure_definition` ✅ INTEGRATED (cherry-pick da9ef943; 3233 tests green)
- P2  sto + scs → `application_security` (merge, 27 resources) ✅ INTEGRATED (cherry-pick c5b19029; resolved types.ts union + architecture.test.ts extractor-count map, dropped stale ccm/sei/dbops/iacm.ts entries; 3255 tests green)
- P3  ccm → `cost`, dbops → `databases` (toolset-name-only; file/const kept → no index.ts change) ✅ INTEGRATED (23c5b736)
- P4a sei → `developer_insights`, idp → `developer_portal` (scorecard* kept; file/const kept) ✅ INTEGRATED (98d5a0a5)
- P4b fme → `feature_flags` (token-collapse), knowledge-graph + semantic-layer → `software_delivery_knowledge_graph` (merge) ✅ INTEGRATED (cherry-pick c54ccaef; index.ts conflict resolved — dropped stale iacmToolset from P4b's pre-P1 base; 3252 tests green)

## Merge order (sequential, resolve index.ts conflicts, `pnpm build && pnpm test` after each)
P1 first (structural: infrastructure.ts delete/recreate, environments.ts, index.ts) →
P4b (semantic-layer removal in index.ts) → P2 (sto/scs removal in index.ts) → P3 → P4a (no index.ts).

## P5 — global cross-ref pass (I OWN THIS — agents only fix within-file refs)
Codemod whole-token, word-boundary, driven by the §3 mapping tables. Prompts are cosmetic (resolve via alias) but should be updated. The following are **behavioral** (alias layer does NOT cover internal string comparisons — internal code sees the canonical `.resourceType`):

- [ ] **src/utils/url-parser.ts L319/L356-361 — CORRECTNESS-CRITICAL.** `declaredResourceType` is raw user input (old alias OR new canonical, pre-registry). Fix to accept BOTH:
      - `FME_HARNESS_NATIVE_ONLY_RESOURCE_TYPES` Set → add `"feature_flag_segment"`, `"feature_flag_segment_definition"` (keep old fme_* too).
      - `startsWith("fme_")` → also match `startsWith("feature_flag")`.
      - Verified by fme-*-native-only.test.ts.
- [ ] **src/utils/url-parser.ts L62-63,71-72,81-82** — URL-segment→type map: `infrastructure`→`infrastructure_definition`, `fme_feature_flag`→`feature_flag`. (Work via alias, but make canonical. Note L81-82 `idp_scorecard`/`idp_catalog_entity` are NOT in the rename map — leave.)
- [ ] **src/tools/harness-search.ts L24-27** — priority-weight map keyed by resourceType (`fme_feature_flag`, `scs_artifact_source`, `artifact_security`, `code_repo_security`, `scs_artifact_component`, `scs_compliance_result`) → canonical keys, else ranking boost silently drops.
- [ ] src/registry/extractors.ts L223 — pagination hint says `resource_type='security_exemption'` → `application_security_exemption` (guidance).
- [ ] src/tools/harness-list.ts L34, harness-execute.ts L67/L210, scope-utils.ts L53/L122 — comments/describe text (cosmetic).
- [ ] src/prompts/*.ts (10 files: bulk-exemption-create, developer-scorecard, dora-metrics, exempt-opa-failed-issues, exemption-review, feature-flag-rollout, sbom-compliance, security-review, supply-chain-audit, vulnerability-triage) — update old type refs to canonical.
- [ ] src/resources/*, src/data/* — grep for old tokens after merge; update.
- [ ] Stale relatedResources in UNtouched toolsets referencing renamed types (grep all toolsets/ post-merge).

## P6 — docs + full verification (I OWN)
- [ ] `pnpm build && pnpm docs:generate` (fresh build first) → fix `docs:check` counts.
- [ ] `pnpm standards:check` → green.
- [ ] `pnpm test` full → green.
- [ ] grep sweep: no stray old tokens outside `aliases`/`searchAliases`/comments-that-explain-the-alias.
- [ ] Update .env.example / AGENTS.md tool count/toolset-name references if any.

## Wave 4 (optional, deferred) — D7: harness_code umbrella + hyphen→underscore toolset-name standardization.
