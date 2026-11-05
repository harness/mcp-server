import type { ToolsetDefinition, FilterFieldSpec } from "../types.js";
import {
  appsecEntitiesListExtract,
  appsecEntityGetExtract,
  appsecApiSpecGetExtract,
  appsecApiSpansListExtract,
  appsecVulnerabilitiesListExtract,
  appsecVulnerabilityGetExtract,
  appsecVulnEnumValuesExtract,
  appsecThreatActivityListExtract,
  appsecThreatActivityGetExtract,
  appsecExploreListExtract,
  appsecAstScanListExtract,
  appsecAstScanGetExtract,
  appsecTrendListExtract,
  appsecDatatypesListExtract,
  appsecDatatypeGetExtract,
  appsecFraudPolicyCreateExtract,
  appsecDerivationConfigCreateExtract,
  compactAppSecItem,
} from "../extractors.js";
import {
  ENTITY_SCOPES,
  GRAPHQL_PATH,
  VALID_TIME_FILTERS,
  VULNERABILITY_ALL_STATUSES,
  VULNERABILITY_DEFAULT_SOURCES,
  VULNERABILITY_SEVERITIES,
} from "../appsec/queries.js";
import {
  assertValidAppSecApiId,
  buildApiGetBody,
  buildApiListBody,
  buildApiSpansListBody,
  buildApiSpecGetBody,
  buildAstScanGetBody,
  buildAstScanListBody,
  buildDatatypesBody,
  buildDerivationConfigCreateBody,
  buildEntityGetBody,
  buildEntityListBody,
  buildExploreListBody,
  buildFraudPolicyCreateBody,
  buildInventoryTrendBody,
  buildThreatActivityGetBody,
  buildThreatActivityListBody,
  buildVulnEnumValuesBody,
  buildVulnerabilityGetBody,
  buildVulnerabilityListBody,
  fetchTrendCurrentCountPreflight,
  resolveAppSecTimeWindow,
} from "../appsec/builders.js";

export {
  assertValidAppSecApiId,
  resolveAppSecTimeWindow,
};

const TIME_WINDOW_FILTER_FIELDS: FilterFieldSpec[] = [
  {
    name: "time_filter",
    description: "Relative time window preset",
    enum: VALID_TIME_FILTERS,
  },
  {
    name: "start_time",
    description: "Window start time (ISO-8601 UTC string or epoch milliseconds)",
    type: "string",
  },
  {
    name: "end_time",
    description: "Window end time (ISO-8601 UTC string or epoch milliseconds)",
    type: "string",
  },
];

export const appsecToolset: ToolsetDefinition = {
  name: "appsec",
  displayName: "Application & API Security",
  description:
    "Traceable Application & API Security — discover API endpoints, OpenAPI specs, sample spans, " +
    "sensitive data types (PII), runtime threat activities, security events, AST scans, inventory trends, " +
    "and author fraud policies and event derivation configs.",
  optIn: true,
  resources: [
    // 1. appsec_api
    {
      resourceType: "appsec_api",
      displayName: "AppSec API Endpoint",
      description:
        "Discovered API endpoint in Application & API Security inventory. Supports regex name search, " +
        "PII/datatype filtering, risk score sorting, environment/service filtering, and automatic UI deep links.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["api_id"],
      compactItem: compactAppSecItem,
      searchAliases: ["traceable_api", "endpoint_inventory"],
      relatedResources: [
        {
          resourceType: "appsec_api_spec",
          relationship: "has-one",
          description: "Fetch the learned OpenAPI YAML specification for an api_id",
        },
        {
          resourceType: "appsec_api_span",
          relationship: "has-many",
          description: "Fetch sample request/response trace spans for an api_id",
        },
        {
          resourceType: "appsec_vulnerability",
          relationship: "has-many",
          description: "List runtime and AST vulnerabilities affecting an api_id (pass entity_id)",
        },
      ],
      listFilterFields: [
        { name: "name_regex", description: "Regex/LIKE pattern to match API endpoint paths (e.g. '.*payment.*')" },
        { name: "service_name", description: "Comma-separated owning service names" },
        { name: "service_id", description: "Comma-separated owning service IDs" },
        { name: "environment", description: "Comma-separated deployment environments (e.g. prod, staging)" },
        { name: "has_pii", description: "Filter APIs exposing sensitive/PII data", type: "boolean" },
        { name: "datatype_ids", description: "Comma-separated sensitive datatype IDs (from appsec_datatype)" },
        {
          name: "risk_score_category",
          description: "Risk score category filter",
          enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        },
        { name: "is_authenticated", description: "Filter by authentication requirement", type: "boolean" },
        { name: "is_external", description: "Filter external vs internal APIs", type: "boolean" },
        { name: "is_ai_asset", description: "Filter AI/GenAI API endpoints", type: "boolean" },
        { name: "application_group_ids", description: "Comma-separated application group IDs" },
        { name: "change_label", description: "Filter recently changed APIs", enum: ["CHANGED"] },
        {
          name: "sort_by",
          description: "Sort field (default: riskScore, or numCalls when name_regex is used)",
          enum: ["riskScore", "numCalls", "errorCount", "createdTime", "lastCalledTime"],
        },
        { name: "attributes", description: "Optional comma-separated extra attribute keys to select" },
        ...TIME_WINDOW_FILTER_FIELDS,
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildApiListBody,
          responseExtractor: appsecEntitiesListExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List and search discovered API endpoints with risk score, traffic volume, PII exposure, and UI links",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildApiGetBody,
          responseExtractor: appsecEntityGetExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get full metadata, risk score, sensitive data types, and traffic metrics for a single API endpoint",
        },
      },
    },

    // 2. appsec_api_spec
    {
      resourceType: "appsec_api_spec",
      displayName: "AppSec API OpenAPI Specification",
      description:
        "Learned OpenAPI (YAML) specification for a discovered API endpoint. Pass the endpoint's api_id as resource_id.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["api_id"],
      operations: {
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildApiSpecGetBody,
          responseExtractor: appsecApiSpecGetExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Fetch the OpenAPI YAML definition for an API endpoint by api_id",
        },
      },
    },

    // 3. appsec_api_span
    {
      resourceType: "appsec_api_span",
      displayName: "AppSec API Sample Spans",
      description:
        "Sample request/response trace spans for an API endpoint, with sensitive headers/cookies redacted and bodies bounded.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["api_id"],
      compactItem: compactAppSecItem,
      listFilterFields: [
        { name: "api_id", description: "Target API endpoint ID", required: true },
        { name: "limit", description: "Maximum number of sample spans to fetch (default 2, max 10)", type: "number" },
        { name: "lookback_hours", description: "Lookback window in hours (default 6)", type: "number" },
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildApiSpansListBody,
          responseExtractor: appsecApiSpansListExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List sample trace spans for an API endpoint with redacted auth headers/cookies and bounded bodies",
        },
      },
    },

    // 4. appsec_entity
    {
      resourceType: "appsec_entity",
      displayName: "AppSec Inventory Entity",
      description:
        "Multi-scope security inventory entities: SERVICE, BACKEND, BACKEND_API (third-party APIs), DOMAIN, " +
        "ACTOR (threat actors), APPLICATION_ASSET (including AI/GenAI assets), APPLICATION_GROUP, and MCP assets " +
        "(MCP_SERVER, MCP_TOOL, MCP_PROMPT, MCP_RESOURCE).",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["entity_id"],
      compactItem: compactAppSecItem,
      listFilterFields: [
        {
          name: "scope",
          description: "Entity scope to query (default: SERVICE)",
          enum: [...ENTITY_SCOPES],
        },
        { name: "names", description: "Comma-separated entity names to search (fuzzy LIKE match for single name)" },
        { name: "ids", description: "Comma-separated entity IDs for exact lookup" },
        { name: "environment", description: "Comma-separated environment filter" },
        {
          name: "asset_type",
          description: "For APPLICATION_ASSET scope: filter by assetType (e.g. MCP_SERVER, MCP_TOOL, MCP_PROMPT, MCP_RESOURCE, API)",
        },
        { name: "is_ai_asset", description: "For APPLICATION_ASSET scope: filter AI/MCP assets", type: "boolean" },
        { name: "parent_id", description: "For APPLICATION_ASSET scope: filter child assets by parent MCP server ID" },
        { name: "genai_types", description: "Comma-separated GenAI vendor types (e.g. OpenAI, Anthropic)" },
        { name: "has_sensitive_data", description: "For BACKEND / BACKEND_API: filter entities exposing sensitive data", type: "boolean" },
        { name: "actor_status", description: "For ACTOR scope: status filter (e.g. THREAT_ACTOR)" },
        { name: "score_category", description: "For ACTOR scope: risk score category (e.g. CRITICAL, HIGH)" },
        { name: "attributes", description: "Optional comma-separated extra attribute keys to select" },
        ...TIME_WINDOW_FILTER_FIELDS,
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildEntityListBody,
          responseExtractor: appsecEntitiesListExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List or resolve entities by scope, name, ID, environment, or AI asset type",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildEntityGetBody,
          responseExtractor: appsecEntityGetExtract,
          paramsSchema: {
            fields: [
              {
                name: "entity_id",
                required: true,
                description: "Entity ID (passed via resource_id)",
              },
              {
                name: "scope",
                required: false,
                description: `Entity scope (${ENTITY_SCOPES.join(", ")}); defaults to SERVICE`,
              },
            ],
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get detailed attributes for a single entity by ID and scope",
        },
      },
    },

    // 5. appsec_vulnerability
    {
      resourceType: "appsec_vulnerability",
      displayName: "AppSec Vulnerability",
      description:
        "Traceable Application & API Security runtime, AST, gateway configuration, compliance, and conformance vulnerabilities (`vulnerabilitiesV3`).",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["vulnerability_id"],
      compactItem: compactAppSecItem,
      searchAliases: ["traceable_vulnerability"],
      listFilterFields: [
        {
          name: "severity",
          description: "Comma-separated severity filter (accepts CRITICAL, HIGH, MEDIUM, LOW, INFO or full enum)",
          enum: [...VULNERABILITY_SEVERITIES],
        },
        {
          name: "status",
          description: "Comma-separated status filter (defaults to OPEN, REOPENED, UNDER_REVIEW)",
          enum: [...VULNERABILITY_ALL_STATUSES],
        },
        {
          name: "sources",
          description: "Comma-separated source types (defaults to all 5 sources; use SECURITY_TESTING for AST issues)",
          enum: [...VULNERABILITY_DEFAULT_SOURCES],
        },
        { name: "category", description: "Filter by VULNERABILITY_CATEGORY" },
        { name: "sub_category", description: "Filter by VULNERABILITY_SUB_CATEGORY (e.g. xss_reflected, jwt_token_expiry)" },
        { name: "entity_id", description: "Filter by affected entity ID (e.g. api_id)" },
        { name: "entity_name", description: "Filter by affected entity name (LIKE match)" },
        { name: "affected_entity_type", description: "Filter by affected entity type (e.g. API)" },
        { name: "service_id", description: "Filter by service ID" },
        { name: "environment_id", description: "Filter by environment ID / name" },
        { name: "owasp_api_top10", description: "Filter by OWASP API Top 10 classification" },
        { name: "is_ai_asset", description: "Filter AI asset vulnerabilities", type: "boolean" },
        { name: "has_jira", description: "Filter vulnerabilities with an associated Jira ticket", type: "boolean" },
        {
          name: "group_by",
          description: "Group and count vulnerabilities by dimension",
          enum: [
            "SEVERITY",
            "STATUS",
            "VULNERABILITY_CATEGORY",
            "VULNERABILITY_SUB_CATEGORY",
            "ENVIRONMENT_ID",
            "SOURCES",
            "OWASP_API_TOP10",
            "AFFECTED_ENTITY_TYPE",
          ],
        },
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildVulnerabilityListBody,
          responseExtractor: appsecVulnerabilitiesListExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List or group vulnerabilities with automatic default source and active status filters",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildVulnerabilityGetBody,
          responseExtractor: appsecVulnerabilityGetExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get full details for a single vulnerability by vulnerability_id",
        },
      },
      executeActions: {
        enum_values: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildVulnEnumValuesBody,
          responseExtractor: appsecVulnEnumValuesExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          actionDescription:
            "Discover distinct supported values for dynamic vulnerability filter enum keys (e.g. VULNERABILITY_SUB_CATEGORY, VULNERABILITY_CATEGORY).",
          description: "Fetch distinct supported enum values for vulnerability filter keys",
          bodySchema: {
            description: "Filter enum keys to inspect",
            fields: [
              {
                name: "filter_enum_keys",
                type: "array",
                required: false,
                description: "Array of enum keys (e.g. [\"VULNERABILITY_SUB_CATEGORY\", \"STATUS\"]); defaults to STATUS, SEVERITY, VULNERABILITY_CATEGORY",
              },
            ],
          },
        },
      },
    },

    // 6. appsec_threat_activity
    {
      resourceType: "appsec_threat_activity",
      displayName: "AppSec Threat Activity",
      description:
        "Runtime threat detections and attack activities (`threatActivity`). Automatically applies the mandatory " +
        "4-part ±7-day timestamp window filters and excludes Internal/Tagged/Excluded statuses.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["threat_activity_id"],
      compactItem: compactAppSecItem,
      listFilterFields: [
        {
          name: "event_category",
          description: "Filter by threat event category",
          enum: ["AI Application Protection", "Web Application Protection", "API Protection", "Custom Policies"],
        },
        { name: "behaviour", description: "Filter by threat rule / behaviour name" },
        { name: "severity", description: "Filter by threat severity (CRITICAL, HIGH, MEDIUM, LOW)" },
        { name: "api_ids", description: "Comma-separated target API IDs" },
        { name: "service_ids", description: "Comma-separated target service IDs" },
        { name: "actor_ids", description: "Comma-separated threat actor IDs / names" },
        { name: "domain_ids", description: "Comma-separated target domain IDs" },
        {
          name: "group_by",
          description: "Optional single dimension to group threat counts by",
          enum: ["EVENT_CATEGORY", "BEHAVIOUR", "API_IDS", "API_NAMES", "SERVICE_IDS", "SERVICE_NAMES", "ACTOR_ENTITY_IDS", "DOMAIN_IDS"],
        },
        ...TIME_WINDOW_FILTER_FIELDS,
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildThreatActivityListBody,
          responseExtractor: appsecThreatActivityListExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List or group runtime threat activities with automatic time-window padding and UI deep links",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildThreatActivityGetBody,
          responseExtractor: appsecThreatActivityGetExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get details for a single runtime threat activity by ID",
        },
      },
    },

    // 7. appsec_security_event
    {
      resourceType: "appsec_security_event",
      displayName: "AppSec Security Event & Explorer",
      description:
        "Security event explorer (`explore` query) for DOMAIN_EVENT (security events & APIs under threat), " +
        "PROTECTION_SPAN (threat requests), APPLICATION_ASSET (AI asset distribution), and SPAN (AI/GenAI traffic).",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["event_id"],
      compactItem: compactAppSecItem,
      listFilterFields: [
        {
          name: "scope",
          description: "Explorer scope (default: DOMAIN_EVENT)",
          enum: ["DOMAIN_EVENT", "PROTECTION_SPAN", "APPLICATION_ASSET", "SPAN"],
        },
        {
          name: "mode",
          description: "Preset mode for common explorer workflows",
          enum: ["events", "apis_under_threat", "ai_assets", "ai_traffic"],
        },
        { name: "environment", description: "Filter by environment" },
        { name: "service_name", description: "Filter by service name" },
        { name: "api_id", description: "Filter by API endpoint ID" },
        { name: "actor_id", description: "Filter by actor ID" },
        { name: "ip_address", description: "Filter by client IP address" },
        { name: "is_gen_ai", description: "For SPAN scope: filter GenAI traffic", type: "boolean" },
        { name: "group_by", description: "Comma-separated field keys to group and count by (e.g. 'apiId,apiName')" },
        ...TIME_WINDOW_FILTER_FIELDS,
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildExploreListBody,
          responseExtractor: appsecExploreListExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Explore security events, APIs under threat, AI asset distributions, or GenAI traffic spans",
        },
      },
    },

    // 8. appsec_ast_scan
    {
      resourceType: "appsec_ast_scan",
      displayName: "AppSec AST Scan",
      description:
        "API Security Testing (AST) scan suites, scan runs, API coverage (`searchAst`), and authentication hook tests (`getAstHookTests`).",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["suite_id"],
      compactItem: compactAppSecItem,
      listFilterFields: [
        {
          name: "data_source",
          description: "AST data source: SCANS (scan suites/runs) or API_COVERAGE (per-endpoint test coverage)",
          enum: ["SCANS", "API_COVERAGE"],
        },
        { name: "suite_id", description: "Filter to a specific scan suite ID" },
        { name: "suite_name", description: "Filter to a specific scan suite name" },
        { name: "scan_id", description: "Filter to a specific scan ID (e.g. from API lastScanId)" },
        { name: "scan_run_number", description: "Filter to a specific scan run number", type: "number" },
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildAstScanListBody,
          responseExtractor: appsecAstScanListExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List AST scan suites, scan runs for a suite, or API test coverage for a scan run",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildAstScanGetBody,
          responseExtractor: appsecAstScanGetExtract,
          paramsSchema: {
            fields: [
              { name: "suite_id", required: false, description: "Scan suite ID (passed via resource_id)" },
              { name: "hook_id", required: false, description: "AST authentication hook test ID (fetches hookScript)" },
            ],
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get recent scan runs for a suite_id, or fetch AST auth hook script when hook_id is provided",
        },
      },
    },

    // 9. appsec_inventory_trend
    {
      resourceType: "appsec_inventory_trend",
      displayName: "AppSec Inventory & Vulnerability Trend",
      description:
        "Historical point-in-time counts ('how many APIs/vulnerabilities N days ago') and daily/weekly trend series. " +
        "Automatically fetches current count, queries ACTIVITY_EVENT changes via submitAnalyticsQueryBatch, and computes backward daily counts.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: [],
      compactItem: compactAppSecItem,
      listFilterFields: [
        {
          name: "trend_type",
          description: "Type of trend to calculate",
          enum: ["apis", "vulnerabilities"],
          required: true,
        },
        {
          name: "period_days",
          description: "Number of days to look back (default 7; max 30 for daily, max 90 for weekly)",
          type: "number",
        },
        {
          name: "severity",
          description: "Optional severity filter when trend_type='vulnerabilities' (e.g. CRITICAL, HIGH)",
        },
        {
          name: "application_group_ids",
          description: "Optional application group ID filter when trend_type='apis'",
        },
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          preflight: fetchTrendCurrentCountPreflight,
          bodyBuilder: buildInventoryTrendBody,
          responseExtractor: appsecTrendListExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Compute historical count N days ago and daily/weekly trend series for APIs or vulnerabilities",
        },
      },
    },

    // 10. appsec_datatype
    {
      resourceType: "appsec_datatype",
      displayName: "AppSec Sensitive Data Type",
      description:
        "Sensitive data type (PII) definitions (`dataTypes`). Supports category expansion (e.g. 'Financial Information', " +
        "'Personal Identification', 'Contact Information', 'Authentication Credentials') and fuzzy name or exact ID lookup.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["datatype_id"],
      compactItem: compactAppSecItem,
      listFilterFields: [
        {
          name: "names",
          description:
            "Comma-separated datatype or category names (e.g. 'Financial Information,SSN,Credit Card,Email')",
        },
        { name: "ids", description: "Comma-separated datatype UUIDs" },
        { name: "sensitivity", description: "Filter by sensitivity level", enum: ["HIGH", "MEDIUM", "LOW"] },
      ],
      operations: {
        list: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildDatatypesBody,
          responseExtractor: appsecDatatypesListExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List or search sensitive data types by category/name, IDs, or sensitivity",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyBuilder: buildDatatypesBody,
          responseExtractor: appsecDatatypeGetExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get details for a single sensitive data type by datatype_id",
        },
      },
    },

    // 11. appsec_fraud_policy
    {
      resourceType: "appsec_fraud_policy",
      displayName: "AppSec Fraud Policy",
      description:
        "Custom entity-graph SQL fraud detection policy (`CreateFraudPolicy` mutation). Policies are created in disabled draft state " +
        "(`disabled: true`); review, enable, or delete created policies in the Traceable Protection UI.",
      diagnosticHint:
        "CreateFraudPolicy is a write-only draft authoring mutation (`disabled: true`). To review, enable, or delete a created draft policy, use the Traceable Protection UI under Fraud Policies.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["policy_id"],
      operations: {
        create: {
          method: "POST",
          path: GRAPHQL_PATH,
          bodyWrapperKey: "variables",
          skipScopeBodyInjection: true,
          bodyBuilder: buildFraudPolicyCreateBody,
          responseExtractor: appsecFraudPolicyCreateExtract,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          description: "Create a custom fraud detection policy backed by an entity-graph SQL query",
          bodySchema: {
            description: "Fraud policy creation payload",
            fields: [
              { name: "policy_name", type: "string", required: true, description: "Name for the fraud policy" },
              { name: "description", type: "string", required: true, description: "Description of what the policy detects" },
              { name: "sql_query", type: "string", required: true, description: "Entity-graph SELECT SQL query for the fraud rule" },
              { name: "api_id", type: "string", required: true, description: "Target API endpoint UUID (from appsec_api)" },
              {
                name: "associated_event_derivation_config_id",
                type: "string",
                required: false,
                description: "Optional derivation config ID created via appsec_derivation_config",
              },
            ],
          },
        },
      },
    },

    // 12. appsec_derivation_config
    {
      resourceType: "appsec_derivation_config",
      displayName: "AppSec Event Derivation Config",
      description:
        "JEXL-based event derivation configuration (`CreateDerivationConfig` mutation) that extracts custom attributes from API spans. " +
        "Configs are created in disabled draft state (`disabled: true`); review, enable, or delete created configs in the Traceable Protection UI.",
      diagnosticHint:
        "CreateDerivationConfig is a write-only draft authoring mutation (`disabled: true`). Pass a valid UUID api_id from appsec_api. Review, enable, or delete created derivation configs in the Traceable Protection UI.",
      toolset: "appsec",
      scope: "account",
      product: "appsec",
      headerBasedScoping: true,
      identifierFields: ["derivation_config_id"],
      operations: {
        create: {
          method: "POST",
          path: GRAPHQL_PATH,
          validateInputBody: true,
          skipScopeBodyInjection: true,
          bodyBuilder: buildDerivationConfigCreateBody,
          responseExtractor: appsecDerivationConfigCreateExtract,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          description: "Create an event derivation config from structured JEXL features (or legacy JEXLExpressions XML)",
          bodySchema: {
            description: "Event derivation configuration payload",
            fields: [
              { name: "api_id", type: "string", required: true, description: "Target API endpoint UUID (required)" },
              {
                name: "features",
                type: "array",
                required: false,
                description: "Array of JEXL feature definitions: [{ name (snake_case), expression, explanation, type }]",
                itemType: "object",
              },
              {
                name: "jexl_expressions_xml",
                type: "string",
                required: false,
                description: "Optional legacy <JEXLExpressions><Feature name=\"...\"> XML string (alternative to features array)",
              },
            ],
          },
        },
      },
    },
  ],
};
