import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

/** SEI base path */
const SEI = "/gateway/sei/api";

/** Build standard DORA metric request body */
function doraBuildBody(input: Record<string, unknown>) {
  return {
    teamRefId: input.team_ref_id,
    dateStart: input.date_start,
    dateEnd: input.date_end,
    granularity: input.granularity ?? "MONTH",
  };
}

/** Build AI coding assistant insight request body with integration type, granularity, and metric type */
function aiInsightBuildBody(input: Record<string, unknown>) {
  const integrationType = input.integration_type ?? "all_assistants";
  return {
    teamRefId: input.team_ref_id,
    dateStart: input.date_start,
    dateEnd: input.date_end,
    integrationType:
      integrationType === "all_assistants"
        ? ["cursor", "windsurf"]
        : [integrationType],
    ...(input.granularity ? { granularity: input.granularity } : {}),
    ...(input.metric_type ? { metricType: input.metric_type } : {}),
  };
}

/** Common filter fields for AI coding assistant tools */
const AI_FILTER_FIELDS = [
  { name: "team_ref_id", description: "Team reference identifier (use sei_team list to find)" },
  { name: "date_start", description: "Start date (YYYY-MM-DD)" },
  { name: "date_end", description: "End date (YYYY-MM-DD)" },
  {
    name: "integration_type",
    description: "AI coding assistant type",
    enum: ["cursor", "windsurf", "all_assistants"],
  },
];

/** DORA filter fields shared across all DORA metric resources */
const DORA_FILTER_FIELDS = [
  { name: "team_ref_id", description: "Team reference identifier" },
  { name: "date_start", description: "Start date for metric calculation" },
  { name: "date_end", description: "End date for metric calculation" },
  { name: "granularity", description: "Time granularity", enum: ["DAY", "WEEK", "MONTH"] },
];

export const seiToolset: ToolsetDefinition = {
  name: "sei",
  displayName: "Software Engineering Insights",
  description:
    "Harness SEI — engineering metrics, DORA metrics, teams, org trees, business alignment, and AI coding insights",
  resources: [
    // ------- Generic Metrics -------
    {
      resourceType: "sei_metric",
      displayName: "SEI Metric",
      description: "Software engineering insight metric. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      operations: {
        list: {
          method: "GET",
          path: "/sei/api/v1/metrics",
          queryParams: { page: "page", size: "size" },
          responseExtractor: passthrough,
          description: "List SEI metrics",
        },
      },
    },

    // ------- Productivity Feature Metrics -------
    {
      resourceType: "sei_productivity_metric",
      displayName: "SEI Productivity Metric",
      description:
        "Productivity feature metrics (e.g. PR velocity). Supports get. Pass team_ref_id or developer IDs, date_start, date_end, feature_type.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date (YYYY-MM-DD)" },
        { name: "date_end", description: "End date (YYYY-MM-DD)" },
        { name: "feature_type", description: "Productivity feature type", enum: ["PR_VELOCITY"] },
        { name: "granularity", description: "Time granularity", enum: ["WEEKLY", "MONTHLY"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/productivity",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/productivityv3/feature_metrics`,
          bodyBuilder: (input) => ({
            teamRefId: input.team_ref_id,
            dateStart: input.date_start,
            dateEnd: input.date_end,
            featureType: input.feature_type ?? "PR_VELOCITY",
            granularity: input.granularity ?? "WEEKLY",
            ...(input.developer_ids ? { developerIds: input.developer_ids } : {}),
            ...(input.team_ids ? { teamIds: input.team_ids } : {}),
            ...(input.stack_by ? { stackBy: input.stack_by } : {}),
            ...(input.page !== undefined ? { page: input.page } : {}),
            ...(input.page_size !== undefined ? { pageSize: input.page_size } : {}),
          }),
          responseExtractor: passthrough,
          description: "Get productivity feature metrics (e.g. PR velocity) for a team",
        },
      },
    },

    // ------- DORA Metrics -------
    {
      resourceType: "sei_deployment_frequency",
      displayName: "SEI Deployment Frequency",
      description: "DORA deployment frequency metric. Supports get. Pass team_ref_id, date_start, date_end, granularity.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [...DORA_FILTER_FIELDS],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/dora",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/efficiency/deploymentFrequency`,
          bodyBuilder: doraBuildBody,
          responseExtractor: passthrough,
          description: "Get deployment frequency metrics for a team over a date range",
        },
      },
    },
    {
      resourceType: "sei_deployment_frequency_drilldown",
      displayName: "SEI Deployment Frequency Drilldown",
      description: "DORA deployment frequency drilldown data. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [...DORA_FILTER_FIELDS],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/dora",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/efficiency/deploymentFrequency/drilldown`,
          bodyBuilder: doraBuildBody,
          responseExtractor: passthrough,
          description: "Get deployment frequency drilldown data",
        },
      },
    },
    {
      resourceType: "sei_change_failure_rate",
      displayName: "SEI Change Failure Rate",
      description: "DORA change failure rate metric. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [...DORA_FILTER_FIELDS],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/dora",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/efficiency/changeFailureRate`,
          bodyBuilder: doraBuildBody,
          responseExtractor: passthrough,
          description: "Get change failure rate metrics for a team",
        },
      },
    },
    {
      resourceType: "sei_change_failure_rate_drilldown",
      displayName: "SEI Change Failure Rate Drilldown",
      description: "DORA change failure rate drilldown data. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [...DORA_FILTER_FIELDS],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/dora",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/efficiency/changeFailureRate/drilldown`,
          bodyBuilder: doraBuildBody,
          responseExtractor: passthrough,
          description: "Get change failure rate drilldown data",
        },
      },
    },
    {
      resourceType: "sei_mttr",
      displayName: "SEI MTTR",
      description: "DORA mean time to restore metric. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [...DORA_FILTER_FIELDS],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/dora",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/efficiency/mttr`,
          bodyBuilder: doraBuildBody,
          responseExtractor: passthrough,
          description: "Get mean time to restore metrics for a team",
        },
      },
    },
    {
      resourceType: "sei_lead_time",
      displayName: "SEI Lead Time",
      description: "DORA lead time for changes metric. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [...DORA_FILTER_FIELDS],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/dora",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/efficiency/leadtime`,
          bodyBuilder: doraBuildBody,
          responseExtractor: passthrough,
          description: "Get lead time for changes metrics for a team",
        },
      },
    },

    // ------- Teams -------
    {
      resourceType: "sei_team",
      displayName: "SEI Team",
      description: "SEI team entity. Supports list and get.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["team_ref_id"],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/configuration/teams",
      operations: {
        list: {
          method: "GET",
          path: `${SEI}/v2/teams/list`,
          responseExtractor: passthrough,
          description: "List SEI teams",
        },
        get: {
          method: "GET",
          path: `${SEI}/v2/teams/{teamRefId}/team_info`,
          pathParams: { team_ref_id: "teamRefId" },
          responseExtractor: passthrough,
          description: "Get SEI team info",
        },
      },
    },
    {
      resourceType: "sei_team_integration",
      displayName: "SEI Team Integration",
      description: "Integrations associated with an SEI team. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["team_ref_id"],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/configuration/teams",
      operations: {
        list: {
          method: "GET",
          path: `${SEI}/v2/teams/{teamRefId}/integrations`,
          pathParams: { team_ref_id: "teamRefId" },
          responseExtractor: passthrough,
          description: "List integrations for an SEI team",
        },
      },
    },
    {
      resourceType: "sei_team_developer",
      displayName: "SEI Team Developer",
      description: "Developers in an SEI team. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["team_ref_id"],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/configuration/teams",
      operations: {
        list: {
          method: "GET",
          path: `${SEI}/v2/teams/{teamRefId}/developers`,
          pathParams: { team_ref_id: "teamRefId" },
          queryParams: { page: "page", size: "size" },
          responseExtractor: passthrough,
          description: "List developers in an SEI team",
        },
      },
    },
    {
      resourceType: "sei_team_integration_filter",
      displayName: "SEI Team Integration Filter",
      description: "Integration filters for an SEI team. Supports list. Optionally pass integration_type to filter.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["team_ref_id"],
      listFilterFields: [
        { name: "integration_type", description: "Integration type to filter by" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/configuration/teams",
      operations: {
        list: {
          method: "GET",
          path: `${SEI}/v2/teams/{teamRefId}/integration_filters`,
          pathParams: { team_ref_id: "teamRefId" },
          queryParams: { integration_type: "integrationType" },
          responseExtractor: passthrough,
          description: "List integration filters for an SEI team",
        },
      },
    },

    // ------- Org Trees -------
    {
      resourceType: "sei_org_tree",
      displayName: "SEI Org Tree",
      description: "SEI organizational tree. Supports list and get.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["org_tree_id"],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/configuration/org-trees",
      operations: {
        list: {
          method: "GET",
          path: `${SEI}/v2/org-trees`,
          responseExtractor: passthrough,
          description: "List SEI organizational trees",
        },
        get: {
          method: "GET",
          path: `${SEI}/v2/org-trees/{orgTreeId}`,
          pathParams: { org_tree_id: "orgTreeId" },
          responseExtractor: passthrough,
          description: "Get SEI organizational tree details",
        },
      },
    },
    {
      resourceType: "sei_org_tree_efficiency_profile",
      displayName: "SEI Org Tree Efficiency Profile",
      description: "Efficiency profile reference for an org tree. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["org_tree_id"],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/configuration/org-trees",
      operations: {
        get: {
          method: "GET",
          path: `${SEI}/v2/org-trees/{orgTreeId}/efficiency_profile`,
          pathParams: { org_tree_id: "orgTreeId" },
          responseExtractor: passthrough,
          description: "Get efficiency profile for an org tree",
        },
      },
    },
    {
      resourceType: "sei_org_tree_productivity_profile",
      displayName: "SEI Org Tree Productivity Profile",
      description: "Productivity profile reference for an org tree. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["org_tree_id"],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/configuration/org-trees",
      operations: {
        get: {
          method: "GET",
          path: `${SEI}/v2/org-trees/{orgTreeId}/productivity_profile`,
          pathParams: { org_tree_id: "orgTreeId" },
          responseExtractor: passthrough,
          description: "Get productivity profile for an org tree",
        },
      },
    },
    {
      resourceType: "sei_org_tree_ba_profile",
      displayName: "SEI Org Tree Business Alignment Profile",
      description: "Business alignment profile reference for an org tree. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["org_tree_id"],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/configuration/org-trees",
      operations: {
        get: {
          method: "GET",
          path: `${SEI}/v2/org-trees/{orgTreeId}/businessAlignmentProfile`,
          pathParams: { org_tree_id: "orgTreeId" },
          responseExtractor: passthrough,
          description: "Get business alignment profile for an org tree",
        },
      },
    },
    {
      resourceType: "sei_org_tree_integration",
      displayName: "SEI Org Tree Integration",
      description: "Integrations associated with an org tree. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["org_tree_id"],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/configuration/org-trees",
      operations: {
        list: {
          method: "GET",
          path: `${SEI}/v2/org-trees/{orgTreeId}/integrations`,
          pathParams: { org_tree_id: "orgTreeId" },
          responseExtractor: passthrough,
          description: "List integrations for an org tree",
        },
      },
    },
    {
      resourceType: "sei_org_tree_team",
      displayName: "SEI Org Tree Team",
      description: "Team hierarchy within an org tree. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["org_tree_id"],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/configuration/org-trees",
      operations: {
        list: {
          method: "GET",
          path: `${SEI}/v2/org-trees/{orgTreeId}/teams`,
          pathParams: { org_tree_id: "orgTreeId" },
          responseExtractor: passthrough,
          description: "List teams in an org tree",
        },
      },
    },

    // ------- Business Alignment -------
    {
      resourceType: "sei_business_alignment",
      displayName: "SEI Business Alignment",
      description:
        "Business alignment profiles and insight metrics. harness_list for profiles, harness_get for insight metrics (pass profile_id, team_ref_id, date_start, date_end).",
      toolset: "sei",
      scope: "account",
      identifierFields: ["profile_id"],
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date (YYYY-MM-DD)" },
        { name: "date_end", description: "End date (YYYY-MM-DD)" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/business-alignment",
      operations: {
        list: {
          method: "GET",
          path: `${SEI}/v2/insights/ba/profiles`,
          responseExtractor: passthrough,
          description: "List business alignment profiles",
        },
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/ba/feature_metrics`,
          bodyBuilder: (input) => ({
            profileId: input.profile_id,
            teamRefId: input.team_ref_id,
            dateStart: input.date_start,
            dateEnd: input.date_end,
          }),
          responseExtractor: passthrough,
          description: "Get business alignment insight metrics for a profile",
        },
      },
    },
    {
      resourceType: "sei_ba_summary",
      displayName: "SEI Business Alignment Summary",
      description: "Business alignment feature summary. Supports get. Pass profile_id, team_ref_id, date_start, date_end.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["profile_id"],
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date (YYYY-MM-DD)" },
        { name: "date_end", description: "End date (YYYY-MM-DD)" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/business-alignment",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/ba/feature_summary`,
          bodyBuilder: (input) => ({
            profileId: input.profile_id,
            teamRefId: input.team_ref_id,
            dateStart: input.date_start,
            dateEnd: input.date_end,
          }),
          responseExtractor: passthrough,
          description: "Get business alignment feature summary for a profile",
        },
      },
    },
    {
      resourceType: "sei_ba_drilldown",
      displayName: "SEI Business Alignment Drilldown",
      description: "Business alignment drilldown data. Supports get. Pass profile_id, team_ref_id, date_start, date_end.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["profile_id"],
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date (YYYY-MM-DD)" },
        { name: "date_end", description: "End date (YYYY-MM-DD)" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/business-alignment",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/ba/drilldown`,
          bodyBuilder: (input) => ({
            profileId: input.profile_id,
            teamRefId: input.team_ref_id,
            dateStart: input.date_start,
            dateEnd: input.date_end,
          }),
          responseExtractor: passthrough,
          description: "Get business alignment drilldown data for a profile",
        },
      },
    },

    // ------- AI Coding Insights -------
    {
      resourceType: "sei_ai_usage",
      displayName: "SEI AI Usage",
      description:
        "AI coding assistant usage time-series metrics (lines suggested, accepted, acceptance rate, DAU). Supports get. Pass integration_type (cursor/windsurf/all_assistants), granularity, metric_type.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        ...AI_FILTER_FIELDS,
        { name: "granularity", description: "Time granularity", enum: ["DAILY", "WEEKLY", "MONTHLY"] },
        {
          name: "metric_type",
          description: "Metric to retrieve",
          enum: ["linesAddedPerContributor", "linesSuggested", "linesAccepted", "acceptanceRatePercentage", "DAILY_ACTIVE_USERS"],
        },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/usage/metrics`,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get AI coding assistant usage time-series metrics",
        },
      },
    },
    {
      resourceType: "sei_ai_usage_breakdown",
      displayName: "SEI AI Usage Breakdown",
      description: "AI coding assistant usage breakdown by child teams. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        ...AI_FILTER_FIELDS,
        { name: "granularity", description: "Time granularity", enum: ["DAILY", "WEEKLY", "MONTHLY"] },
        {
          name: "metric_type",
          description: "Metric to retrieve",
          enum: ["linesAddedPerContributor", "linesSuggested", "linesAccepted", "acceptanceRatePercentage", "DAILY_ACTIVE_USERS"],
        },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        list: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/usage/breakdown`,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get AI coding assistant usage breakdown by team",
        },
      },
    },
    {
      resourceType: "sei_ai_usage_summary",
      displayName: "SEI AI Usage Summary",
      description:
        "Aggregate AI coding assistant usage stats — total users, acceptance rates, lines of code for the period. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [...AI_FILTER_FIELDS],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/usage/summary`,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get AI coding assistant usage summary statistics",
        },
      },
    },
    {
      resourceType: "sei_ai_top_language",
      displayName: "SEI AI Top Language",
      description: "Top programming languages used with AI coding assistants, ranked by usage. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [...AI_FILTER_FIELDS],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        list: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/usage/top_languages`,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "List top programming languages used with AI coding assistants",
        },
      },
    },
    {
      resourceType: "sei_ai_adoption",
      displayName: "SEI AI Adoption",
      description: "AI coding assistant adoption metrics over time. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        ...AI_FILTER_FIELDS,
        { name: "granularity", description: "Time granularity", enum: ["DAILY", "WEEKLY", "MONTHLY"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/adoptions`,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get AI coding assistant adoption metrics over time",
        },
      },
    },
    {
      resourceType: "sei_ai_adoption_breakdown",
      displayName: "SEI AI Adoption Breakdown",
      description: "AI coding assistant adoption breakdown by child teams. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [...AI_FILTER_FIELDS],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        list: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/adoptions/breakdown`,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get AI coding assistant adoption breakdown by team",
        },
      },
    },
    {
      resourceType: "sei_ai_adoption_summary",
      displayName: "SEI AI Adoption Summary",
      description:
        "AI coding assistant adoption summary with current vs previous period comparison. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [...AI_FILTER_FIELDS],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/adoptions/summary`,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get AI coding assistant adoption summary with period comparison",
        },
      },
    },
    {
      resourceType: "sei_ai_impact",
      displayName: "SEI AI Impact (PR Velocity)",
      description:
        "AI impact on PR velocity — compares cycle time for AI-assisted vs non-AI-assisted PRs. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        ...AI_FILTER_FIELDS,
        { name: "granularity", description: "Time granularity", enum: ["DAILY", "WEEKLY", "MONTHLY"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/pr-velocity/summary`,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get AI impact on PR velocity (AI-assisted vs non-AI-assisted)",
        },
      },
    },
    {
      resourceType: "sei_ai_rework",
      displayName: "SEI AI Impact (Rework)",
      description:
        "AI impact on code rework — compares rework rates for AI-assisted vs non-AI-assisted code. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        ...AI_FILTER_FIELDS,
        { name: "granularity", description: "Time granularity", enum: ["DAILY", "WEEKLY", "MONTHLY"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/rework/summary`,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get AI impact on code rework rates (AI-assisted vs non-AI-assisted)",
        },
      },
    },
    {
      resourceType: "sei_ai_raw_metric",
      displayName: "SEI AI Raw Metric",
      description:
        "Per-developer raw AI coding assistant metrics — lines suggested, accepted, acceptance rates per individual. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [...AI_FILTER_FIELDS],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        list: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/raw_metrics/v2`,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get per-developer raw AI coding assistant metrics",
        },
      },
    },
  ],
};
