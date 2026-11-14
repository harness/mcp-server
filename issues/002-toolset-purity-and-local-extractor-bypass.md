# Issue 002: Toolset Purity, Monolithic Toolset Files, and Local Response Extractor Bypass (`Coding Standards Rule 2 & Rule 3`)

**Status:** Fixed (`fix/registry-taxonomy-and-dispatch-guardrails`) — All 51 Local Extractors & 13 Inline Arrow Extractors Migrated (`0` Violations Remaining)
**Date:** 2026-11-13
**Related:** `docs/coding-standards.md` Rule 2 & Rule 3, `tests/coding-standards/architecture.test.ts`

---

## 1. Problem Statement

### 1.1 Rule 3 Bypass: 51 Toolset-Local Extractors Across 18 Toolset Files

`docs/coding-standards.md` Rule 3 states:

> **3. Use Shared Response Extractors**
> All response extractors live in `src/registry/extractors.ts`. When adding a new toolset, pick the appropriate extractor. Only add a new extractor to `extractors.ts` if no existing one fits — and it must be generic enough to reuse.

Previously, `tests/coding-standards/architecture.test.ts` (`countInlineResponseExtractors`) only checked `/responseExtractor:\s*\(/g` (literal inline arrow functions at the property site). Toolset files that declared `const myExtract = (raw: unknown) => ...` at the top of the file and referenced `responseExtractor: myExtract` bypassed `pnpm standards:check`.

### 1.2 Rule 2 Drift: Monolithic Toolset Files & `src/registry/extractors.ts`

`docs/coding-standards.md` Rule 2 states that files in `src/registry/toolsets/*.ts` are **pure data** and must not contain business logic beyond simple field mapping. However, several toolset files have grown into multi-thousand-line monoliths containing complex input parsers, GraphQL documents, and response projections, while `src/registry/extractors.ts` itself has grown to **2,579 lines**.

---

## 2. Quantitative Audit on `main` (`v3.2.41`)

### 2.1 Top 15 Largest Toolset Files by Line Count & Byte Size

| File | Lines | Bytes | Primary Bloat Drivers |
|---|---:|---:|---|
| `src/registry/toolsets/chaos.ts` | **7,230** | 386,744 B | 41 resources + ~1,500 lines of custom body builders/normalizers and inline schemas |
| `src/registry/toolsets/ai-evals.ts` | **2,900** | 138,714 B | 19 resources + extensive inline body/filter schemas and custom builders |
| `src/registry/toolsets/ccm.ts` | **2,841** | 147,926 B | 25 resources + embedded GraphQL queries, date/filter builders |
| `src/registry/toolsets/feature-flags.ts` | **2,526** | 151,580 B | 19 dual-mode (Split.io + Harness-native) resources + route resolvers and patch builders |
| `src/registry/toolsets/gitops.ts` | **2,302** | 119,288 B | 17 resources + gRPC-gateway body/query builders |
| `src/registry/toolsets/chaos-descriptions.ts` | **2,151** | 260,657 B | Multi-page prose playbooks embedded into toolset descriptions |
| `src/registry/toolsets/pipelines.ts` | **1,554** | 83,993 B | 12 resources + v0/v1 YAML/input-set body builders |
| `src/registry/toolsets/scs.ts` | **1,549** | 95,030 B | 20 resources + 12 local response extractors (~350 lines) |
| `src/registry/toolsets/iacm.ts` | **1,404** | 62,988 B | 7 resources + 12 local JSON:API response extractors (~200 lines) |
| `src/registry/toolsets/dbops.ts` | **966** | 42,508 B | 7 resources + multipart/Liquibase builders |
| `src/registry/toolsets/repositories.ts` | **964** | 42,642 B | 7 resources + rule/commit builders |
| `src/registry/toolsets/sto.ts` | **954** | 57,780 B | 7 resources + preflight user resolution & exemption builders |
| `src/registry/toolsets/autonomous_work.ts` | **930** | 39,322 B | 20 resources + ADLC builders |
| `src/registry/toolsets/release-management.ts` | **846** | 33,435 B | 11 resources + phase/activity input/output endpoints |
| `src/registry/toolsets/idp.ts` | **830** | 39,256 B | 9 resources + entity scope path builders |

### 2.2 All 18 Toolset Files with Local Response Extractors (51 Functions, 86 Endpoint Uses)

| Toolset File | Inline Arrows (`responseExtractor: (`) | Local Extractor Identifiers Defined in Toolset | Endpoint Uses |
|---|---:|---|---:|
| `iacm.ts` | 1 | `workspaceListExtract`, `workspaceGetExtract`, `workspaceWriteExtract`, `variableSetListExtract`, `variableSetExtract`, `iacmResourcesExtract`, `moduleListExtract`, `moduleExtract`, `providerListExtract`, `providerExtract`, `costsListExtract`, `activityChangesExtract` (12) | 19 |
| `scs.ts` | 0 | `artifactSourceListExtract`, `artifactSecurityListExtract`, `artifactComponentListExtract`, `componentDependenciesExtract`, `chainOfCustodyExtract`, `bomViolationListExtract`, `codeRepoListExtract`, `componentRemediationExtract`, `remediationPrListExtract`, `componentVulnerabilityExtract`, `projectSecurityOverviewExtract`, `sbomDownloadExtract` (12) | 12 |
| `feature-flags.ts` | 0 | `fmeActionExtract` (1) | 8 |
| `incidents.ts` | 0 | `incidentGetExtract`, `addRootCauseTheoryExtract` (2) | 8 |
| `alerts.ts` | 0 | `alertGetExtract` (1) | 5 |
| `ansible.ts` | 4 | `ansibleListExtract` (1) | 5 |
| `infrastructure.ts` | 0 | `infrastructurePageExtract`, `infrastructureExtract` (2) | 4 |
| `observability-evaluations.ts` | 0 | `observabilityEvalListExtract`, `observabilityEvalExtract` (2) | 4 |
| `evidence-vault.ts` | 0 | `attestationListExtract`, `attestationDetailsExtract`, `attestationDownloadExtract` (3) | 3 |
| `knowledge-graph.ts` | 1 | `queryableTypeSummaryExtract`, `grammarExtract`, `hqlRunExtract` (3) | 3 |
| `semantic-layer.ts` | 0 | `schemaTypesExtract`, `schemaTypeExtract`, `relatedTypesExtract` (3) | 3 |
| `unified-search.ts` | 0 | `unifiedSearchListExtract`, `unifiedSearchExecuteExtract`, `unifiedSearchSourcesExtract` (3) | 3 |
| `autonomous_work.ts` | 0 | `listResponseExtractor`, `workArtifactListExtract` (2) | 2 |
| `ccm.ts` | 1 | `extractCostCategoryFilterPanel` (1) | 2 |
| `idp.ts` | 1 | `scorecardStatsExtract` (1) | 2 |
| `chaos.ts` | 2 | `chaosComponentVarExtract` (1) | 1 |
| `deploys.ts` | 0 | `deployGetExtract` (1) | 1 |
| `sto.ts` | 3 | `securityIssueListExtract` (1) | 1 |

---

## 3. Solution Implemented in This Branch

1. **Migrated All 51 Toolset-Local Extractors & 13 Inline Arrow Extractors into `src/registry/extractors/`:**
   - Created modular domain extractor files under `src/registry/extractors/`:
     - `src/registry/extractors/iacm.ts` (12 IaCM + 1 Ansible extractors)
     - `src/registry/extractors/scs.ts` (12 SCS + 3 Evidence Vault extractors)
     - `src/registry/extractors/domain.ts` (24 extractors across Alerts, Deploys, Incidents, FME, Infrastructure, IDP, STO, CCM, Autonomous Work, Observability Evals, Knowledge Graph, Semantic Layer, Unified Search)
     - `src/registry/extractors/inline-migrated.ts` (9 extractors migrated from inline arrow functions across CCM, Chaos, Governance, IDP, Knowledge Graph, STO)
   - Re-exported all domain extractors from `src/registry/extractors.ts`.
2. **Burned Down Both Legacy Allowlists in `tests/coding-standards/architecture.test.ts` to `0`:**
   - `ALLOWED_INLINE_EXTRACTOR_COUNTS = {}` (**0 inline arrow extractors allowed in any toolset**)
   - `ALLOWED_LOCAL_EXTRACTOR_REF_COUNTS = {}` (**0 toolset-local extractor functions allowed in any toolset**)
