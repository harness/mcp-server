import type { ResourceDefinition, ToolsetDefinition, FilterFieldSpec } from "../types.js";
import { passthrough } from "../extractors.js";

/** SEI base path */
const SEI = "/gateway/sei/api";

// ─── Deep link templates ──────────────────────────────────────────────────────

const DORA_DEEP_LINK = "/ng/account/{accountId}/module/sei/insights/dora";
const AI_DEEP_LINK = "/ng/account/{accountId}/module/sei/insights/ai-coding";
const ORG_TREE_DEEP_LINK = "/ng/account/{accountId}/module/sei/configuration/org-trees";
const BA_DEEP_LINK = "/ng/account/{accountId}/module/sei/insights/business-alignment";
const TEAMS_DEEP_LINK = "/ng/account/{accountId}/module/sei/configuration/teams";

// ─── Shared filter field sets ─────────────────────────────────────────────────

const DORA_FILTER_FIELDS: FilterFieldSpec[] = [
  { name: "team_ref_id", description: "Team reference identifier" },
  { name: "date_start", description: "Start date for metric calculation" },
  { name: "date_end", description: "End date for metric calculation" },
  { name: "granularity", description: "Time granularity", enum: ["DAY", "WEEK", "MONTH"] },
];

const BA_FILTER_FIELDS: FilterFieldSpec[] = [
  { name: "team_ref_id", description: "Team reference identifier" },
  { name: "date_start", description: "Start date (YYYY-MM-DD)" },
  { name: "date_end", description: "End date (YYYY-MM-DD)" },
];

const AI_FILTER_FIELDS: FilterFieldSpec[] = [
  { name: "team_ref_id", description: "Team reference identifier (use sei_team list to find)" },
  { name: "date_start", description: "Start date (YYYY-MM-DD)" },
  { name: "date_end", description: "End date (YYYY-MM-DD)" },
  { name: "integration_type", description: "AI coding assistant type", enum: ["cursor", "windsurf", "all_assistants"] },
];

const GRANULARITY_FIELD: FilterFieldSpec = {
  name: "granularity", description: "Time granularity", enum: ["DAILY", "WEEKLY", "MONTHLY"],
};

const METRIC_TYPE_FIELD: FilterFieldSpec = {
  name: "metric_type",
  description: "Metric to retrieve",
  enum: ["linesAddedPerContributor", "linesSuggested", "linesAccepted", "acceptanceRatePercentage", "DAILY_ACTIVE_USERS"],
};

// ─── Body builders ────────────────────────────────────────────────────────────

function doraBuildBody(input: Record<string, unknown>) {
  return {
    teamRefId: input.team_ref_id,
    dateStart: input.date_start,
    dateEnd: input.date_end,
    granularity: input.granularity ?? "MONTH",
  };
}

function baBuildBody(input: Record<string, unknown>) {
  return {
    profileId: input.profile_id,
    teamRefId: input.team_ref_id,
    dateStart: input.date_start,
    dateEnd: input.date_end,
  };
}

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

// ─── Resource factories ───────────────────────────────────────────────────────

/** Factory for DORA metric resources — all POST to /insights/efficiency/{suffix} with doraBuildBody */
function doraResource(
  pathSuffix: string,
  resourceType: string,
  displayName: string,
  description: string,
  opDescription: string,
): ResourceDefinition {
  return {
    resourceType,
    displayName,
    description,
    toolset: "sei",
    scope: "account",
    identifierFields: [],
    listFilterFields: [...DORA_FILTER_FIELDS],
    deepLinkTemplate: DORA_DEEP_LINK,
    operations: {
      get: {
        method: "POST",
        path: `${SEI}/v2/insights/efficiency/${pathSuffix}`,
        bodyBuilder: doraBuildBody,
        responseExtractor: passthrough,
        description: opDescription,
      },
    },
  };
}

/** Factory for org tree sub-resources — all GET to /org-trees/{orgTreeId}/{suffix} */
function orgTreeSubResource(
  pathSuffix: string,
  resourceType: string,
  displayName: string,
  description: string,
  op: "get" | "list",
  opDescription: string,
): ResourceDefinition {
  return {
    resourceType,
    displayName,
    description,
    toolset: "sei",
    scope: "account",
    identifierFields: ["org_tree_id"],
    deepLinkTemplate: ORG_TREE_DEEP_LINK,
    operations: {
      [op]: {
        method: "GET",
        path: `${SEI}/v2/org-trees/{orgTreeId}/${pathSuffix}`,
        pathParams: { org_tree_id: "orgTreeId" },
        responseExtractor: passthrough,
        description: opDescription,
      },
    },
  };
}

/** Factory for AI coding insight resources — all POST to /insights/coding-assistant/{suffix} with aiInsightBuildBody */
function aiResource(
  pathSuffix: string,
  resourceType: string,
  displayName: string,
  description: string,
  op: "get" | "list",
  opDescription: string,
  filterFields: FilterFieldSpec[] = [...AI_FILTER_FIELDS],
): ResourceDefinition {
  return {
    resourceType,
    displayName,
    description,
    toolset: "sei",
    scope: "account",
    identifierFields: [],
    listFilterFields: filterFields,
    deepLinkTemplate: AI_DEEP_LINK,
    operations: {
      [op]: {
        method: "POST",
        path: `${SEI}/v2/insights/coding-assistant/${pathSuffix}`,
        bodyBuilder: aiInsightBuildBody,
        responseExtractor: passthrough,
        description: opDescription,
      },
    },
  };
}

// ─── Toolset Definition ───────────────────────────────────────────────────────

export const seiToolset: ToolsetDefinition = {
  name: "sei",
  displayName: "Software Engineering Insights",
  description:
    "Harness SEI — engineering metrics, DORA metrics, teams, org trees, business alignment, and AI coding insights",
  resources: [
    // ─── Generic Metrics ──────────────────────────────────────────────────────
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

    // ─── Productivity Feature Metrics ─────────────────────────────────────────
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

    // ─── DORA Metrics ─────────────────────────────────────────────────────────
    doraResource(
      "deploymentFrequency", "sei_deployment_frequency", "SEI Deployment Frequency",
      "DORA deployment frequency metric. Supports get. Pass team_ref_id, date_start, date_end, granularity.",
      "Get deployment frequency metrics for a team over a date range",
    ),
    doraResource(
      "deploymentFrequency/drilldown", "sei_deployment_frequency_drilldown", "SEI Deployment Frequency Drilldown",
      "DORA deployment frequency drilldown data. Supports get.",
      "Get deployment frequency drilldown data",
    ),
    doraResource(
      "changeFailureRate", "sei_change_failure_rate", "SEI Change Failure Rate",
      "DORA change failure rate metric. Supports get.",
      "Get change failure rate metrics for a team",
    ),
    doraResource(
      "changeFailureRate/drilldown", "sei_change_failure_rate_drilldown", "SEI Change Failure Rate Drilldown",
      "DORA change failure rate drilldown data. Supports get.",
      "Get change failure rate drilldown data",
    ),
    doraResource(
      "mttr", "sei_mttr", "SEI MTTR",
      "DORA mean time to restore metric. Supports get.",
      "Get mean time to restore metrics for a team",
    ),
    doraResource(
      "leadtime", "sei_lead_time", "SEI Lead Time",
      "DORA lead time for changes metric. Supports get.",
      "Get lead time for changes metrics for a team",
    ),

    // ─── Teams ────────────────────────────────────────────────────────────────
    {
      resourceType: "sei_team",
      displayName: "SEI Team",
      description: "SEI team entity. Supports list and get.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["team_ref_id"],
      deepLinkTemplate: TEAMS_DEEP_LINK,
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
      deepLinkTemplate: TEAMS_DEEP_LINK,
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
      deepLinkTemplate: TEAMS_DEEP_LINK,
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
      deepLinkTemplate: TEAMS_DEEP_LINK,
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

    // ─── Org Trees ────────────────────────────────────────────────────────────
    {
      resourceType: "sei_org_tree",
      displayName: "SEI Org Tree",
      description: "SEI organizational tree. Supports list and get.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["org_tree_id"],
      deepLinkTemplate: ORG_TREE_DEEP_LINK,
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
    orgTreeSubResource(
      "efficiency_profile", "sei_org_tree_efficiency_profile", "SEI Org Tree Efficiency Profile",
      "Efficiency profile reference for an org tree. Supports get.", "get",
      "Get efficiency profile for an org tree",
    ),
    orgTreeSubResource(
      "productivity_profile", "sei_org_tree_productivity_profile", "SEI Org Tree Productivity Profile",
      "Productivity profile reference for an org tree. Supports get.", "get",
      "Get productivity profile for an org tree",
    ),
    orgTreeSubResource(
      "businessAlignmentProfile", "sei_org_tree_ba_profile", "SEI Org Tree Business Alignment Profile",
      "Business alignment profile reference for an org tree. Supports get.", "get",
      "Get business alignment profile for an org tree",
    ),
    orgTreeSubResource(
      "integrations", "sei_org_tree_integration", "SEI Org Tree Integration",
      "Integrations associated with an org tree. Supports list.", "list",
      "List integrations for an org tree",
    ),
    orgTreeSubResource(
      "teams", "sei_org_tree_team", "SEI Org Tree Team",
      "Team hierarchy within an org tree. Supports list.", "list",
      "List teams in an org tree",
    ),

    // ─── Business Alignment ───────────────────────────────────────────────────
    {
      resourceType: "sei_business_alignment",
      displayName: "SEI Business Alignment",
      description:
        "Business alignment profiles and insight metrics. harness_list for profiles, harness_get for insight metrics (pass profile_id, team_ref_id, date_start, date_end).",
      toolset: "sei",
      scope: "account",
      identifierFields: ["profile_id"],
      listFilterFields: [...BA_FILTER_FIELDS],
      deepLinkTemplate: BA_DEEP_LINK,
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
          bodyBuilder: baBuildBody,
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
      listFilterFields: [...BA_FILTER_FIELDS],
      deepLinkTemplate: BA_DEEP_LINK,
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/ba/feature_summary`,
          bodyBuilder: baBuildBody,
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
      listFilterFields: [...BA_FILTER_FIELDS],
      deepLinkTemplate: BA_DEEP_LINK,
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/ba/drilldown`,
          bodyBuilder: baBuildBody,
          responseExtractor: passthrough,
          description: "Get business alignment drilldown data for a profile",
        },
      },
    },

    // ─── AI Coding Insights ───────────────────────────────────────────────────
    aiResource(
      "usage/metrics", "sei_ai_usage", "SEI AI Usage",
      "AI coding assistant usage time-series metrics (lines suggested, accepted, acceptance rate, DAU). Supports get. Pass integration_type (cursor/windsurf/all_assistants), granularity, metric_type.",
      "get", "Get AI coding assistant usage time-series metrics",
      [...AI_FILTER_FIELDS, GRANULARITY_FIELD, METRIC_TYPE_FIELD],
    ),
    aiResource(
      "usage/breakdown", "sei_ai_usage_breakdown", "SEI AI Usage Breakdown",
      "AI coding assistant usage breakdown by child teams. Supports list.",
      "list", "Get AI coding assistant usage breakdown by team",
      [...AI_FILTER_FIELDS, GRANULARITY_FIELD, METRIC_TYPE_FIELD],
    ),
    aiResource(
      "usage/summary", "sei_ai_usage_summary", "SEI AI Usage Summary",
      "Aggregate AI coding assistant usage stats — total users, acceptance rates, lines of code for the period. Supports get.",
      "get", "Get AI coding assistant usage summary statistics",
    ),
    aiResource(
      "usage/top_languages", "sei_ai_top_language", "SEI AI Top Language",
      "Top programming languages used with AI coding assistants, ranked by usage. Supports list.",
      "list", "List top programming languages used with AI coding assistants",
    ),
    aiResource(
      "adoptions", "sei_ai_adoption", "SEI AI Adoption",
      "AI coding assistant adoption metrics over time. Supports get.",
      "get", "Get AI coding assistant adoption metrics over time",
      [...AI_FILTER_FIELDS, GRANULARITY_FIELD],
    ),
    aiResource(
      "adoptions/breakdown", "sei_ai_adoption_breakdown", "SEI AI Adoption Breakdown",
      "AI coding assistant adoption breakdown by child teams. Supports list.",
      "list", "Get AI coding assistant adoption breakdown by team",
    ),
    aiResource(
      "adoptions/summary", "sei_ai_adoption_summary", "SEI AI Adoption Summary",
      "AI coding assistant adoption summary with current vs previous period comparison. Supports get.",
      "get", "Get AI coding assistant adoption summary with period comparison",
    ),
    aiResource(
      "pr-velocity/summary", "sei_ai_impact", "SEI AI Impact (PR Velocity)",
      "AI impact on PR velocity — compares cycle time for AI-assisted vs non-AI-assisted PRs. Supports get.",
      "get", "Get AI impact on PR velocity (AI-assisted vs non-AI-assisted)",
      [...AI_FILTER_FIELDS, GRANULARITY_FIELD],
    ),
    aiResource(
      "rework/summary", "sei_ai_rework", "SEI AI Impact (Rework)",
      "AI impact on code rework — compares rework rates for AI-assisted vs non-AI-assisted code. Supports get.",
      "get", "Get AI impact on code rework rates (AI-assisted vs non-AI-assisted)",
      [...AI_FILTER_FIELDS, GRANULARITY_FIELD],
    ),
    aiResource(
      "raw_metrics/v2", "sei_ai_raw_metric", "SEI AI Raw Metric",
      "Per-developer raw AI coding assistant metrics — lines suggested, accepted, acceptance rates per individual. Supports list.",
      "list", "Get per-developer raw AI coding assistant metrics",
    ),
  ],
};
