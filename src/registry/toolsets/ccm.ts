import type { ToolsetDefinition } from "../types.js";
import type { PathBuilderConfig } from "../types.js";
import { ngExtract, passthrough, gqlExtract, ccmViewsExtract, ccmBreakdownExtract, ccmTimeseriesExtract, ccmSummaryExtract, ccmRecommendationsExtract } from "../extractors.js";

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
    case "LAST_MONTH": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
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
        { name: "sort_type", description: "Sort field", enum: ["NAME", "LAST_EDIT", "COST", "CLUSTER_COST"] },
        { name: "sort_order", description: "Sort direction", enum: ["ASCENDING", "DESCENDING"] },
        { name: "cloud_filter", description: "Filter by cloud provider", enum: ["AWS", "GCP", "AZURE", "CLUSTER", "DEFAULT"] },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ccm/api/perspective/getAllPerspectives",
          queryParams: {
            search_term: "searchKey",
            sort_type: "sortType",
            sort_order: "sortOrder",
            cloud_filter: "cloudFilters",
            page: "pageNo",
            size: "pageSize",
          },
          responseExtractor: ccmViewsExtract,
          description: "List all cost perspectives for the account",
        },
        get: {
          method: "GET",
          path: "/ccm/api/perspective",
          queryParams: { perspective_id: "perspectiveId" },
          responseExtractor: ngExtract,
          description: "Get cost perspective details by ID",
        },
        create: {
          method: "POST",
          path: "/ccm/api/perspective",
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Cost perspective definition",
            fields: [
              { name: "name", type: "string", required: true, description: "Perspective name" },
              { name: "viewVisualization", type: "object", required: false, description: "Chart type and group by configuration" },
              { name: "viewRules", type: "array", required: false, description: "Filter rules for the perspective", itemType: "rule object" },
              { name: "viewTimeRange", type: "object", required: false, description: "Time range settings" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Create a new cost perspective",
        },
        update: {
          method: "PUT",
          path: "/ccm/api/perspective",
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Cost perspective update",
            fields: [
              { name: "uuid", type: "string", required: true, description: "Perspective UUID (from get)" },
              { name: "name", type: "string", required: true, description: "Perspective name" },
              { name: "viewVisualization", type: "object", required: false, description: "Chart type and group by configuration" },
              { name: "viewRules", type: "array", required: false, description: "Filter rules", itemType: "rule object" },
              { name: "viewTimeRange", type: "object", required: false, description: "Time range settings" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Update an existing cost perspective",
        },
        delete: {
          method: "DELETE",
          path: "/ccm/api/perspective/{perspectiveId}",
          pathParams: { perspective_id: "perspectiveId" },
          responseExtractor: ngExtract,
          description: "Delete a cost perspective",
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
    // 6. cost_anomaly — REST only (rich filtering)
    //    Replaces: list_ccm_anomalies, list_all_ccm_anomalies,
    //              list_ccm_ignored_anomalies, get_ccm_anomalies_for_perspective
    //    All consolidated into one parameterized resource type
    //    Answers: "Are there any unexpected cost spikes?"
    // ------------------------------------------------------------------
    {
      resourceType: "cost_anomaly",
      displayName: "Cost Anomaly",
      description: `Detected cloud cost anomalies — unexpected cost spikes. Answers "are there any unusual charges?"

Filter by: perspective_id, status (ACTIVE, IGNORED, ARCHIVED, RESOLVED), min_amount, min_anomalous_spend, limit, offset.
All the separate anomaly tools from the official server (list, list_all, list_ignored, by_perspective) are unified here via filter parameters.`,
      toolset: "ccm",
      scope: "account",
      identifierFields: ["anomaly_id"],
      listFilterFields: [
        { name: "perspective_id", description: "Cost perspective identifier" },
        { name: "status", description: "Anomaly status filter", enum: ["ACTIVE", "IGNORED", "ARCHIVED", "RESOLVED"] },
        { name: "min_amount", description: "Minimum amount threshold", type: "number" },
        { name: "min_anomalous_spend", description: "Minimum anomalous spend threshold", type: "number" },
        { name: "limit", description: "Result limit", type: "number" },
        { name: "offset", description: "Pagination offset", type: "number" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/ccm/api/anomaly",
          queryParams: {
            perspective_id: "perspectiveId",
          },
          bodyBuilder: (input) => {
            const filters: Record<string, unknown> = {
              filterType: "Anomaly",
              limit: (input.limit as number) ?? 25,
              offset: (input.offset as number) ?? 0,
            };

            if (input.status) {
              filters.status = Array.isArray(input.status) ? input.status : [input.status];
            }
            if (input.min_amount) {
              filters.minActualAmount = input.min_amount;
            }
            if (input.min_anomalous_spend) {
              filters.minAnomalousSpend = input.min_anomalous_spend;
            }

            return { anomalyFilterPropertiesDTO: filters };
          },
          responseExtractor: ngExtract,
          description:
            "List cost anomalies. Filter by status (ACTIVE/IGNORED/ARCHIVED/RESOLVED), perspective_id, min_amount, min_anomalous_spend.",
        },
      },
      executeActions: {
        report_feedback: {
          actionDescription:
            "Report feedback on a cost anomaly — mark it as TRUE_ANOMALY, TRUE_EXPECTED_ANOMALY, FALSE_ANOMALY, or NOT_RESPONDED. Pass anomaly_id and feedback.",
          description: "Report feedback on a cost anomaly",
          method: "PUT",
          path: "/ccm/api/anomaly/feedback",
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
    // 6b. cost_anomaly_summary — anomaly summary stats
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
        "Cost categories (business mappings) for organizing cloud costs into business units. Use harness_list to see all categories, harness_get with category_id for details.",
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
          pathParams: { category_id: "costCategoryId" },
          responseExtractor: ngExtract,
          description: "Get cost category details by ID",
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
      listFilterFields: [
        { name: "start_time", description: "Start time filter (ISO 8601)" },
        { name: "end_time", description: "End time filter (ISO 8601)" },
        { name: "group_by", description: "Group results by field" },
      ],
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
          queryParams: {
            start_time: "startTime",
            end_time: "endTime",
            group_by: "groupBy",
          },
          responseExtractor: ngExtract,
          description: "Get cost overview with optional time range and grouping",
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
        { name: "value_type", description: "Type of values to fetch: 'label_v2_key' (label keys), 'label_v2' (label values), 'region', 'product', 'awsUsageaccountid', 'cloudProvider', etc.", required: true },
        { name: "value_sub_type", description: "Sub-type for label_v2: the specific label key name to get values for (e.g. 'env', 'team')" },
        { name: "time_filter", description: "Time filter for the query", enum: [...VALID_TIME_FILTERS] },
        { name: "offset", description: "Pagination offset", type: "number" },
        { name: "limit", description: "Result limit (default 1000)", type: "number" },
        { name: "is_cluster_query", description: "Whether this is a cluster query", type: "boolean" },
        { name: "is_cluster_hourly_data", description: "Whether to use cluster hourly data", type: "boolean" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/ccm/api/graphql",
          bodyBuilder: (input) => {
            const valueType = input.value_type as string;
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
            } else if (valueType === "business_mapping") {
              // Cost category / business mapping
              const fieldOut = {
                fieldId: "businessMapping.costCategoryName",
                fieldName: valueSubType || "Cost Category",
                identifier: "BUSINESS_MAPPING",
                identifierName: "Business Mapping",
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
          responseExtractor: gqlExtract("perspectiveFilters"),
          description: "Fetch perspective filter values. Examples: value_type='label_v2_key' returns all label keys; value_type='label_v2' with value_sub_type='env' returns all values for 'env' label; value_type='region' returns all regions.",
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
      listFilterFields: [
        { name: "group_by", description: "Group by resource type", enum: ["type"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/ce/recommendations",
      operations: {
        get: {
          method: "POST",
          path: "/ccm/api/recommendation/overview/stats",
          pathBuilder: (input, _config) =>
            input.group_by === "type"
              ? "/ccm/api/recommendation/overview/resource-type/stats"
              : "/ccm/api/recommendation/overview/stats",
          bodyBuilder: () => ({
            filterType: "CCMRecommendation",
            minSaving: 0,
            daysBack: 7,
          }),
          responseExtractor: ngExtract,
          description:
            "Get aggregate stats, or stats by resource type when group_by=type",
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
      listFilterFields: [
        { name: "aspect", description: "Which commitment aspect to fetch", enum: ["coverage", "savings", "utilisation", "analysis", "estimated_savings"] },
        { name: "cloud_account_id", description: "Required for aspect=estimated_savings", type: "string" },
        { name: "start_date", description: "Start date for commitment data (YYYY-MM-DD)", required: true },
        { name: "end_date", description: "End date for commitment data (YYYY-MM-DD)", required: true },
      ],
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
