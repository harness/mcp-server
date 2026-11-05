# Spec: Migrating `appsec-mcp-servers` (Traceable AppSec) into `harness/mcp-server`

**Status:** Draft
**Date:** 2026-11-04
**Target Repo:** `harness/mcp-server`
**Source Repo:** `appsec-mcp-servers` (`appsec_agent_mcp_server`)
**Hard Constraint:** **Zero new MCP tools.** All capabilities must be exposed through the existing 11 consolidated tools (`harness_list`, `harness_get`, `harness_create`, `harness_update`, `harness_delete`, `harness_execute`, `harness_describe`, `harness_diagnose`, `harness_search`, `harness_status`, `harness_schema`) via a declarative `ToolsetDefinition` in `src/registry/toolsets/appsec.ts`.

---

## 1. Executive Summary & Problem Statement

`appsec-mcp-servers` is a standalone Python FastMCP server that exposes Traceable’s Application & API Security platform (API discovery, sensitive data types, runtime threat activities, AST scans, vulnerabilities, fraud policies, and Trino analytics) over Traceable's GraphQL API (`/graphql`) and Trino (`/v1/statement`).

### 1.1 Why the Current `appsec-mcp-servers` Mental Model Fails

The legacy server exposes **19 individual MCP tools** built around a **"Guided Raw Query Construction"** mental model—treating the LLM as a GraphQL compiler:

1. **Multi-Turn Tool Choreography (5–6 Round Trips per Question):**
   To answer a single user question (e.g., *"Which high-risk APIs expose credit card data?"*), the agent is instructed to call:
   `get_query_time_range` → `get_datatypes_details_from_datatype_names` → `get_attribute_mappings` → `get_graphql_query_template_details` → `execute_graphql_query` → `get_display_urls`.
2. **Prompt-Stuffed Business Logic (`query_details.json` & `application_config.yaml`):**
   Critical query invariants—such as mandatory filters (`isLearnt = true`, `apiDiscoveryState IN [DISCOVERED, UNDER_DISCOVERY]`, `isAiAsset = true`), required `.000Z` timestamp suffixes, `attribute()` vs. `metric()` selection syntax, and 4-part threat activity time windows—are written in ~2,200 lines of prose instructions rather than enforced in code. When the LLM omits a filter, queries silently return inaccurate security counts or GraphQL validation errors.
3. **Context Window Bloat:**
   `get_attribute_mappings` (~2,285 lines) and `get_graphql_query_template_details` (recursive GraphQL `__schema` introspection) dump tens of kilobytes of schema metadata into the LLM context before any data is queried.
4. **"Band-Aid" Compensation Tools:**
   Tools like `get_query_time_range`, `get_threat_activity_timerange`, `calculate_trend_data`, `calculate_api_count_n_days_ago`, and `get_display_urls` exist solely because the server forces the LLM to do epoch millisecond math, multi-query backward trend subtraction, and UI query-string serialization.
5. **No Read/Write Risk Separation:**
   `execute_graphql_query` executes both read queries and arbitrary GraphQL mutations through the same tool, bypassing read-only mode (`HARNESS_READ_ONLY`) and risk-level confirmation (`OperationPolicy`).

### 1.2 Target Architecture in `harness/mcp-server`

Following the exact pattern established by `src/registry/toolsets/ccm.ts` (GraphQL-backed Cloud Cost Management) and `src/registry/toolsets/knowledge-graph.ts` (HQL query execution), we replace the 19 Python tools with a single declarative **`appsec` toolset** (`src/registry/toolsets/appsec.ts`):

- **Zero new MCP tools:** Everything dispatches through `harness_list`, `harness_get`, `harness_create`, `harness_execute`, `harness_describe`, and `harness_search`.
- **Invariants enforced in TypeScript (`bodyBuilder`):** Default filters (`isLearnt = true`, active vulnerability statuses, ±7-day threat activity time window padding, ISO-8601 `.000Z` formatting) are injected deterministically by `bodyBuilder`.
- **Zero-turn enum & filter discovery:** Valid filter keys and enum values (`SEVERITY`, `STATUS`, `SOURCES`, `scope`) are declared in `listFilterFields` and surfaced via `harness_describe`—eliminating `get_attribute_mappings` and `get_vuln_enum_filter_supported_values`.
- **Automatic UI deep links & compaction:** `responseExtractor` flattens GraphQL `selection { value }` / `attribute` envelopes and attaches Traceable/Harness UI URLs automatically—eliminating `get_display_urls`.

---

## 2. Complete 19-Tool Disposition Matrix

Every tool in `appsec_agent_mcp_server/src/appsec_agent_mcp_server/server.py` is accounted for below:

| # | Legacy Python Tool (`appsec-mcp-servers`) | Disposition | Target `mcp-server` Resource & Operation | How It Works in `mcp-server` |
|---|---|---|---|---|
| 1 | `find_apis_by_regex` | **Mapped** | `appsec_api` (`list`) | `harness_list(resource_type="appsec_api", filters={name_regex: "...", ...})`. `bodyBuilder` injects `isLearnt=true` and `apiDiscoveryState` defaults. |
| 2 | `get_api_insights_for_api_id` | **Mapped** | `appsec_api_spec` (`get`) | `harness_get(resource_type="appsec_api_spec", resource_id="<api_id>")` → runs `apiInsightByApiId` GraphQL query and returns OpenAPI YAML. |
| 3 | `get_sample_spans_for_api_id` | **Mapped** | `appsec_api_span` (`list`) | `harness_list(resource_type="appsec_api_span", filters={api_id: "<api_id>"})` → runs `submitAnalyticsQueryBatch` (`SPAN` scope) and normalizes request/response headers, body, cookies, and PII matches. |
| 4 | `lookup_entity_details` | **Mapped** | `appsec_entity` (`list`, `get`) & `appsec_datatype` (`list`, `get`) | `harness_list(resource_type="appsec_entity", filters={scope: "APPLICATION_GROUP", name: "..."})`. |
| 5 | `get_datatypes_details_from_datatype_names` | **Merged** | `appsec_datatype` (`list`) | `harness_list(resource_type="appsec_datatype", filters={names: "Financial Information,SSN"})`. `responseExtractor` applies category expansion (`DATATYPE_MAPPING`) + substring match. |
| 6 | `get_datatypes_details_from_datatype_ids` | **Merged** | `appsec_datatype` (`list`, `get`) | `harness_get(resource_type="appsec_datatype", resource_id="<id>")` or `harness_list(resource_type="appsec_datatype", filters={ids: "id1,id2"})`. |
| 7 | `create_fraud_policy` | **Mapped** | `appsec_fraud_policy` (`create`) | `harness_create(resource_type="appsec_fraud_policy", body={...})` with `operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" }` and SQL validation in `preflight`. |
| 8 | `create_derivation_config` | **Mapped** | `appsec_derivation_config` (`create`) | `harness_create(resource_type="appsec_derivation_config", body={...})`. Accepts structured JSON `features` array (with XML fallback) and validates JEXL in `preflight`. |
| 9 | `execute_graphql_query` | **Mapped** | `appsec_graphql_query` (`execute`: `run`) | `harness_execute(resource_type="appsec_graphql_query", action="run", body={query, variables, operation_name})`. Enforces read-only guard (blocks `mutation` unless via dedicated write resources). |
| 10 | `get_graphql_query_template_details` | **Mapped** | `appsec_graphql_query` (`execute`: `template`, or `get`) | `harness_get(resource_type="appsec_graphql_query", resource_id="<query_name>")` returns curated template + field metadata for long-tail queries. |
| 11 | `execute_trino_query` | **Mapped** | `appsec_trino_query` (`execute`: `run`) | `harness_execute(resource_type="appsec_trino_query", action="run", body={sql_query, limit})`. Runs `checkSql` guard + tenant view redaction before querying Trino. |
| 12 | `get_caller_tenant` | **Eliminated (Internal)** | Handled by `HarnessClient` / auth context | Tenant/account ID is resolved automatically from session auth (`HarnessClient.account` / verified JWT claim) and never requires an LLM round trip. |
| 13 | `get_attribute_mappings` | **Eliminated (Metadata)** | Replaced by `listFilterFields` + `appsec_entity` schema | Common attributes and filter fields per scope are declared in `listFilterFields` (visible via `harness_describe`), with an optional `attributes` param on `appsec_entity`. |
| 14 | `get_vuln_enum_filter_supported_values` | **Eliminated (Metadata)** | `appsec_vulnerability` (`listFilterFields` + `execute`: `enum_values`) | Static enums (`SEVERITY`, `STATUS`, `SOURCES`, `AFFECTED_ENTITY_TYPE`) are declared on `appsec_vulnerability.listFilterFields`. Dynamic tenant-specific values (e.g., `VULNERABILITY_SUB_CATEGORY`, `ENVIRONMENT_ID`) are available via `harness_execute(resource_type="appsec_vulnerability", action="enum_values")`. |
| 15 | `get_query_time_range` | **Eliminated (Internal)** | `bodyBuilder` time window helper (`resolveAppSecTimeWindow`) | Every AppSec resource accepts `time_filter` (`LAST_24_HOURS`, `LAST_7_DAYS`, `LAST_30_DAYS`), `duration_ms`, or `start_time` + `end_time` (ISO-8601, `YYYY-MM-DD`, or epoch ms) and computes UTC `.000Z` strings in TypeScript. |
| 16 | `get_threat_activity_timerange` | **Eliminated (Internal)** | `appsec_threat_activity` (`bodyBuilder`) | `bodyBuilder` automatically expands `[startMs, endMs]` into the 4 mandatory filters (`START_TIME_MILLIS < end`, `START_TIME_MILLIS > start - 7d`, `LAST_SEEN_MILLIS < end + 7d`, `LAST_SEEN_MILLIS > start`). |
| 17 | `calculate_trend_data` | **Eliminated (Internal)** | `appsec_inventory_trend` (`list`) | Single call to `harness_list(resource_type="appsec_inventory_trend", filters={trend_type: "apis" \| "vulnerabilities", period_days: 7})` runs current count (`preflight`) + `submitAnalyticsQueryBatch` and computes the backward daily/weekly series in `responseExtractor`. |
| 18 | `calculate_api_count_n_days_ago` | **Eliminated (Internal)** | `appsec_inventory_trend` (`list`) | Handled by `appsec_inventory_trend` (`current_count - discovered_count + deleted_count`), returning both point-in-time historical count and daily series. |
| 19 | `get_display_urls` | **Eliminated (Internal)** | `responseExtractor` + `deepLinkTemplate` | Every item returned by `appsec_*` resources includes a computed `url` field, and list responses include `filter_url` matching Traceable UI filter query strings. |

---

## 3. Target Resource Catalog (`src/registry/toolsets/appsec.ts`)

The `appsec` toolset defines **11 cohesive `ResourceDefinition`s** under `ToolsetName = "appsec"`:

### 3.1 `appsec_api` — API Endpoint Inventory
Replaces `find_apis_by_regex` and `entities(scope: "API")` queries.

- **Scope:** `"account"` (`headerBasedScoping: true` when routed via Harness gateway, or `product: "appsec"` when targeting standalone Traceable GraphQL)
- **Identifier Fields:** `["api_id"]`
- **Operations:**
  - `list` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - **Default Filters Enforced in `bodyBuilder`:**
      - `isLearnt = true` (unless `include_unlearnt: true`)
      - `apiDiscoveryState IN ["DISCOVERED", "UNDER_DISCOVERY"]` (unless overridden by `discovery_state`)
      - `between`: defaults to last 24 hours (`startTime` / `endTime` formatted with `.000Z`)
      - `includeInactive`: defaults to `true`
      - Default `orderBy`: `[{ direction: "DESC", keyExpression: { key: "riskScore" } }]` (or `numCalls` `SUM` `DESC` when `sort_by: "numCalls"`)
    - **`listFilterFields`:**
      - `name_regex`: Regex/LIKE pattern on API endpoint name (e.g., `".*payment.*"`)
      - `service_name` / `service_id`: Filter by owning service
      - `environment`: Deployment environment (`prod`, `staging`, etc.)
      - `has_pii`: Boolean (`true` filters APIs exposing sensitive data)
      - `datatype_ids`: Comma-separated datatype IDs (`IN` filter on `dataTypeIds`)
      - `risk_score_category`: Enum `["LOW", "MEDIUM", "HIGH", "CRITICAL"]`
      - `is_authenticated`: Boolean
      - `is_external`: Boolean
      - `is_ai_asset`: Boolean
      - `application_group_ids`: Comma-separated application group IDs
      - `change_label`: Enum `["CHANGED"]` (for recently updated APIs)
      - `include_inactive`: Boolean (default `true`)
      - `start_time`, `end_time`, `time_filter` (`LAST_24_HOURS`, `LAST_48_HOURS`, `LAST_7_DAYS`, `LAST_30_DAYS`)
      - `sort_by`: Enum `["riskScore", "numCalls", "errorCount", "createdTime", "lastCalledTime"]`
      - `attributes`: Optional comma-separated extra attribute keys from `attribute_mappings` to include in selection
  - `get` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - Fetches full details for a single `api_id` (`filterBy: [{ keyExpression: { key: "id" }, operator: "EQUALS", value: api_id, type: "ATTRIBUTE" }]`), including `serviceId`, `serviceName`, `environment`, `apiType`, `isAuthenticated`, `authTypes`, `riskScore`, `riskScoreCategory`, `dataTypeIds`, `piiTypes`, `numCalls`, `errorCount`, `lastCalledTime`, `lastScanId`.

---

### 3.2 `appsec_api_spec` — API OpenAPI Specification
Replaces `get_api_insights_for_api_id`.

- **Identifier Fields:** `["api_id"]`
- **Operations:**
  - `get` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - Executes `query($id: String!) { apiInsightByApiId(id: $id) { apiDefinition(apiDefinition: { formats: [OPEN_API_YAML], pagination: { paginationType: NONE } }) { definition } } }`.
    - `responseExtractor` unwraps `{ api_id, definition }` and throws a clear 404/empty message if no OpenAPI spec has been learned for the endpoint.

---

### 3.3 `appsec_api_span` — Sample Trace Spans for an API
Replaces `get_sample_spans_for_api_id` and `tool_impl/span_fetcher.py`.

- **Identifier Fields:** `["api_id"]`
- **Operations:**
  - `list` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - **`listFilterFields`:**
      - `api_id` (`required: true`): Target API endpoint ID
      - `limit`: Number of sample spans (default `2`, max `10`)
      - `lookback_hours`: Time window in hours (default `6`)
    - **`bodyBuilder`:** Builds the `submitAnalyticsQueryBatch` (`batchScope: "EXPLORER_V3"`, `scope: "SPAN"`) query selecting `statusCode`, `spanTags`, `traceId`, `apiId`, `apiName`, `spanResponseBody`, `spanResponseHeaders`, `spanResponseCookies`, `spanRequestBody`, `spanRequestHeaders`, `spanRequestCookies`, `dataClassificationMatches`, `id`, `serviceName`, `userIdentifier`, `sessionId`, `ipAddress`.
    - **`responseExtractor`:** Port of `span_fetcher.py` transformation—parses JSON headers/cookies/bodies into structured `Span` objects ready for JEXL/fraud policy authoring.

---

### 3.4 `appsec_entity` — Multi-Scope Security Inventory Entities
Replaces generic `entities` queries across non-API scopes and `lookup_entity_details`.

- **Identifier Fields:** `["entity_id"]`
- **Supported Entity Scopes (`scope` filter enum):**
  `["SERVICE", "BACKEND", "BACKEND_API", "DOMAIN", "ACTOR", "APPLICATION_ASSET", "APPLICATION_GROUP", "MCP_SERVER", "MCP_TOOL", "MCP_PROMPT", "MCP_RESOURCE"]`
- **Operations:**
  - `list` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - **`bodyBuilder` Per-Scope Mandatory Defaults (from `query_details.json`):**
      - `SERVICE`, `DOMAIN`, `APPLICATION_ASSET`: injects `isLearnt = true`
      - `APPLICATION_ASSET` with `is_ai_asset: true` or `asset_type` in `["MCP_TOOL", "MCP_SERVER", "MCP_PROMPT", "MCP_RESOURCE"]`: injects both `isLearnt = true` AND `isAiAsset = true` (`ai_asset_default`), and selects `numCalls` via `metric(expression: {key: "numCalls"}) { sum { value } }`
      - `BACKEND`: injects `isThirdParty = false`, `id NOT_EQUALS null`
      - `BACKEND_API` (Third-Party APIs): injects `id NOT_EQUALS null`, `isBackendThirdParty = true`, `apiDiscoveryFrom NOT_EQUALS "DEFAULT_ENDPOINT"`
      - `ACTOR`: sets `includeInactive = false`, default window = last 24h, default `orderBy = createdTime DESC`
      - `APPLICATION_GROUP`: supports `name` (`LIKE`) and `ids` (`IN`) for fast name↔ID resolution
  - `get` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - Fetches a single entity by `entity_id` and `params.scope`. Automatically uses `type: "ID", idScope: scope` for `MCP_TOOL` / `MCP_SERVER` / `MCP_PROMPT` / `MCP_RESOURCE` and `type: "ATTRIBUTE", key: "id"` for standard scopes.

---

### 3.5 `appsec_vulnerability` — Vulnerabilities & Security Issues (`vulnerabilitiesV3`)
Replaces `vulnerabilitiesV3` template flow and `get_vuln_enum_filter_supported_values`.

- **Identifier Fields:** `["vulnerability_id"]`
- **Operations:**
  - `list` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - **`bodyBuilder` Invariants:**
      - Always includes the mandatory `results { VULNERABILITY_ID: selection(key: VULNERABILITY_ID) { value } ... }` selection block (preventing the GraphQL validation failure when only `total` is requested).
      - Injects mandatory default `SOURCES` (`RUNTIME_PROTECTION`, `GATEWAY_CONFIGURATION`, `COMPLIANCE`, `SECURITY_TESTING`, `CONFORMANCE_ANALYSIS`) and active `STATUS` (`OPEN`, `REOPENED`, `UNDER_REVIEW`) filters unless overridden by caller filters.
      - Maps `environment` filter to `ENVIRONMENT_ID` (never `MCP_TOOL_ENVIRONMENT` unless `mcp_environment` is passed).
      - Supports `group_by` (`SEVERITY`, `STATUS`, `VULNERABILITY_CATEGORY`, `VULNERABILITY_SUB_CATEGORY`, `ENVIRONMENT_ID`, `SOURCES`, `OWASP_API_TOP10`) and automatically constructs matching `selection` + `COUNT` `aggregation` aliases.
    - **`listFilterFields`:**
      - `severity`: Enum `["VULNERABILITY_SEVERITY_CRITICAL", "VULNERABILITY_SEVERITY_HIGH", "VULNERABILITY_SEVERITY_MEDIUM", "VULNERABILITY_SEVERITY_LOW", "VULNERABILITY_SEVERITY_INFO"]` (also accepts shorthand `"CRITICAL"`, `"HIGH"`, etc. normalized in `bodyBuilder`)
      - `status`: Enum `["VULNERABILITY_STATUS_OPEN", "VULNERABILITY_STATUS_REOPENED", "VULNERABILITY_STATUS_UNDER_REVIEW", "VULNERABILITY_STATUS_FIXED", "VULNERABILITY_STATUS_ACCEPTED_RISK", "VULNERABILITY_STATUS_NOT_A_VULNERABILITY"]`
      - `sources`: Enum `["VULNERABILITY_SOURCE_TYPE_RUNTIME_PROTECTION", "VULNERABILITY_SOURCE_TYPE_SECURITY_TESTING", "VULNERABILITY_SOURCE_TYPE_GATEWAY_CONFIGURATION", "VULNERABILITY_SOURCE_TYPE_COMPLIANCE", "VULNERABILITY_SOURCE_TYPE_CONFORMANCE_ANALYSIS"]`
      - `category`: `VULNERABILITY_CATEGORY` filter
      - `sub_category`: `VULNERABILITY_SUB_CATEGORY` filter
      - `entity_id`, `entity_name`, `affected_entity_type`
      - `service_id`, `environment_id`
      - `owasp_api_top10`, `is_ai_asset`, `has_jira` (maps to `JIRA_ISSUE_URL_FIELD CONTAINS_KEY ""`)
      - `group_by`: Optional dimension for aggregated counts
  - `get` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - Retrieves full details for a single `vulnerability_id`.
  - `executeActions`:
    - `enum_values` (`risk: "read"`, `retryPolicy: "safe"`): Runs the `DISTINCT` aggregation query on `vulnerabilitiesV3` for dynamic tenant-specific enum keys (`VULNERABILITY_SUB_CATEGORY`, `VULNERABILITY_CATEGORY`, `DISPLAY_NAME`, `SUITE_TYPE`, `OWASP`).

---

### 3.6 `appsec_threat_activity` — Runtime Threat Detections (`threatActivity`)
Replaces `threatActivity`, `threatActivityMetadata`, and `get_threat_activity_timerange`.

- **Identifier Fields:** `["threat_activity_id"]`
- **Operations:**
  - `list` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - **`bodyBuilder` Invariants:**
      - Automatically computes the 4 mandatory timestamp filters from `start_time` / `end_time` (default last 24h):
        1. `START_TIME_MILLIS LESS_THAN endMs`
        2. `START_TIME_MILLIS GREATER_THAN startMs - 604800000` (1 week buffer)
        3. `LAST_SEEN_MILLIS LESS_THAN endMs + 604800000` (1 week buffer)
        4. `LAST_SEEN_MILLIS GREATER_THAN startMs`
      - Automatically injects `ACTIVITY_STATUS NOT_IN ["Internal", "Tagged", "Excluded"]`.
      - Enforces non-deprecated plural enum keys (`API_IDS`, `ACTOR_ENTITY_IDS`, `SERVICE_IDS`, `DOMAIN_IDS`, `EVENT_CATEGORY`, `ANOMALOUS_ATTRIBUTES`).
      - Supports single-key `group_by` with `DISTINCT_COUNT` on `ID`.
    - **`listFilterFields`:**
      - `event_category`: Enum `["AI Application Protection", "Web Application Protection", "API Protection", "Custom Policies"]`
      - `behaviour`: Threat rule / behaviour name
      - `severity`: Threat severity filter
      - `api_ids`, `service_ids`, `actor_ids`, `domain_ids`
      - `group_by`: Optional single field to group threat activities by (`EVENT_CATEGORY`, `BEHAVIOUR`, `API_IDS`, `SERVICE_IDS`, `ACTOR_ENTITY_IDS`, `DOMAIN_IDS`)
      - `start_time`, `end_time`, `time_filter`

---

### 3.7 `appsec_security_event` — Security Events, APIs Under Threat & AI Traffic (`explore`)
Replaces `explore` queries across `DOMAIN_EVENT`, `PROTECTION_SPAN`, `APPLICATION_ASSET`, and `SPAN`.

- **Identifier Fields:** `["event_id"]`
- **Operations:**
  - `list` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - **`listFilterFields`:**
      - `scope`: Enum `["DOMAIN_EVENT", "PROTECTION_SPAN", "APPLICATION_ASSET", "SPAN"]` (default `"DOMAIN_EVENT"`)
      - `mode`: Enum `["events", "apis_under_threat", "ai_assets", "ai_traffic"]` — convenience preset that configures default filters and deep-link paths (`security-events-explorer` vs. `apis-under-threat`)
      - `environment`, `service_name`, `api_id`, `actor_id`, `ip_address`, `status_code`
      - `is_ai_asset`, `is_gen_ai`
      - `group_by`: Comma-separated group-by keys. `bodyBuilder` enforces the `explore` GroupBy ↔ Selection invariant (every field in `groupBy.expressions` is automatically added to `results.selection` alongside `count_id: selection(expression: { key: "id" }, aggregation: COUNT)`).
      - `start_time`, `end_time`, `time_filter` (default last 24h)

---

### 3.8 `appsec_ast_scan` — API Security Testing (AST) Scans, Coverage & Auth Hooks
Replaces `searchAst` and `getAstHookTests`.

- **Identifier Fields:** `["suite_id"]`
- **Operations:**
  - `list` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - **`listFilterFields`:**
      - `data_source`: Enum `["SCANS", "API_COVERAGE"]` (default `"SCANS"`)
      - `suite_id`, `suite_name`: Filter to a specific scan suite
      - `scan_id`: Filter by specific scan ID (e.g., from `API.lastScanId`)
      - `scan_run_number`: Specific scan run number
    - **`bodyBuilder` Invariants (from `searchAst` validation rules):**
      - Always includes `SCAN_STATUS: selection(key: SCAN_STATUS)` when `data_source === "SCANS"`.
      - When listing all scans (no `suite_id` / `suite_name`), automatically attaches the `join.subQuery` on `MAX(SCAN_RUN_NUMBER)` grouped by `SCAN_SUITE_ID` and `SCAN_RUN_NUMBER >= 0` safety filter.
      - When listing runs for a specific `suite_id` / `suite_name`, automatically injects `IS_METADATA EQUALS false`.
  - `get` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - When `params.hook_id` is passed (or via `appsec_ast_hook`), executes `getAstHookTests(astHookTestFilters: [{ testIdFilter: { ids: [hook_id] } }])`. Otherwise fetches the latest runs for `suite_id`.

---

### 3.9 `appsec_inventory_trend` — Historical Inventory & Issue Trends
Replaces `submitAnalyticsQueryBatch` + `calculate_trend_data` + `calculate_api_count_n_days_ago`.

- **Identifier Fields:** `[]`
- **Operations:**
  - `list` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - **`listFilterFields`:**
      - `trend_type` (`required: true`): Enum `["apis", "vulnerabilities", "api_risk_increase", "api_risk_decrease"]`
      - `period_days`: Number of days (default `7`, max `30` for daily, max `90` for weekly)
      - `granularity`: Enum `["DAILY", "WEEKLY", "POINT_IN_TIME"]` (auto-selects `DAILY` for ≤30d, `WEEKLY` for 31–90d, or `POINT_IN_TIME` for "count N days ago")
      - `severity`: Optional vulnerability severity filter (for `trend_type: "vulnerabilities"`)
      - `application_group_id`: Optional application group filter
    - **How Single-Call Trend Calculation Works:**
      1. `preflight` hook dispatches a lightweight `limit: 1` query (`entities` for `apis` or `vulnerabilitiesV3` for `vulnerabilities`) to fetch `current_count` and stores it on `input._current_count`.
      2. `bodyBuilder` constructs a single `submitAnalyticsQueryBatch` mutation with two batch queries (`opened` / `discovered` and `closed` / `deleted`) over `[now - period_days, now]` with `executeAsync: true, skipView: true`.
      3. `responseExtractor` runs the exact backward trend algorithm from `calculate_trend_data` (`Yesterday = Current - Today_Opened - Yesterday_Opened + Today_Closed + Yesterday_Closed`, etc.) and returns `{ current_count, count_n_days_ago, period_days, series: [{ date, count, opened, closed }] }`.

---

### 3.10 `appsec_datatype` — Sensitive Data Types (`dataTypes`)
Replaces `get_datatypes_details_from_datatype_names`, `get_datatypes_details_from_datatype_ids`, and `DataTypeLookupHandler`.

- **Identifier Fields:** `["datatype_id"]`
- **Operations:**
  - `list` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - **`listFilterFields`:**
      - `names`: Comma-separated datatype or category names (e.g., `"Financial Information,Credit Card,SSN"`). `responseExtractor` matches against both the 8 category groups (`DATATYPE_MAPPING`: Financial Information, Personal Identification, Contact Information, Authentication Credentials, Location Information, Names, System Identifiers, Miscellaneous) and individual datatype names.
      - `ids`: Comma-separated datatype UUIDs
      - `sensitivity`: Enum `["HIGH", "MEDIUM", "LOW"]`
  - `get` (`POST /graphql`, `risk: "read"`, `retryPolicy: "safe"`):
    - Looks up a single datatype by `datatype_id`.

---

### 3.11 `appsec_fraud_policy` & `appsec_derivation_config` — Policy & Derivation Authoring
Replaces `create_fraud_policy` and `create_derivation_config`.

- **`appsec_derivation_config`:**
  - `create` (`POST /graphql`, `operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" }`):
    - **`bodySchema`:** Accepts structured JSON (`api_id`, `features: [{ name, expression, explanation, type }]`) instead of forcing the LLM to format raw `<JEXLExpressions>` XML (while still accepting `jexl_expressions_xml` for backward compatibility).
    - **`preflight`:** Validates feature names (`snake_case`) and optionally validates JEXL expressions against sample spans when `HARNESS_APPSEC_JEXL_VALIDATOR_URL` is configured.
- **`appsec_fraud_policy`:**
  - `create` (`POST /graphql`, `operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" }`):
    - **`bodySchema`:** `policy_name` (required), `description` (required), `sql_query` (required), `api_id` (required), `associated_event_derivation_config_id` (optional).
    - **`preflight`:** Validates SQL query syntax/structure (`FraudPolicySqlValidator` port) before sending the `CreateFraudPolicy` GraphQL mutation (created with `disabled: true` by default).

---

### 3.12 `appsec_query` — Read-Only GraphQL & Trino Escape Hatch
Replaces `execute_graphql_query`, `get_graphql_query_template_details`, and `execute_trino_query` for ad-hoc analytical queries not covered by the structured resources above.

- **Identifier Fields:** `["query_name"]`
- **Operations:**
  - `get` (`risk: "read"`, `retryPolicy: "safe"`):
    - Returns the query template and schema field guide for `resource_id` (`entities`, `vulnerabilitiesV3`, `explore`, `searchAst`, `threatActivity`, `submitAnalyticsQueryBatch`, `getAstHookTests`).
- **Execute Actions (`harness_execute`):**
  - `graphql` (`POST /graphql`, `operationPolicy: { risk: "read", retryPolicy: "do_not_retry" }`):
    - Executes a read-only GraphQL query (`query`, `variables`, `operation_name`).
    - **Safety Guard in `preflight`:** Validates payload size (≤100KB), operation name length (≤256 chars), and **rejects arbitrary mutations** (except read-equivalent analytics batch `submitAnalyticsQueryBatch`) so write operations cannot bypass `HARNESS_READ_ONLY` or elicitation.
  - `trino` (`POST /v1/statement`, `operationPolicy: { risk: "read", retryPolicy: "do_not_retry" }`):
    - Port of `trino_sql_guard.py` + `trino_query_executor.py`. Enforces read-only `SELECT` / `SHOW` / `DESCRIBE`, verifies tenant view scoping, and redacts other tenants' views on `SHOW TABLES`.

---

## 4. Client, Authentication & Error Handling Integration

To comply with `docs/coding-standards.md` (§11: *HTTP Client Is Singleton — no raw `fetch()` in toolsets*), all HTTP traffic flows through `HarnessClient` (`src/client/harness-client.ts`).

### 4.1 Routing & Configuration (`src/config.ts`)

Traceable AppSec can be accessed either via a Harness Gateway route or directly via a Traceable regional endpoint:

```typescript
// Additions to src/config.ts
HARNESS_APPSEC_BASE_URL: z
  .string()
  .url()
  .optional()
  .describe("Optional Traceable base URL (e.g. https://api.traceable.ai). Defaults to HARNESS_BASE_URL."),
HARNESS_APPSEC_UI_URL: z
  .string()
  .url()
  .optional()
  .describe("Optional Traceable UI base URL for deep links (e.g. https://app.traceable.ai)."),
HARNESS_APPSEC_API_KEY: z
  .string()
  .optional()
  .describe("Optional Traceable API key; falls back to session auth / HARNESS_API_KEY."),
```

- **Gateway Mode (Default):** Requests use `HARNESS_BASE_URL` with standard Harness auth (`x-api-key` or OAuth `Authorization: Bearer <token>`) and `Harness-Account` / `x-tenant-id` headers.
- **Standalone Traceable Mode (`product: "appsec"`):** When `HARNESS_APPSEC_BASE_URL` is configured, `HarnessClient` routes `product: "appsec"` requests to `HARNESS_APPSEC_BASE_URL` with `Authorization: <HARNESS_APPSEC_API_KEY || bearerToken || HARNESS_API_KEY>`.

### 4.2 GraphQL Error Parser (`src/client/error-parsers.ts` & `src/registry/extractors.ts`)

GraphQL endpoints often return HTTP `200 OK` with `{ "errors": [{ "message": "..." }] }`.
- Shared extractor `appsecGraphqlExtract(raw)` in `src/registry/extractors.ts` inspects `raw.errors`: if present and `raw.data` is absent, it throws a `HarnessApiError` with the formatted GraphQL error messages and locations so `toMcpError()` surfaces a clean failure rather than an empty result.

### 4.3 Automatic Deep-Link Builder (`src/utils/deep-links.ts`)

Port the URL construction table from `server.py:get_display_urls` (`ENTITY_SCOPE_TO_PATH_FOR_IDS`, `INVENTORY_SCOPE_TO_PATH_FOR_FILTERS`, `ISSUES_SCOPE_TO_PATH_FOR_FILTERS`, `PROTECTION_SCOPE_TO_PATH_FOR_FILTERS`, `OPERATOR_MAP`) into a pure helper used by `appsec` extractors:
- Each returned entity automatically gets a `url` property (e.g., `${uiBaseUrl}/inventory/endpoint/${id}`, or base64 side-sheet URLs for `ACTOR` and `THREAT_ACTIVITIES`).
- List responses include `filter_url` with the serialized `?filter=key_eq_val` query string.

---

## 5. Schema Budget & Coding Standards Compliance

Per `docs/coding-standards.md` and `docs/schema-budget.md`:

1. **No New Tools:** `tests/coding-standards/docs-consistency.test.ts` and `tests/coding-standards/architecture.test.ts` enforce that only the 11 `harness_*` tools exist.
2. **Compact Schema Budget (`tests/tools/schema-profile.test.ts`):**
   - `HARNESS_SCHEMA_MODE=compact` does not inline per-resource descriptions into `tools/list`, so adding the `appsec` toolset adds **0 bytes** to the compact tool schema budget.
   - In `full` mode, resource type enum names (`appsec_api`, `appsec_entity`, etc.) are added; keep resource descriptions concise and put detailed field guidance in `listFilterFields`, `bodySchema`, and `executeHint` (which are loaded on-demand via `harness_describe`).
3. **Pure-Data Toolset (`tests/coding-standards/file-organization.test.ts`):**
   - `src/registry/toolsets/appsec.ts` exports `appsecToolset: ToolsetDefinition`.
   - Complex builders/extractors are placed in `src/registry/extractors.ts` or helper modules allowed by `file-organization.test.ts`.
   - No `console.log()`, no `createLogger()` inside `src/registry/toolsets/appsec.ts`, and no direct `fetch()` calls.

---

## 6. Phased Implementation Plan

### Phase 1: Core Infrastructure & Read-Only Inventory + Vulnerabilities
1. Add `"appsec"` to `ToolsetName` in `src/registry/types.ts`.
2. Add `appsecGraphqlExtract` and AppSec response extractors + deep-link formatter in `src/registry/extractors.ts`.
3. Create `src/registry/toolsets/appsec.ts` with:
   - `appsec_api` (`list`, `get`)
   - `appsec_api_spec` (`get`)
   - `appsec_api_span` (`list`)
   - `appsec_entity` (`list`, `get`)
   - `appsec_datatype` (`list`, `get`)
   - `appsec_vulnerability` (`list`, `get`, `execute: enum_values`)
4. Register `appsecToolset` in `src/registry/index.ts`.

### Phase 2: Threat Detection, Security Events, AST Scans & Trends
1. Add `appsec_threat_activity` (`list`, `get`) with automatic ±7-day 4-filter window calculation.
2. Add `appsec_security_event` (`list`) covering `explore` scopes (`DOMAIN_EVENT`, `PROTECTION_SPAN`, `APPLICATION_ASSET`, `SPAN`).
3. Add `appsec_ast_scan` (`list`, `get`) covering `searchAst` (`SCANS`, `API_COVERAGE`) and `getAstHookTests`.
4. Add `appsec_inventory_trend` (`list`) combining `preflight` current-count lookup + `submitAnalyticsQueryBatch` + backward daily/weekly trend calculation.

### Phase 3: Policy Creation & Escape-Hatch Query Execution
1. Add `appsec_derivation_config` (`create`) and `appsec_fraud_policy` (`create`) with `medium_write` risk policy and SQL/JEXL preflight validation.
2. Add `appsec_query` (`get` for query templates, `execute: graphql` with mutation guard, and `execute: trino` with SQL guard).

### Phase 4: Verification & Documentation Generation
1. Add unit and contract tests in `tests/registry/appsec.test.ts` verifying:
   - Default filter injection (`isLearnt = true`, `isAiAsset = true`, active vulnerability statuses, 4-part threat activity timestamps).
   - Backward trend calculation parity with Python `calculate_trend_data`.
   - Deep-link URL generation parity with Python `get_display_urls`.
   - Mutation rejection on read-only `appsec_query` execution.
2. Run verification suite:
   ```bash
   pnpm typecheck
   pnpm test
   pnpm standards:check
   pnpm build && pnpm docs:generate
   pnpm docs:check
   ```
   *(Update the two manual toolset/resource count strings in `README.md` per `AGENTS.md` instructions when registering the new toolset).*
