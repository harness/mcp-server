import type { ToolsetDefinition, PreflightContext, ParamsSchema } from "../types.js";
import type { PathBuilderConfig } from "../types.js";
import { ngExtract, passthrough, gqlExtract, ccmViewsExtract, anomalyListExtract, ccmBreakdownExtract, ccmTimeseriesExtract, ccmSummaryExtract, ccmRecommendationsExtract } from "../extractors.js";

// ---------------------------------------------------------------------------
// GraphQL queries — ported from the official Go MCP server
// (client/ccmcommons/ccmgraphqlqueries.go)
// ---------------------------------------------------------------------------

const PERSPECTIVE_GRID_QUERY = `
query FetchperspectiveGrid(
  $filters: [QLCEViewFilterWrapperInput],
  $groupBy: [QLCEViewGroupByInput],
  $limit: Int,
  $offset: Int,
  $aggregateFunction: [QLCEViewAggregationInput],
  $isClusterOnly: Boolean!,
  $isClusterHourlyData: Boolean = null,
  $preferences: ViewPreferencesInput
) {
  perspectiveGrid(
    aggregateFunction: $aggregateFunction
    filters: $filters
    groupBy: $groupBy
    limit: $limit
    offset: $offset
    preferences: $preferences
    isClusterHourlyData: $isClusterHourlyData
    sortCriteria: [{sortType: COST, sortOrder: DESCENDING}]
  ) {
    data { name id cost costTrend __typename }
    __typename
  }
  perspectiveTotalCount(
    filters: $filters
    groupBy: $groupBy
    isClusterQuery: $isClusterOnly
    isClusterHourlyData: $isClusterHourlyData
  )
}`;

const PERSPECTIVE_TIMESERIES_QUERY = `
query FetchPerspectiveTimeSeries(
  $filters: [QLCEViewFilterWrapperInput],
  $groupBy: [QLCEViewGroupByInput],
  $limit: Int,
  $preferences: ViewPreferencesInput,
  $isClusterHourlyData: Boolean = null
) {
  perspectiveTimeSeriesStats(
    filters: $filters
    groupBy: $groupBy
    limit: $limit
    preferences: $preferences
    isClusterHourlyData: $isClusterHourlyData
    aggregateFunction: [{operationType: SUM, columnName: "cost"}]
    sortCriteria: [{sortType: COST, sortOrder: DESCENDING}]
  ) {
    stats {
      values {
        key { id name type __typename }
        value
        __typename
      }
      time
      __typename
    }
    __typename
  }
}`;

const PERSPECTIVE_SUMMARY_QUERY = `
query FetchPerspectiveDetailsSummaryWithBudget(
  $filters: [QLCEViewFilterWrapperInput],
  $aggregateFunction: [QLCEViewAggregationInput],
  $isClusterQuery: Boolean,
  $isClusterHourlyData: Boolean = null,
  $groupBy: [QLCEViewGroupByInput],
  $preferences: ViewPreferencesInput
) {
  perspectiveTrendStats(
    filters: $filters
    aggregateFunction: $aggregateFunction
    isClusterQuery: $isClusterQuery
    isClusterHourlyData: $isClusterHourlyData
    groupBy: $groupBy
    preferences: $preferences
  ) {
    cost { statsDescription statsLabel statsTrend statsValue value __typename }
    idleCost { statsLabel statsValue value __typename }
    unallocatedCost { statsLabel statsValue value __typename }
    utilizedCost { statsLabel statsValue value __typename }
    efficiencyScoreStats { statsLabel statsTrend statsValue __typename }
    __typename
  }
  perspectiveForecastCost(
    filters: $filters
    aggregateFunction: $aggregateFunction
    isClusterQuery: $isClusterQuery
    isClusterHourlyData: $isClusterHourlyData
    groupBy: $groupBy
    preferences: $preferences
  ) {
    cost { statsLabel statsTrend statsValue statsDescription value __typename }
    __typename
  }
}`;

const PERSPECTIVE_BUDGET_QUERY = `
query FetchPerspectiveBudget($perspectiveId: String) {
  budgetSummaryList(perspectiveId: $perspectiveId) {
    id name budgetAmount actualCost timeLeft timeUnit timeScope period folderId __typename
  }
}`;

const CCM_METADATA_QUERY = `
query FetchCcmMetaData {
  ccmMetaData {
    k8sClusterConnectorPresent cloudDataPresent awsConnectorsPresent
    gcpConnectorsPresent azureConnectorsPresent applicationDataPresent
    inventoryDataPresent clusterDataPresent externalDataPresent
    isSampleClusterPresent defaultAzurePerspectiveId defaultAwsPerspectiveId
    defaultGcpPerspectiveId defaultClusterPerspectiveId
    defaultExternalDataPerspectiveId showCostOverview
    currencyPreference { destinationCurrency symbol locale setupTime __typename }
    __typename
  }
}`;

const PERSPECTIVE_RECOMMENDATIONS_QUERY = `
query PerspectiveRecommendations($filter: RecommendationFilterDTOInput) {
  recommendationStatsV2(filter: $filter) {
    totalMonthlyCost totalMonthlySaving count __typename
  }
  recommendationsV2(filter: $filter) {
    items {
      clusterName namespace id resourceType resourceName
      monthlyCost monthlySaving __typename
    }
    __typename
  }
}`;

// ---------------------------------------------------------------------------
// GraphQL helper builders — TypeScript equivalents of the Go filter helpers
// ---------------------------------------------------------------------------

const VALID_TIME_FILTERS = [
  "LAST_7", "THIS_MONTH", "LAST_30_DAYS", "THIS_QUARTER", "THIS_YEAR",
  "LAST_MONTH", "LAST_QUARTER", "LAST_YEAR", "LAST_3_MONTHS",
  "LAST_6_MONTHS", "LAST_12_MONTHS",
] as const;

const VALID_GROUP_BY_FIELDS = [
  "region", "awsUsageaccountid", "awsServicecode", "awsBillingEntity",
  "awsInstancetype", "awsLineItemType", "awspayeraccountid", "awsUsageType",
  "cloudProvider", "none", "product",
] as const;

const OUTPUT_FIELDS: Record<string, Record<string, string>> = {
  region:              { fieldId: "region",              fieldName: "Region",         identifier: "COMMON", identifierName: "Common" },
  awsUsageaccountid:   { fieldId: "awsUsageaccountid",   fieldName: "Account",        identifier: "AWS",    identifierName: "AWS" },
  awsServicecode:      { fieldId: "awsServicecode",      fieldName: "Service",        identifier: "AWS",    identifierName: "AWS" },
  awsBillingEntity:    { fieldId: "awsBillingEntity",     fieldName: "Billing Entity", identifier: "AWS",    identifierName: "AWS" },
  awsInstancetype:     { fieldId: "awsInstancetype",      fieldName: "Instance Type",  identifier: "AWS",    identifierName: "AWS" },
  awsLineItemType:     { fieldId: "awsLineItemType",      fieldName: "Line Item Type", identifier: "AWS",    identifierName: "AWS" },
  awspayeraccountid:   { fieldId: "awspayeraccountid",    fieldName: "Payer Account",  identifier: "AWS",    identifierName: "AWS" },
  awsUsageType:        { fieldId: "awsUsageType",         fieldName: "Usage Type",     identifier: "AWS",    identifierName: "AWS" },
  cloudProvider:       { fieldId: "cloudProvider",        fieldName: "Cloud Provider", identifier: "COMMON", identifierName: "Common" },
  none:                { fieldId: "none",                 fieldName: "None",           identifier: "COMMON", identifierName: "Common" },
  product:             { fieldId: "product",              fieldName: "Product",        identifier: "COMMON", identifierName: "Common" },
};

function buildTimeFilters(timeFilter: string): Record<string, unknown>[] {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (timeFilter) {
    case "LAST_7": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      break;
    }
    case "THIS_MONTH": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      break;
    }
    case "LAST_30_DAYS": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 30));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      break;
    }
    case "THIS_QUARTER": {
      const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
      start = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      break;
    }
    case "THIS_YEAR": {
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      break;
    }
    case "LAST_MONTH": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      break;
    }
    case "LAST_QUARTER": {
      const currentQuarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
      start = new Date(Date.UTC(now.getUTCFullYear(), currentQuarterStartMonth - 3, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), currentQuarterStartMonth, 0, 23, 59, 59, 999));
      break;
    }
    case "LAST_YEAR": {
      start = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
      end = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31, 23, 59, 59, 999));
      break;
    }
    case "LAST_3_MONTHS": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      break;
    }
    case "LAST_6_MONTHS": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      break;
    }
    case "LAST_12_MONTHS": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      break;
    }
    default: {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 30));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      break;
    }
  }

  return [
    { timeFilter: { field: { fieldId: "startTime", fieldName: "startTime", identifier: "COMMON" }, operator: "AFTER", value: start.getTime() } },
    { timeFilter: { field: { fieldId: "startTime", fieldName: "startTime", identifier: "COMMON" }, operator: "BEFORE", value: end.getTime() } },
  ];
}

function buildViewFilter(viewId: string): Record<string, unknown>[] {
  return [{ viewMetadataFilter: { viewId, isPreview: false } }];
}

function buildFilters(viewId: string, timeFilter: string): Record<string, unknown>[] {
  return [...buildViewFilter(viewId), ...buildTimeFilters(timeFilter)];
}

function buildGroupBy(field?: string): Record<string, unknown>[] {
  if (!field) {
    return [{ entityGroupBy: OUTPUT_FIELDS["product"] }];
  }

  // Check if it's a predefined field (region, product, awsServicecode, etc.)
  if (OUTPUT_FIELDS[field]) {
    return [{ entityGroupBy: OUTPUT_FIELDS[field] }];
  }

  // Not a predefined field — treat as a label key (e.g. "env", "team", "environment")
  // Use LABEL_V2 identifier with the field name as the label key
  return [{
    entityGroupBy: {
      fieldId: "labels.value",
      fieldName: field,
      identifier: "LABEL_V2",
      identifierName: "Label V2",
    }
  }];
}

function buildAggregateFunction(): Record<string, string>[] {
  return [{ operationType: "SUM", columnName: "cost" }];
}

function buildPreferences(): Record<string, unknown> {
  return {
    includeOthers: false,
    includeUnallocatedCost: false,
    awsPreferences: {
      includeDiscounts: false,
      includeCredits: false,
      includeRefunds: false,
      includeTaxes: false,
      awsCost: "UNBLENDED",
    },
    gcpPreferences: null,
    azureViewPreferences: null,
    showAnomalies: false,
  };
}

// ---------------------------------------------------------------------------
// GraphQL endpoint path helper
// ---------------------------------------------------------------------------

function gqlPath(input: Record<string, unknown>): string {
  const accountId = input.account_id as string | undefined;
  if (accountId) {
    return `/ccm/api/graphql?accountIdentifier=${accountId}&routingId=${accountId}`;
  }
  return "/ccm/api/graphql";
}

/**
 * Normalizes REST cost_category responses into the same {values} shape
 * that perspectiveFilters returns, so callers get a uniform interface.
 *
 * - No value_sub_type → list endpoint → extract category names from the list
 * - With value_sub_type → get endpoint → extract costTarget bucket names
 */
function extractBusinessMappingValues(raw: unknown, valueSubType?: string): unknown {
  // Unwrap NG envelope: response may be { data: ... } or { resource: ... }
  const envelope = raw as { data?: unknown; resource?: unknown } | undefined;
  const unwrapped = envelope?.data ?? envelope?.resource ?? raw;

  if (valueSubType) {
    // Single category GET: unwrapped is { costTargets: [{ name }], ... }
    const entity = unwrapped as Record<string, unknown>;
    const targets = entity.costTargets as Array<{ name?: string }> | undefined;
    if (!Array.isArray(targets)) {
      return { values: [], _error: "No costTargets found in response" };
    }
    return {
      values: targets.map(t => t.name).filter(Boolean),
    };
  }
  // List all categories: unwrapped is { businessMappings: [{ uuid, name }] }
  const data = unwrapped as Record<string, unknown>;
  const mappings = data.businessMappings as Array<{ uuid?: string; name?: string }> | undefined;
  if (Array.isArray(mappings)) {
    return {
      values: mappings.map(m => m.name).filter(Boolean),
    };
  }
  // Fallback: if unwrapped is already an array
  if (Array.isArray(unwrapped)) {
    return {
      values: (unwrapped as Array<{ name?: string }>).map(m => m.name).filter(Boolean),
    };
  }
  return { values: [], _error: "Unexpected response shape — no businessMappings or array found" };
}

// ---------------------------------------------------------------------------
// Perspective preferences preflight — mirrors Go server's
// GetPerspectivePreferenceDefaults + overlay pattern
// ---------------------------------------------------------------------------

interface SettingsValue {
  identifier?: string;
  value?: string;
}

function mapSettingsToViewPreferences(settings: SettingsValue[]): Record<string, unknown> {
  const get = (id: string): string | undefined =>
    settings.find(s => s.identifier === id)?.value;
  const getBool = (id: string): boolean | undefined => {
    const v = get(id);
    return v !== undefined ? v === "true" : undefined;
  };

  const prefs: Record<string, unknown> = {};

  const includeOthers = getBool("show_others");
  if (includeOthers !== undefined) prefs.includeOthers = includeOthers;
  const showAnomalies = getBool("show_anomalies");
  if (showAnomalies !== undefined) prefs.showAnomalies = showAnomalies;
  const includeUnallocated = getBool("show_unallocated_cluster_cost");
  if (includeUnallocated !== undefined) prefs.includeUnallocatedCost = includeUnallocated;

  // AWS preferences
  const awsPrefs: Record<string, unknown> = {};
  const awsDisc = getBool("include_aws_discounts");
  if (awsDisc !== undefined) awsPrefs.includeDiscounts = awsDisc;
  const awsCred = getBool("include_aws_credit");
  if (awsCred !== undefined) awsPrefs.includeCredits = awsCred;
  const awsRef = getBool("include_aws_refunds");
  if (awsRef !== undefined) awsPrefs.includeRefunds = awsRef;
  const awsTax = getBool("include_aws_taxes");
  if (awsTax !== undefined) awsPrefs.includeTaxes = awsTax;
  const awsCost = get("show_aws_cost_as");
  if (awsCost) awsPrefs.awsCost = awsCost;
  if (Object.keys(awsPrefs).length > 0) prefs.awsPreferences = awsPrefs;

  // GCP preferences
  const gcpPrefs: Record<string, unknown> = {};
  const gcpDisc = getBool("include_gcp_discounts");
  if (gcpDisc !== undefined) gcpPrefs.includeDiscounts = gcpDisc;
  const gcpTax = getBool("include_gcp_taxes");
  if (gcpTax !== undefined) gcpPrefs.includeTaxes = gcpTax;
  const gcpPromo = getBool("include_gcp_promotions");
  if (gcpPromo !== undefined) gcpPrefs.includePromotions = gcpPromo;
  const gcpNeg = getBool("include_gcp_negotiated_savings");
  if (gcpNeg !== undefined) gcpPrefs.includeNegotiatedSavings = gcpNeg;
  const gcpSub = getBool("include_gcp_subscription_credits");
  if (gcpSub !== undefined) gcpPrefs.includeSubscriptionCredits = gcpSub;
  const gcpSus = getBool("include_gcp_sustained_use_discounts");
  if (gcpSus !== undefined) gcpPrefs.includeSustainedUseDiscounts = gcpSus;
  const gcpRes = getBool("include_gcp_resource_based_cud_credits");
  if (gcpRes !== undefined) gcpPrefs.includeResourceBasedCudCredits = gcpRes;
  const gcpLeg = getBool("include_gcp_legacy_based_cud_credits");
  if (gcpLeg !== undefined) gcpPrefs.includeLegacyBasedCudCredits = gcpLeg;
  const gcpSpend = getBool("include_gcp_spend_based_cud_discounts");
  if (gcpSpend !== undefined) gcpPrefs.includeSpendBasedCudDiscounts = gcpSpend;
  if (Object.keys(gcpPrefs).length > 0) prefs.gcpPreferences = gcpPrefs;

  // Azure preferences
  const azureCost = get("show_azure_cost_as");
  if (azureCost) prefs.azureViewPreferences = { costType: azureCost };

  return prefs;
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const ov = override[key];
    if (ov !== undefined && ov !== null) {
      if (typeof ov === "object" && !Array.isArray(ov) && typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key])) {
        result[key] = deepMerge(result[key] as Record<string, unknown>, ov as Record<string, unknown>);
      } else {
        result[key] = ov;
      }
    }
  }
  return result;
}

/**
 * Preflight hook for cost_perspective.create: fetches account-level preference
 * defaults from the Settings API and uses them as a baseline. Agent-provided
 * viewPreferences fields are overlaid on top (agent wins).
 *
 * Mirrors the Go MCP server pattern at:
 * mcpServerInternal/mcp-server-pkg/common/pkg/tools/ccmperspectives.go
 */
async function perspectiveCreatePreflight(ctx: PreflightContext): Promise<void> {
  const { client } = ctx;
  const input = ctx.input as { body?: Record<string, unknown> };
  if (!input.body) input.body = {};

  const accountId = client.account;
  if (!accountId) return;

  // Fetch account preference defaults
  try {
    const resp = await client.request<{ resource?: SettingsValue[]; data?: SettingsValue[] } | SettingsValue[]>({
      method: "GET",
      path: "/ng/api/settings",
      params: {
        accountIdentifier: accountId,
        category: "CE",
        group: "perspective_preferences",
      },
    });

    const settings = Array.isArray(resp)
      ? resp
      : (resp as { resource?: SettingsValue[]; data?: SettingsValue[] }).resource
        ?? (resp as { resource?: SettingsValue[]; data?: SettingsValue[] }).data
        ?? [];

    if (settings.length > 0) {
      const defaults = mapSettingsToViewPreferences(settings);
      const agentPrefs = (input.body.viewPreferences ?? {}) as Record<string, unknown>;
      input.body.viewPreferences = deepMerge(defaults, agentPrefs);
    }
  } catch {
    // Graceful degradation — proceed without defaults
  }

  // Set other defaults if absent
  if (!input.body.viewState) input.body.viewState = "COMPLETED";
  if (!input.body.viewType) input.body.viewType = "CUSTOMER";
  if (!input.body.viewVersion) input.body.viewVersion = "v1";
}

// ---------------------------------------------------------------------------
// Toolset definition: 6 resource types covering REST + GraphQL
// ---------------------------------------------------------------------------

export const ccmToolset: ToolsetDefinition = {
  name: "ccm",
  displayName: "Cloud Cost Management",
  description:
    "Cloud cost visibility, analysis, recommendations, and anomaly detection. Covers perspectives, cost breakdowns, time series, summaries, recommendations, and anomalies.",
  resources: [
    // ------------------------------------------------------------------
    // 1. cost_perspective — REST CRUD for perspective management
    // ------------------------------------------------------------------
    {
      resourceType: "cost_perspective",
      displayName: "Cost Perspective",
      description:
        "A cloud cost perspective (saved view). Use harness_list to see all perspectives, harness_get for details. This is the starting point — get a perspective_id first, then use cost_breakdown or cost_timeseries to drill into costs.",
      toolset: "ccm",
      scope: "account",
      identifierFields: ["perspective_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter perspectives by name" },
        { name: "sort_type", description: "Sort field (default: TIME)", enum: ["TIME", "COST", "CLUSTER_COST", "NAME"] },
        { name: "sort_order", description: "Sort direction", enum: ["ASCENDING", "DESCENDING"] },
        { name: "cloud_filter", description: "Filter by cloud provider", enum: ["AWS", "GCP", "AZURE", "CLUSTER", "DEFAULT"] },
        { name: "view_state", description: "Filter by state", enum: ["DRAFT", "COMPLETED"] },
        { name: "view_type", description: "Filter by type", enum: ["SAMPLE", "CUSTOMER", "DEFAULT"] },
        { name: "view_ids", description: "Filter by specific perspective IDs (comma-separated or array)" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ccm/api/perspective/getAllPerspectives",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchKey",
            sort_type: "sortType",
            sort_order: "sortOrder",
            cloud_filter: "cloudFilters",
            view_state: "viewState",
            view_type: "viewType",
            view_ids: "viewIds",
            page: "pageNo",
            size: "pageSize",
          },
          responseExtractor: ccmViewsExtract,
          description: "List all cost perspectives for the account",
        },
        get: {
          method: "GET",
          path: "/ccm/api/perspective",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { perspective_id: "perspectiveId" },
          responseExtractor: ngExtract,
          description: "Get cost perspective details by ID",
        },
        create: {
          method: "POST",
          path: "/ccm/api/perspective",
          preflight: perspectiveCreatePreflight,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Cost perspective definition. viewPreferences defaults are auto-fetched from account settings and merged — agent-provided values override.",
            fields: [
              { name: "name", type: "string", required: true, description: "Perspective name (1-80 chars)" },
              { name: "viewVisualization", type: "object", required: false, description: "Chart config: { granularity: 'DAY'|'MONTH', groupBy: { fieldId, fieldName, identifier, identifierName }, chartType: 'STACKED_TIME_SERIES'|'STACKED_LINE_CHART' }" },
              {
                name: "viewRules", type: "array", required: false,
                description: "Filter rules. Multiple rules are OR-ed. Each rule has viewConditions (AND-ed). Each ViewIdCondition: { type: 'VIEW_ID_CONDITION', viewField: { fieldId, fieldName, identifier (COMMON|AWS|GCP|AZURE|CLUSTER|LABEL|LABEL_V2|BUSINESS_MAPPING|EXTERNAL_DATA), identifierName }, viewOperator: 'IN'|'NOT_IN'|'LIKE'|'NOT_NULL'|'NULL', values: string[] }",
                itemType: "{ viewConditions: [{ type: 'VIEW_ID_CONDITION', viewField: { fieldId: string, fieldName: string, identifier: string, identifierName: string }, viewOperator: 'IN' | 'NOT_IN' | 'LIKE' | 'NOT_NULL' | 'NULL', values: string[] }] }",
              },
              { name: "viewTimeRange", type: "object", required: false, description: "Time range: { viewTimeRangeType: 'LAST_7'|'LAST_30'|'LAST_MONTH'|'CURRENT_MONTH'|'LAST_QUARTER'|'CURRENT_QUARTER'|'LAST_3_MONTH'|'CUSTOM', startTime?: number (epoch ms), endTime?: number (epoch ms) }" },
              { name: "folderId", type: "string", required: false, description: "Target folder ID to place perspective in" },
              { name: "viewVersion", type: "string", required: false, description: "View version (default: 'v1')" },
              { name: "dataSources", type: "array", required: false, description: "Data sources: CLUSTER|AWS|GCP|AZURE|EXTERNAL_DATA|OPENAI|ANTHROPIC|COMMON|CUSTOM|BUSINESS_MAPPING|LABEL|LABEL_V2" },
              { name: "viewType", type: "string", required: false, description: "Perspective type (default: 'CUSTOMER'): SAMPLE|CUSTOMER|DEFAULT" },
              { name: "viewState", type: "string", required: false, description: "State (default: 'COMPLETED'): DRAFT|COMPLETED" },
              { name: "viewPreferences", type: "object", required: false, description: "Cost display preferences. Account defaults auto-applied as baseline; provide fields here to override. Shape: { showAnomalies?: bool, includeOthers?: bool, includeUnallocatedCost?: bool, awsPreferences?: { includeDiscounts, includeCredits, includeRefunds, includeTaxes: bool, awsCost: 'AMORTISED'|'NET_AMORTISED'|'BLENDED'|'UNBLENDED'|'EFFECTIVE' }, gcpPreferences?: { includeDiscounts, includeTaxes, includePromotions, includeNegotiatedSavings, includeSubscriptionCredits, includeSustainedUseDiscounts, includeResourceBasedCudCredits, includeLegacyBasedCudCredits, includeSpendBasedCudDiscounts: bool }, azureViewPreferences?: { costType: 'ACTUAL'|'AMORTIZED' } }" },
              { name: "unitMetricInfo", type: "array", required: false, description: "Unit metrics: [{ name (max 80), kind: 'DIVISION'|'FORMULA', unitMetricNumerator: { operands: [{ type: 'VIEW'|'METRIC', operandName }], operators: ['ADD'|'SUBTRACT'|'MULTIPLY'|'DIVIDE'] }, unitMetricDenominator: { ... } }]" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Create a new cost perspective",
        },
        update: {
          method: "PUT",
          path: "/ccm/api/perspective",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Cost perspective update. Fetch the existing perspective via harness_get first, modify the fields, and send the full object back. No preflight defaults — only explicitly provided fields are sent.",
            fields: [
              { name: "uuid", type: "string", required: true, description: "Perspective UUID (from get)" },
              { name: "name", type: "string", required: true, description: "Perspective name (1-80 chars)" },
              { name: "viewVisualization", type: "object", required: false, description: "Chart config: { granularity: 'DAY'|'MONTH', groupBy: { fieldId, fieldName, identifier, identifierName }, chartType: 'STACKED_TIME_SERIES'|'STACKED_LINE_CHART' }" },
              {
                name: "viewRules", type: "array", required: false,
                description: "Filter rules. Multiple rules are OR-ed. Each rule has viewConditions (AND-ed). Each ViewIdCondition: { type: 'VIEW_ID_CONDITION', viewField: { fieldId, fieldName, identifier (COMMON|AWS|GCP|AZURE|CLUSTER|LABEL|LABEL_V2|BUSINESS_MAPPING|EXTERNAL_DATA), identifierName }, viewOperator: 'IN'|'NOT_IN'|'LIKE'|'NOT_NULL'|'NULL', values: string[] }",
                itemType: "{ viewConditions: [{ type: 'VIEW_ID_CONDITION', viewField: { fieldId: string, fieldName: string, identifier: string, identifierName: string }, viewOperator: 'IN' | 'NOT_IN' | 'LIKE' | 'NOT_NULL' | 'NULL', values: string[] }] }",
              },
              { name: "viewTimeRange", type: "object", required: false, description: "Time range: { viewTimeRangeType: 'LAST_7'|'LAST_30'|'LAST_MONTH'|'CURRENT_MONTH'|'LAST_QUARTER'|'CURRENT_QUARTER'|'LAST_3_MONTH'|'CUSTOM', startTime?: number (epoch ms), endTime?: number (epoch ms) }" },
              { name: "folderId", type: "string", required: false, description: "Target folder ID" },
              { name: "viewVersion", type: "string", required: false, description: "View version" },
              { name: "dataSources", type: "array", required: false, description: "Data sources: CLUSTER|AWS|GCP|AZURE|EXTERNAL_DATA|OPENAI|ANTHROPIC|COMMON|CUSTOM|BUSINESS_MAPPING|LABEL|LABEL_V2" },
              { name: "viewType", type: "string", required: false, description: "Perspective type: SAMPLE|CUSTOMER|DEFAULT" },
              { name: "viewState", type: "string", required: false, description: "State: DRAFT|COMPLETED" },
              { name: "viewPreferences", type: "object", required: false, description: "Cost display preferences: { showAnomalies?: bool, includeOthers?: bool, includeUnallocatedCost?: bool, awsPreferences?: { includeDiscounts, includeCredits, includeRefunds, includeTaxes: bool, awsCost: 'AMORTISED'|'NET_AMORTISED'|'BLENDED'|'UNBLENDED'|'EFFECTIVE' }, gcpPreferences?: { includeDiscounts, includeTaxes, includePromotions, includeNegotiatedSavings, includeSubscriptionCredits, includeSustainedUseDiscounts, includeResourceBasedCudCredits, includeLegacyBasedCudCredits, includeSpendBasedCudDiscounts: bool }, azureViewPreferences?: { costType: 'ACTUAL'|'AMORTIZED' } }" },
              { name: "unitMetricInfo", type: "array", required: false, description: "Unit metrics: [{ name (max 80), kind: 'DIVISION'|'FORMULA', unitMetricNumerator: { operands: [{ type: 'VIEW'|'METRIC', operandName }], operators: ['ADD'|'SUBTRACT'|'MULTIPLY'|'DIVIDE'] }, unitMetricDenominator: { ... } }]" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Update an existing cost perspective",
        },
        delete: {
          method: "DELETE",
          path: "/ccm/api/perspective",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          queryParams: { perspective_id: "perspectiveId" },
          responseExtractor: ngExtract,
          description: "Delete a cost perspective",
        },
      },
      executeActions: {
        clone: {
          method: "POST",
          path: "/ccm/api/perspective/clone/{perspectiveId}",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { perspective_id: "perspectiveId" },
          queryParams: { clone_name: "cloneName", destination_folder_id: "destinationFolderId" },
          responseExtractor: ngExtract,
          actionDescription: "Clone a perspective. Requires perspective_id and clone_name. Optionally specify destination_folder_id to place the clone in a specific folder.",
        },
      },
    },

    // ------------------------------------------------------------------
    // 1b. cost_perspective_folder — REST CRUD for perspective folders
    // ------------------------------------------------------------------
    {
      resourceType: "cost_perspective_folder",
      displayName: "Cost Perspective Folder",
      description:
        "Folders for organizing cost perspectives. Use harness_list to see all folders, harness_get to list perspectives in a folder. Use the move_perspectives action to move perspectives between folders.",
      toolset: "ccm",
      scope: "account",
      identifierFields: ["folder_id"],
      listFilterFields: [
        { name: "folder_name_pattern", description: "Filter folders by name pattern (substring match)" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ccm/api/perspectiveFolders",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { folder_name_pattern: "folderNamePattern" },
          responseExtractor: ngExtract,
          description: "List all perspective folders for the account",
        },
        get: {
          method: "GET",
          path: "/ccm/api/perspectiveFolders/{folderId}/perspectives",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { folder_id: "folderId" },
          responseExtractor: ngExtract,
          description: "Get all perspectives in a specific folder",
        },
        create: {
          method: "POST",
          path: "/ccm/api/perspectiveFolders/create",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Folder creation payload",
            fields: [
              { name: "ceViewFolder", type: "object", required: true, description: "Folder definition: { name: string (1-80 chars), description?: string, pinned?: boolean, tags?: string[] }" },
              { name: "perspectiveIds", type: "array", required: false, description: "Perspective IDs to move into this folder on creation" },
              { name: "budgetIds", type: "array", required: false, description: "Budget IDs to associate with this folder" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Create a new perspective folder",
        },
        update: {
          method: "PUT",
          path: "/ccm/api/perspectiveFolders",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Folder update payload (full CEViewFolder object)",
            fields: [
              { name: "uuid", type: "string", required: true, description: "Folder UUID (from list/get)" },
              { name: "name", type: "string", required: true, description: "Folder name (1-80 chars)" },
              { name: "description", type: "string", required: false, description: "Folder description" },
              { name: "pinned", type: "boolean", required: false, description: "Whether folder is pinned" },
              { name: "tags", type: "array", required: false, description: "Folder tags (string array)" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Update a perspective folder",
        },
        delete: {
          method: "DELETE",
          path: "/ccm/api/perspectiveFolders/{folderId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { folder_id: "folderId" },
          responseExtractor: ngExtract,
          description: "Delete a perspective folder",
        },
      },
      executeActions: {
        move_perspectives: {
          method: "POST",
          path: "/ccm/api/perspectiveFolders/movePerspectives",
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Move perspectives between folders",
            fields: [
              { name: "newFolderId", type: "string", required: true, description: "Destination folder ID" },
              { name: "perspectiveIds", type: "array", required: true, description: "Array of perspective IDs to move" },
              { name: "moveAssociatedBudgets", type: "boolean", required: false, description: "Also move budgets associated with the perspectives (default: false)" },
            ],
          },
          responseExtractor: ngExtract,
          actionDescription: "Move perspectives to a different folder. Requires newFolderId and perspectiveIds array. Optionally set moveAssociatedBudgets=true to move associated budgets too.",
        },
      },
    },

    // ------------------------------------------------------------------
    // 2. cost_breakdown — GraphQL perspective grid (drill-down by dimension)
    //    Replaces: ccm_perspective_grid from the official server
    //    Answers: "Where is my money going?"
    // ------------------------------------------------------------------
    {
      resourceType: "cost_breakdown",
      displayName: "Cost Breakdown",
      description: `Drill-down cost breakdown by any dimension within a perspective. Answers "where is my money going?" Returns cost per entity (e.g. per AWS service, per region, per product).

Required: perspective_id (get from cost_perspective list).
Optional: group_by (predefined: ${VALID_GROUP_BY_FIELDS.join(", ")}, OR any label key like "env", "team", "app"), time_filter (${VALID_TIME_FILTERS.join(", ")}), limit, offset.`,
      toolset: "ccm",
      scope: "account",
      identifierFields: ["perspective_id"],
      listFilterFields: [
        { name: "group_by", description: "Group results by field. Use predefined fields (region, product, etc.) OR any label key name (env, team, app, environment, etc.)" },
        { name: "time_filter", description: "Time range filter", enum: [...VALID_TIME_FILTERS] },
        { name: "limit", description: "Result limit", type: "number" },
        { name: "offset", description: "Pagination offset", type: "number" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/ccm/api/graphql",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => ({
            query: PERSPECTIVE_GRID_QUERY,
            operationName: "FetchperspectiveGrid",
            variables: {
              filters: buildFilters(
                input.perspective_id as string,
                (input.time_filter as string) ?? "LAST_30_DAYS",
              ),
              groupBy: buildGroupBy(input.group_by as string | undefined),
              limit: (input.limit as number) ?? 25,
              offset: (input.offset as number) ?? 0,
              aggregateFunction: buildAggregateFunction(),
              isClusterOnly: false,
              isClusterHourlyData: false,
              preferences: buildPreferences(),
            },
          }),
          responseExtractor: ccmBreakdownExtract,
          description:
            "Get cost breakdown by dimension for a perspective. Group by region, awsServicecode, product, cloudProvider, etc.",
        },
      },
    },

    // ------------------------------------------------------------------
    // 3. cost_timeseries — GraphQL perspective time series
    //    Replaces: ccm_perspective_time_series from the official server
    //    Answers: "How has my spend changed over time?"
    // ------------------------------------------------------------------
    {
      resourceType: "cost_timeseries",
      displayName: "Cost Time Series",
      description: `Cost over time for a perspective, grouped by a dimension. Answers "how has my spend changed?" Returns daily/monthly cost data points.

Required: perspective_id, group_by (predefined: ${VALID_GROUP_BY_FIELDS.join(", ")}, OR any label key).
Optional: time_filter (${VALID_TIME_FILTERS.join(", ")}), time_resolution (DAY, MONTH, WEEK), limit.`,
      toolset: "ccm",
      scope: "account",
      identifierFields: ["perspective_id"],
      listFilterFields: [
        { name: "group_by", description: "Group results by field. Use predefined fields (region, product, etc.) OR any label key name (env, team, app, etc.)" },
        { name: "time_filter", description: "Time range filter", enum: [...VALID_TIME_FILTERS] },
        { name: "time_resolution", description: "Time resolution for aggregation", enum: ["DAY", "MONTH", "WEEK"] },
        { name: "limit", description: "Result limit", type: "number" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/ccm/api/graphql",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => {
            const timeResolution = (input.time_resolution as string) ?? "DAY";
            const entityGroupBy = buildGroupBy(input.group_by as string | undefined);
            const timeTruncGroupBy = { timeTruncGroupBy: { resolution: timeResolution } };

            return {
              query: PERSPECTIVE_TIMESERIES_QUERY,
              operationName: "FetchPerspectiveTimeSeries",
              variables: {
                filters: buildFilters(
                  input.perspective_id as string,
                  (input.time_filter as string) ?? "LAST_30_DAYS",
                ),
                groupBy: [timeTruncGroupBy, entityGroupBy[0]],
                limit: (input.limit as number) ?? 12,
                preferences: buildPreferences(),
                isClusterHourlyData: false,
              },
            };
          },
          responseExtractor: ccmTimeseriesExtract,
          description:
            "Get cost time series data for a perspective. Shows cost trends over time grouped by a dimension.",
        },
      },
    },

    // ------------------------------------------------------------------
    // 4. cost_summary — GraphQL perspective trend + forecast + budget
    //    Replaces: ccm_perspective_summary_with_budget, ccm_perspective_budget,
    //              get_ccm_overview, get_ccm_metadata from the official server
    //    Answers: "What's my cost overview for this perspective?"
    // ------------------------------------------------------------------
    {
      resourceType: "cost_summary",
      displayName: "Cost Summary",
      description: `High-level cost summary for a perspective: total cost, trend, idle cost, unallocated cost, efficiency score, forecast, and budget status. Answers "what's my cost overview?"

Required: perspective_id.
Optional: time_filter (${VALID_TIME_FILTERS.join(", ")}).

Use with no perspective_id to get CCM metadata (available connectors, default perspective IDs).`,
      toolset: "ccm",
      scope: "account",
      identifierFields: ["perspective_id"],
      listFilterFields: [
        { name: "time_filter", description: "Time range filter" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/ccm/api/graphql",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => {
            const perspectiveId = input.perspective_id as string | undefined;

            if (!perspectiveId) {
              return {
                query: CCM_METADATA_QUERY,
                operationName: "FetchCcmMetaData",
                variables: {},
              };
            }

            return {
              query: PERSPECTIVE_SUMMARY_QUERY,
              operationName: "FetchPerspectiveDetailsSummaryWithBudget",
              variables: {
                filters: buildFilters(
                  perspectiveId,
                  (input.time_filter as string) ?? "LAST_30_DAYS",
                ),
                groupBy: buildGroupBy(),
                aggregateFunction: buildAggregateFunction(),
                isClusterQuery: false,
                isClusterHourlyData: false,
                preferences: buildPreferences(),
              },
            };
          },
          responseExtractor: ccmSummaryExtract,
          description:
            "Get cost summary with trend, forecast, idle/unallocated costs. Omit perspective_id to get CCM metadata.",
        },
        get: {
          method: "POST",
          path: "/ccm/api/graphql",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => ({
            query: PERSPECTIVE_BUDGET_QUERY,
            operationName: "FetchPerspectiveBudget",
            variables: { perspectiveId: input.perspective_id as string },
          }),
          responseExtractor: gqlExtract("budgetSummaryList"),
          description:
            "Get budget status for a perspective (budget amount, actual cost, time remaining).",
        },
      },
    },

    // ------------------------------------------------------------------
    // 5. cost_recommendation — REST for general recs, GraphQL for
    //    perspective-scoped recs. Two operations: list (REST) and get
    //    (GraphQL by perspective).
    //    Replaces: 5 resource-type-specific tools + list tools from the
    //              official server, all parameterized by resource_type
    //    Answers: "How do I reduce my cloud bill?"
    // ------------------------------------------------------------------
    {
      resourceType: "cost_recommendation",
      displayName: "Cost Recommendation",
      description: `Cloud cost optimization recommendations. Answers "how do I reduce my cloud bill?"

harness_list: General recommendations across the account.
harness_get: Perspective-scoped recommendations — pass perspective_id to get recs for a specific perspective with savings stats. Optionally pass min_saving, time_filter (${VALID_TIME_FILTERS.join(", ")}), limit, offset.

Replaces the 5 separate resource-type tools from the official server (EC2, Azure VM, ECS, Node Pool, Workload) — all resource types are returned in a single list.`,
      toolset: "ccm",
      scope: "account",
      identifierFields: ["perspective_id"],
      listFilterFields: [
        { name: "min_saving", description: "Minimum savings threshold", type: "number" },
        { name: "time_filter", description: "Time range filter", enum: [...VALID_TIME_FILTERS] },
        { name: "limit", description: "Result limit", type: "number" },
        { name: "offset", description: "Pagination offset", type: "number" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/ccm/api/recommendation/overview/list",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => ({
            filterType: "CCMRecommendation",
            minSaving: (input.min_saving as number) ?? 0,
            daysBack: 7,
            offset: (input.offset as number) ?? 0,
            limit: (input.limit as number) ?? 20,
          }),
          responseExtractor: ngExtract,
          description:
            "List all cost optimization recommendations across the account. Returns recommendations for all resource types (EC2, Azure VM, ECS, Node Pool, Workload) in a single response.",
        },
        get: {
          method: "POST",
          path: "/ccm/api/graphql",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => ({
            query: PERSPECTIVE_RECOMMENDATIONS_QUERY,
            operationName: "PerspectiveRecommendations",
            variables: {
              filter: {
                perspectiveFilters: buildFilters(
                  input.perspective_id as string,
                  (input.time_filter as string) ?? "LAST_30_DAYS",
                ),
                limit: (input.limit as number) ?? 25,
                offset: (input.offset as number) ?? 0,
                minSaving: (input.min_saving as number) ?? 0,
              },
            },
          }),
          responseExtractor: ccmRecommendationsExtract,
          description:
            "Get recommendations scoped to a specific perspective, with aggregate savings stats. Filter by min_saving, time_filter.",
        },
      },
      executeActions: {
        update_state: {
          method: "POST",
          path: "/ccm/api/recommendation/overview/change-state",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          queryParams: {
            recommendation_id: "recommendationId",
            state: "state",
          },
          bodyBuilder: () => ({}),
          bodySchema: { description: "No body required. State is set via recommendation_id and state query parameters.", fields: [] },
          responseExtractor: ngExtract,
          actionDescription: "Update a recommendation state. Pass recommendation_id and state (OPEN, APPLIED, IGNORED).",
        },
        override_savings: {
          method: "PUT",
          path: "/ccm/api/recommendation/overview/override-savings",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          queryParams: {
            recommendation_id: "recommendationId",
            overridden_savings: "overriddenSavings",
          },
          bodyBuilder: () => ({}),
          bodySchema: { description: "No body required. Savings override via recommendation_id and overridden_savings query parameters.", fields: [] },
          responseExtractor: ngExtract,
          actionDescription: "Override the estimated savings for a recommendation. Pass recommendation_id and overridden_savings.",
        },
        create_jira_ticket: {
          method: "POST",
          path: "/ccm/api/recommendation/jira/create",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => ({
            recommendationId: input.recommendation_id,
            ...(typeof input.body === "object" && input.body !== null ? input.body as Record<string, unknown> : {}),
          }),
          bodySchema: {
            description: "Jira ticket details for recommendation",
            fields: [
              { name: "recommendation_id", type: "string", required: true, description: "Recommendation ID" },
              { name: "connectorIdentifier", type: "string", required: false, description: "Jira connector identifier" },
              { name: "projectKey", type: "string", required: false, description: "Jira project key" },
              { name: "issueType", type: "string", required: false, description: "Jira issue type" },
              { name: "summary", type: "string", required: false, description: "Ticket summary" },
            ],
          },
          responseExtractor: ngExtract,
          actionDescription: "Create a Jira ticket for a recommendation. Pass recommendation_id and Jira details in body.",
        },
        create_snow_ticket: {
          method: "POST",
          path: "/ccm/api/recommendation/servicenow/create",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => ({
            recommendationId: input.recommendation_id,
            ...(typeof input.body === "object" && input.body !== null ? input.body as Record<string, unknown> : {}),
          }),
          bodySchema: {
            description: "ServiceNow ticket details for recommendation",
            fields: [
              { name: "recommendation_id", type: "string", required: true, description: "Recommendation ID" },
              { name: "connectorIdentifier", type: "string", required: false, description: "ServiceNow connector identifier" },
              { name: "ticketType", type: "string", required: false, description: "ServiceNow ticket type" },
              { name: "description", type: "string", required: false, description: "Ticket description" },
            ],
          },
          responseExtractor: ngExtract,
          actionDescription: "Create a ServiceNow ticket for a recommendation. Pass recommendation_id and ServiceNow details in body.",
        },
      },
    },

    // ------------------------------------------------------------------
    // 6. cost_anomaly — REST v2 (rich filtering with time, ordering, views)
    //    Replaces: list_ccm_anomalies, list_all_ccm_anomalies,
    //              list_ccm_ignored_anomalies, get_ccm_anomalies_for_perspective
    //    All consolidated into one parameterized resource type
    //    Answers: "Are there any unexpected cost spikes?"
    // ------------------------------------------------------------------
    {
      resourceType: "cost_anomaly",
      displayName: "Cost Anomaly",
      description: `Detected cloud cost anomalies — unexpected cost spikes. Answers "are there any unusual charges?"

Filter by: perspective_id, status (ACTIVE, IGNORED, ARCHIVED, RESOLVED), anomaly_view (RESOURCE, PERSPECTIVE), search_text, time_filter or start_time/end_time, order_by, group_by, min_amount, min_anomalous_spend, limit, offset.
All the separate anomaly tools from the official server (list, list_all, list_ignored, by_perspective) are unified here via filter parameters.`,
      toolset: "ccm",
      scope: "account",
      identifierFields: ["anomaly_id"],
      listFilterFields: [
        { name: "perspective_id", description: "Cost perspective identifier" },
        { name: "status", description: "Anomaly status filter", enum: ["ACTIVE", "IGNORED", "ARCHIVED", "RESOLVED"] },
        { name: "anomaly_view", description: "View type for anomaly grouping", enum: ["RESOURCE", "PERSPECTIVE"] },
        { name: "search_text", description: "Search text to filter anomalies by name or resource" },
        { name: "time_filter", description: "Predefined time range filter", enum: [...VALID_TIME_FILTERS] },
        { name: "start_time", description: "Custom start time in epoch milliseconds (overrides time_filter)", type: "number" },
        { name: "end_time", description: "Custom end time in epoch milliseconds (overrides time_filter)", type: "number" },
        { name: "order_by_field", description: "Field to order by", enum: ["ANOMALOUS_SPEND", "TIME", "ACTUAL_SPEND"] },
        { name: "order_by_direction", description: "Order direction", enum: ["ASCENDING", "DESCENDING"] },
        { name: "min_amount", description: "Minimum actual amount threshold", type: "number" },
        { name: "min_anomalous_spend", description: "Minimum anomalous spend threshold", type: "number" },
        { name: "limit", description: "Result limit (default 10)", type: "number" },
        { name: "offset", description: "Pagination offset", type: "number" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/ccm/api/anomaly/v2/list",
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            perspective_id: "perspectiveId",
          },
          bodyBuilder: (input) => {
            const filters: Record<string, unknown> = {
              filterType: "Anomaly",
              limit: (input.limit as number) ?? 10,
              offset: (input.offset as number) ?? 0,
              anomalyView: (input.anomaly_view as string) ?? "RESOURCE",
              groupBy: [],
            };

            // Search text
            if (input.search_text) {
              filters.searchText = Array.isArray(input.search_text)
                ? input.search_text
                : [input.search_text];
            } else {
              filters.searchText = [""];
            }

            // Time filters — prefer explicit start/end, fall back to predefined
            if (input.start_time != null || input.end_time != null) {
              const timeFilters: Record<string, unknown>[] = [];
              if (input.start_time != null) {
                timeFilters.push({ operator: "AFTER", timestamp: input.start_time });
              }
              if (input.end_time != null) {
                timeFilters.push({ operator: "BEFORE", timestamp: input.end_time });
              }
              filters.timeFilters = timeFilters;
            } else {
              const timeRange = (input.time_filter as string) ?? "LAST_30_DAYS";
              const builtFilters = buildTimeFilters(timeRange);
              const timeFilters: Record<string, unknown>[] = [];
              for (const f of builtFilters) {
                const tf = (f as { timeFilter?: { operator?: string; value?: number } }).timeFilter;
                if (tf) {
                  timeFilters.push({ operator: tf.operator, timestamp: tf.value });
                }
              }
              filters.timeFilters = timeFilters;
            }

            // Status
            if (input.status) {
              filters.status = Array.isArray(input.status) ? input.status : [input.status];
            }

            // Min thresholds
            if (input.min_amount != null) {
              filters.minActualAmount = input.min_amount;
            }
            if (input.min_anomalous_spend != null) {
              filters.minAnomalousSpend = input.min_anomalous_spend;
            }

            // Ordering
            const orderByField = (input.order_by_field as string) ?? "ANOMALOUS_SPEND";
            const orderByDirection = (input.order_by_direction as string) ?? "DESCENDING";
            filters.orderBy = [{ field: orderByField, order: orderByDirection }];

            return { anomalyFilterPropertiesDTO: filters };
          },
          responseExtractor: anomalyListExtract,
          description:
            "List cost anomalies using v2 API. Filter by status, perspective_id, anomaly_view (RESOURCE/PERSPECTIVE), search_text, time range, ordering, min thresholds.",
        },
      },
      executeActions: {
        report_feedback: {
          actionDescription:
            "Report feedback on a cost anomaly — mark it as TRUE_ANOMALY, TRUE_EXPECTED_ANOMALY, FALSE_ANOMALY, or NOT_RESPONDED. Pass anomaly_id and feedback.",
          description: "Report feedback on a cost anomaly",
          method: "PUT",
          path: "/ccm/api/anomaly/feedback",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          queryParams: {
            anomaly_id: "anomalyId",
            feedback: "feedback",
          },
          bodyBuilder: () => ({}),
          bodySchema: {
            description: "No body required. Feedback is set via anomaly_id and feedback query parameters.",
            fields: [
              { name: "anomaly_id", type: "string", required: true, description: "Anomaly ID to report feedback on" },
              { name: "feedback", type: "string", required: true, description: "Feedback type: TRUE_ANOMALY, TRUE_EXPECTED_ANOMALY, FALSE_ANOMALY, or NOT_RESPONDED" },
            ],
          },
          responseExtractor: ngExtract,
        },
      },
    },

    // ------------------------------------------------------------------
    // 6b. cost_anomaly_drilldown — drill into a specific anomaly
    //    Three views: details (get), cost time-series, sub-item list
    //    Answers: "Why did this anomaly happen? What does the cost trend look like?"
    // ------------------------------------------------------------------
    {
      resourceType: "cost_anomaly_drilldown",
      displayName: "Cost Anomaly Drilldown",
      description: `Drill-down into a specific cost anomaly. Answers "why did this anomaly happen?" and "what does the cost trend look like?"

harness_get: Returns anomaly details (resource, expected vs actual spend, anomaly attributes).
harness_list: Returns drill-down sub-items for the anomaly.

For cost time-series data, use harness_get with start_time and end_time.`,
      toolset: "ccm",
      scope: "account",
      identifierFields: ["anomaly_id"],
      listFilterFields: [
        { name: "start_time", description: "Start time in epoch milliseconds (for time-series view)", type: "number" },
        { name: "end_time", description: "End time in epoch milliseconds (for time-series view)", type: "number" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/ce/anomaly-detection",
      operations: {
        get: {
          method: "GET",
          path: "/ccm/api/anomaly/v2/drill-down",
          pathBuilder: (input) => {
            if (input.start_time != null && input.end_time != null) {
              return "/ccm/api/anomaly/v2/drill-down/cost/time-series";
            }
            return "/ccm/api/anomaly/v2/drill-down";
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            anomaly_id: "anomalyId",
            start_time: "startTime",
            end_time: "endTime",
          },
          responseExtractor: ngExtract,
          description:
            "Get anomaly drill-down details. Without start_time/end_time: returns anomaly details (resource info, expected vs actual cost). With start_time/end_time (epoch ms): returns cost time-series for the anomaly period.",
        },
        list: {
          method: "GET",
          path: "/ccm/api/anomaly/v2/drill-down/list",
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            anomaly_id: "anomalyId",
          },
          responseExtractor: anomalyListExtract,
          description:
            "List drill-down sub-items for a specific anomaly. Returns breakdown of contributing resources/services.",
        },
      },
    },

    // ------------------------------------------------------------------
    // 6c. cost_anomaly_summary — anomaly summary stats
    // ------------------------------------------------------------------
    {
      resourceType: "cost_anomaly_summary",
      displayName: "Cost Anomaly Summary",
      description:
        "Summary statistics for cloud cost anomalies — total count, total anomalous spend, breakdown by cloud provider.",
      toolset: "ccm",
      scope: "account",
      identifierFields: [],
      deepLinkTemplate: "/ng/account/{accountId}/ce/anomaly-detection",
      operations: {
        get: {
          method: "POST",
          path: "/ccm/api/anomaly/v2/summary",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => {
            const filters: Record<string, unknown> = {
              filterType: "Anomaly",
            };
            if (input.min_amount) filters.minActualAmount = input.min_amount;
            if (input.min_anomalous_spend) filters.minAnomalousSpend = input.min_anomalous_spend;
            return { anomalyFilterPropertiesDTO: filters };
          },
          responseExtractor: ngExtract,
          description: "Get anomaly summary statistics — total count and spend by cloud provider",
        },
      },
    },

    // ------------------------------------------------------------------
    // 7. cost_category — REST for business mappings / cost categories
    // ------------------------------------------------------------------
    {
      resourceType: "cost_category",
      displayName: "Cost Category",
      description:
        "Cost categories (business mappings) for organizing cloud costs into business units. Use harness_list to see all categories, harness_get with category_id for details. Use harness_create to create a new cost category with cost targets and rules.",
      toolset: "ccm",
      scope: "account",
      identifierFields: ["category_id"],
      listFilterFields: [
        { name: "search", description: "Filter cost categories by name" },
        { name: "sort_type", description: "Sort field", enum: ["NAME", "LAST_EDIT"] },
        { name: "sort_order", description: "Sort direction", enum: ["ASC", "DESC"] },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ccm/api/business-mapping",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search: "searchKey",
            sort_type: "sortType",
            sort_order: "sortOrder",
            page: "pageNo",
            size: "pageSize",
          },
          responseExtractor: ngExtract,
          description: "List all cost categories (business mappings)",
        },
        get: {
          method: "GET",
          path: "/ccm/api/business-mapping/{costCategoryId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { category_id: "costCategoryId" },
          responseExtractor: ngExtract,
          description: "Get cost category details by ID",
        },
        create: {
          method: "POST",
          path: "/ccm/api/business-mapping",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          injectAccountInBody: "accountId",
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Cost category (business mapping) definition. costTargets are cost buckets — each bucket has a name and rules that determine which costs fall into it. Rules use the same ViewIdCondition structure as perspectives.",
            fields: [
              { name: "name", type: "string", required: true, description: "Cost category name" },
              {
                name: "costTargets", type: "array", required: true,
                description: "Cost buckets. Each has a name and rules array. Multiple rules are OR-ed; conditions within a rule are AND-ed.",
                itemType: "{ name: string, rules: [{ viewConditions: [ViewIdCondition] }] }",
              },
              {
                name: "sharedCosts", type: "array", required: false,
                description: "Shared cost buckets with allocation strategy. Each has a name, rules, strategy (PROPORTIONAL or FIXED), and optional splits for FIXED strategy.",
                itemType: "{ name: string, rules: [...], strategy: 'PROPORTIONAL' | 'FIXED', splits?: [{ costTargetName: string, percentageContribution: number }] }",
              },
              {
                name: "unallocatedCost", type: "object", required: false,
                description: "How to handle costs not matching any bucket",
                fields: [
                  { name: "strategy", type: "string", required: true, description: "DISPLAY_NAME (show with label), SHARE (distribute), or HIDE" },
                  { name: "label", type: "string", required: false, description: "Display label when strategy is DISPLAY_NAME (e.g. 'Unattributed')" },
                ],
              },
            ],
          },
          responseExtractor: ngExtract,
          description: "Create a new cost category (business mapping). The accountId is injected automatically.",
        },
        update: {
          method: "PUT",
          path: "/ccm/api/business-mapping",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          injectAccountInBody: "accountId",
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Cost category update (full replacement). Fetch the existing category via harness_get first, modify the fields, and send the full object back.",
            fields: [
              { name: "uuid", type: "string", required: true, description: "Cost category UUID (from harness_get)" },
              { name: "name", type: "string", required: true, description: "Cost category name" },
              {
                name: "costTargets", type: "array", required: true,
                description: "Cost buckets. Each has a name and rules array. Multiple rules are OR-ed; conditions within a rule are AND-ed.",
                itemType: "{ name: string, rules: [{ viewConditions: [ViewIdCondition] }] }",
              },
              {
                name: "sharedCosts", type: "array", required: false,
                description: "Shared cost buckets with allocation strategy",
                itemType: "{ name: string, rules: [...], strategy: 'PROPORTIONAL' | 'FIXED', splits?: [{ costTargetName: string, percentageContribution: number }] }",
              },
              {
                name: "unallocatedCost", type: "object", required: false,
                description: "How to handle costs not matching any bucket",
                fields: [
                  { name: "strategy", type: "string", required: true, description: "DISPLAY_NAME, SHARE, or HIDE" },
                  { name: "label", type: "string", required: false, description: "Display label when strategy is DISPLAY_NAME" },
                ],
              },
            ],
          },
          responseExtractor: ngExtract,
          description: "Update an existing cost category (full replacement)",
        },
        delete: {
          method: "DELETE",
          path: "/ccm/api/business-mapping/{costCategoryId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { category_id: "costCategoryId" },
          responseExtractor: ngExtract,
          description: "Delete a cost category",
        },
      },
    },

    // ------------------------------------------------------------------
    // 8. cost_account_overview — REST overview endpoint (account-level)
    // ------------------------------------------------------------------
    {
      resourceType: "cost_account_overview",
      displayName: "Cost Account Overview",
      description: "Account-level cost overview with start/end time and groupBy. Supports get. Use cost_summary for perspective-scoped data.",
      toolset: "ccm",
      scope: "account",
      identifierFields: [],
      deepLinkTemplate: "/ng/account/{accountId}/ce/overview",
      operations: {
        get: {
          method: "GET",
          path: "/ccm/api/overview",
          pathBuilder: (input) => {
            const toMillis = (v: unknown, fallbackDaysAgo: number): string => {
              if (v && typeof v === "string") {
                const ms = new Date(v).getTime();
                if (!isNaN(ms)) return String(ms);
              }
              return String(Date.now() - fallbackDaysAgo * 86_400_000);
            };
            input.start_time = toMillis(input.start_time, 60);
            input.end_time = toMillis(input.end_time, 0);
            if (!input.group_by) input.group_by = "DAY";
            return "/ccm/api/overview";
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            start_time: "startTime",
            end_time: "endTime",
            group_by: "groupBy",
          },
          responseExtractor: ngExtract,
          description: "Get cost overview with optional time range and grouping",
          paramsSchema: {
            fields: [
              { name: "start_time", required: false, description: "Start time filter (ISO 8601)" },
              { name: "end_time", required: false, description: "End time filter (ISO 8601)" },
              { name: "group_by", required: false, description: "Group results by field" },
            ],
          } satisfies ParamsSchema,
        },
      },
    },

    // ------------------------------------------------------------------
    // 9. cost_filter_value — GraphQL perspective filter values (multi-purpose)
    //    Used for: label keys, label values, field values (region, account, etc.)
    // ------------------------------------------------------------------
    {
      resourceType: "cost_filter_value",
      displayName: "Cost Filter Value",
      description: "Multi-purpose endpoint for fetching perspective filter values. Use value_type to specify what to fetch: 'label_v2_key' for label keys, 'label_v2' for label values, 'region' for regions, etc.",
      toolset: "ccm",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        { name: "perspective_id", description: "Cost perspective identifier (optional for some value types)" },
        { name: "value_type", description: "Type of values to fetch: 'label_v2_key' (label keys), 'label_v2' (label values), 'business_mapping' (cost category names or bucket names), 'region', 'product', 'awsUsageaccountid', 'cloudProvider', etc.", required: true },
        { name: "value_sub_type", description: "Sub-type qualifier. For label_v2: the label key name (e.g. 'env'). For business_mapping: the cost category UUID to get bucket names (omit to list all categories)." },
        { name: "time_filter", description: "Time filter for the query", enum: [...VALID_TIME_FILTERS] },
        { name: "offset", description: "Pagination offset", type: "number" },
        { name: "limit", description: "Result limit (default 1000)", type: "number" },
        { name: "is_cluster_query", description: "Whether this is a cluster query", type: "boolean" },
        { name: "is_cluster_hourly_data", description: "Whether to use cluster hourly data", type: "boolean" },
      ],
      operations: {
        list: {
          method: "POST",
          methodBuilder: (input) =>
            (input.value_type as string) === "business_mapping" ? "GET" : "POST",
          path: "/ccm/api/graphql",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathBuilder: (input) => {
            if ((input.value_type as string) === "business_mapping") {
              const sub = input.value_sub_type as string | undefined;
              if (sub) {
                return `/ccm/api/business-mapping/${encodeURIComponent(sub)}`;
              }
              return "/ccm/api/business-mapping";
            }
            return "/ccm/api/graphql";
          },
          bodyBuilder: (input) => {
            const valueType = input.value_type as string;

            // business_mapping routes through REST — no body needed
            if (valueType === "business_mapping") return undefined;

            const valueSubType = input.value_sub_type as string | undefined;
            const timeFilter = (input.time_filter as string) || "LAST_30_DAYS";

            // Build filters array: perspective + time + field
            const filters: Record<string, unknown>[] = [];

            // Add perspective filter (optional for some value types)
            if (input.perspective_id) {
              filters.push(...buildViewFilter(input.perspective_id as string));
            }

            // Add time filter
            filters.push(...buildTimeFilters(timeFilter));

            // Add field filter based on value_type
            if (valueType === "label_v2_key" || valueType === "label_key") {
              // Fetching label KEYS - use KeyFieldFilter
              const fieldOut = {
                fieldId: "labels.key",
                fieldName: "labels.key",
                identifier: "LABEL",
                identifierName: "Label",
              };
              filters.push({
                idFilter: {
                  values: [""],
                  operator: "NOT_NULL",
                  field: fieldOut,
                },
              });
            } else if (valueType === "label_v2" || valueType === "label") {
              // Fetching label VALUES for a specific key - use KeyValueFieldFilter
              if (!valueSubType) {
                throw new Error("value_sub_type is required when value_type is 'label_v2' or 'label'");
              }
              const fieldOut = {
                fieldId: "labels.value",
                fieldName: valueSubType, // The specific label key name
                identifier: "LABEL",
                identifierName: "Label",
              };
              filters.push({
                idFilter: {
                  values: [""],
                  operator: "IN",
                  field: fieldOut,
                },
              });
            } else {
              // Standard field (region, product, awsUsageaccountid, etc.)
              const fieldOut = OUTPUT_FIELDS[valueType] || {
                fieldId: valueType,
                fieldName: valueType,
                identifier: "COMMON",
                identifierName: "Common",
              };
              filters.push({
                idFilter: {
                  values: [""],
                  operator: "IN",
                  field: fieldOut,
                },
              });
            }

            return {
              query: `query FetchPerspectiveFiltersValue(
  $filters: [QLCEViewFilterWrapperInput],
  $offset: Int,
  $limit: Int,
  $sortCriteria: [QLCEViewSortCriteriaInput],
  $isClusterQuery: Boolean = null,
  $isClusterHourlyData: Boolean = null
) {
  perspectiveFilters(
    filters: $filters
    offset: $offset
    limit: $limit
    sortCriteria: $sortCriteria
    isClusterQuery: $isClusterQuery
    isClusterHourlyData: $isClusterHourlyData
  ) {
    values
    __typename
  }
}`,
              operationName: "FetchPerspectiveFiltersValue",
              variables: {
                filters,
                offset: (input.offset as number) ?? 0,
                limit: (input.limit as number) ?? 1000,
                sortCriteria: [{ sortOrder: "ASCENDING", sortType: "NAME" }],
                isClusterQuery: input.is_cluster_query ?? null,
                isClusterHourlyData: input.is_cluster_hourly_data ?? null,
              },
            };
          },
          responseExtractor: (raw: unknown, input?: Record<string, unknown>): unknown => {
            const valueType = input?.value_type as string | undefined;
            if (valueType === "business_mapping") {
              return extractBusinessMappingValues(raw, input?.value_sub_type as string | undefined);
            }
            return gqlExtract("perspectiveFilters")(raw);
          },
          description: "Fetch perspective filter values. Examples: value_type='label_v2_key' returns all label keys; value_type='label_v2' with value_sub_type='env' returns all values for 'env' label; value_type='region' returns all regions; value_type='business_mapping' returns cost category names; value_type='business_mapping' with value_sub_type='<category_id>' returns bucket names.",
        },
      },
    },

    // ------------------------------------------------------------------
    // 11. cost_recommendation_stats — REST overview stats + by-type
    //    Merged: aggregate stats and stats grouped by resource type
    // ------------------------------------------------------------------
    {
      resourceType: "cost_recommendation_stats",
      displayName: "Cost Recommendation Stats",
      description: "Cost recommendation statistics. harness_get: aggregate stats. harness_get with group_by=type: stats grouped by resource type (resize, terminate, etc.).",
      toolset: "ccm",
      scope: "account",
      identifierFields: [],
      deepLinkTemplate: "/ng/account/{accountId}/ce/recommendations",
      operations: {
        get: {
          method: "POST",
          path: "/ccm/api/recommendation/overview/stats",
          pathBuilder: (input, _config) =>
            input.group_by === "type"
              ? "/ccm/api/recommendation/overview/resource-type/stats"
              : "/ccm/api/recommendation/overview/stats",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: () => ({
            filterType: "CCMRecommendation",
            minSaving: 0,
            daysBack: 7,
          }),
          responseExtractor: ngExtract,
          description:
            "Get aggregate stats, or stats by resource type when group_by=type",
          paramsSchema: {
            fields: [
              { name: "group_by", required: false, description: "Group by resource type (type)" },
            ],
          } satisfies ParamsSchema,
        },
      },
    },

    // ------------------------------------------------------------------
    // 12. cost_recommendation_detail — REST detail by resource type path
    // ------------------------------------------------------------------
    {
      resourceType: "cost_recommendation_detail",
      displayName: "Cost Recommendation Detail",
      description: "Detailed cost recommendation for a specific resource. Supports get. Pass type_path (ec2-instance, azure-vm, ecs-service, node-pool, workload) and recommendation_id.",
      toolset: "ccm",
      scope: "account",
      identifierFields: ["type_path", "recommendation_id"],
      deepLinkTemplate: "/ng/account/{accountId}/ce/recommendations",
      operations: {
        get: {
          method: "GET",
          path: "/ccm/api/recommendation/details/{typePath}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { type_path: "typePath" },
          queryParams: { recommendation_id: "id" },
          responseExtractor: ngExtract,
          description: "Get detailed recommendation. Requires type_path (ec2-instance, azure-vm, ecs-service, node-pool, workload) and recommendation_id.",
        },
      },
    },

    // ------------------------------------------------------------------
    // 13. cost_commitment — consolidated Lightwing commitment data
    //    Replaces: cost_commitment_coverage, cost_commitment_savings,
    //              cost_commitment_utilisation, cost_commitment_analysis,
    //              cost_estimated_savings
    // ------------------------------------------------------------------
    {
      resourceType: "cost_commitment",
      displayName: "Cost Commitment",
      description: `Commitment (RI/savings plan) data. harness_get with aspect: coverage | savings | utilisation | analysis | estimated_savings. For estimated_savings, pass cloud_account_id.`,
      toolset: "ccm",
      scope: "account",
      identifierFields: ["aspect", "cloud_account_id"],
      deepLinkTemplate: "/ng/account/{accountId}/ce/commitment-orchestration",
      operations: {
        get: {
          method: "POST",
          path: "/lw/co/api/accounts/{accountId}/v1/detail/compute_coverage",
          pathBuilder: (input, config) => {
            const accountId = (input.account_id as string) ?? config.HARNESS_ACCOUNT_ID ?? "";
            input.account_id = accountId;
            const aspect = (input.aspect as string) || "coverage";
            const base = `/lw/co/api/accounts/${accountId}`;
            switch (aspect) {
              case "coverage": return `${base}/v1/detail/compute_coverage`;
              case "savings": return `${base}/v1/detail/savings`;
              case "utilisation": return `${base}/v1/detail/commitment_utilisation`;
              case "analysis": return `${base}/v2/spend/detail`;
              case "estimated_savings": {
                const cloudAccountId = input.cloud_account_id as string;
                if (!cloudAccountId) {
                  throw new Error("cloud_account_id is required for aspect=estimated_savings");
                }
                return `${base}/v2/setup/${cloudAccountId}/estimated_savings`;
              }
              default: return `${base}/v1/detail/compute_coverage`;
            }
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            start_date: "start_date",
            end_date: "end_date",
          },
          bodyBuilder: (input) => {
            const body = (input.body as Record<string, unknown>) ?? {};
            if (!body.Service) body.Service = "Amazon Elastic Compute Cloud - Compute";
            return body;
          },
          responseExtractor: passthrough,
          description:
            "Get commitment data. Pass aspect: coverage, savings, utilisation, analysis, or estimated_savings. Requires start_date and end_date (YYYY-MM-DD). For estimated_savings, cloud_account_id is required.",
          paramsSchema: {
            fields: [
              { name: "aspect", required: false, description: "Which commitment aspect to fetch (coverage | savings | utilisation | analysis | estimated_savings)" },
              { name: "cloud_account_id", required: false, description: "Required for aspect=estimated_savings" },
              { name: "start_date", required: true, description: "Start date for commitment data (YYYY-MM-DD)" },
              { name: "end_date", required: true, description: "End date for commitment data (YYYY-MM-DD)" },
            ],
          } satisfies ParamsSchema,
        },
      },
    },

    // ------------------------------------------------------------------
    // 14. unit_metric — Unit Cost Metrics API
    //    Full CRUD for unit metrics with time series data
    //    Base path: /ccm/api/unit-metric
    //    Requires: CCM_UNIT_COST_METRICS feature flag
    // ------------------------------------------------------------------
    {
      resourceType: "unit_metric",
      displayName: "Unit Metric",
      description: `Unit cost metrics for tracking custom cost efficiency metrics (e.g., cost per build minute, cost per deployment, cost per API call).

Use harness_list to see all unit metrics (paginated metadata only, no records).
Use harness_get with metric_identifier, start_time, and end_time to retrieve metric details with time series data.
Use harness_create/harness_update to manage metrics with unitMetricRecords.
Use harness_delete to remove records in a time range.

Requires CCM_UNIT_COST_METRICS feature flag.`,
      toolset: "ccm",
      scope: "account",
      identifierFields: ["metric_identifier"],
      listFilterFields: [
        { name: "search_key", description: "Filter metrics by name (case-insensitive)" },
        { name: "page", description: "Page number (0-indexed)", type: "number" },
        { name: "size", description: "Page size (default 20, max 100)", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ccm/api/unit-metric/list",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_key: "searchKey",
            page: "pageNo",
            size: "pageSize",
          },
          responseExtractor: ngExtract,
          description: "List all unit metrics (paginated metadata without records). Filter by name with search_key. Default pageSize=20, max 100.",
        },
        get: {
          method: "GET",
          path: "/ccm/api/unit-metric",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            metric_identifier: "identifier",
            start_time: "startTime",
            end_time: "endTime",
          },
          responseExtractor: ngExtract,
          description: "Get unit metric with time series records for a time range. Requires metric_identifier, start_time (ISO 8601), and end_time (ISO 8601). Returns UnitMetricResponseDTO with unitMetricRecords. NOTE: API uses 'identifier' parameter name.",
        },
        create: {
          method: "POST",
          path: "/ccm/api/unit-metric",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Unit metric definition with time series data",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Unique metric identifier (entity identifier rules: lowercase, hyphens/underscores)" },
              { name: "name", type: "string", required: true, description: "Display name for the metric" },
              { name: "labels", type: "object", required: false, description: "Optional labels (map<string,string>, max 128 entries, each key/value ≤256 chars)" },
              { name: "description", type: "string", required: false, description: "Optional metric description" },
              { name: "defaultAggregation", type: "string", required: false, description: "Default aggregation: AVG, MIN, or MAX (defaults to AVG if omitted)" },
              { name: "unitMetricRecords", type: "array", required: true, description: "Non-empty array of records, each with: value (number) and usageTimeStamp (ISO 8601 string)", itemType: "UnitCostMetricRecord" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Create a new unit metric. Body must include metricIdentifier, metricName, and unitMetricRecords array. Returns UnitMetricResponseDTO with createdAt and lastUpdatedAt timestamps.",
        },
        update: {
          method: "PUT",
          path: "/ccm/api/unit-metric",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Unit metric update (same shape as create)",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Metric identifier to update" },
              { name: "name", type: "string", required: true, description: "Display name" },
              { name: "labels", type: "object", required: false, description: "Labels update: omit/null to leave unchanged, empty object {} to clear all labels" },
              { name: "description", type: "string", required: false, description: "Optional description" },
              { name: "defaultAggregation", type: "string", required: false, description: "Default aggregation: AVG, MIN, or MAX" },
              { name: "unitMetricRecords", type: "array", required: true, description: "New records to add (non-empty array)", itemType: "UnitCostMetricRecord" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Update an existing unit metric. Pass labels={} to clear all labels. New unitMetricRecords are added to the time series. Returns updated UnitMetricResponseDTO.",
        },
        delete: {
          method: "DELETE",
          path: "/ccm/api/unit-metric",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          queryParams: {
            metric_identifier: "identifier",
            start_time: "startTime",
            end_time: "endTime",
          },
          responseExtractor: ngExtract,
          description: "Delete unit metric records in a time range. NOTE: API parameter name is 'identifier' (not 'metricIdentifier'). Requires identifier, start_time (ISO 8601), and end_time (ISO 8601). Returns boolean success status.",
        },
      },
    },
  ],
};
