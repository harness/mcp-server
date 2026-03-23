import type { ResourceDefinition, ToolsetDefinition, FilterFieldSpec } from "../types.js";
import type { PathBuilderConfig } from "../types.js";
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
  {
    name: "metric",
    description: "DORA metric to fetch",
    enum: ["deployment_frequency", "deployment_frequency_drilldown", "change_failure_rate", "change_failure_rate_drilldown", "mttr", "lead_time"],
  },
  { name: "team_ref_id", description: "Team reference identifier" },
  { name: "date_start", description: "Start date for metric calculation" },
  { name: "date_end", description: "End date for metric calculation" },
  { name: "granularity", description: "Time granularity", enum: ["weekly", "monthly", "yearly", "quarterly"] },
];

const BA_LIST_FILTER_FIELDS: FilterFieldSpec[] = [
  { name: "profile_id", description: "Business alignment profile ID" },
  { name: "team_ref_id", description: "Team reference identifier" },
  { name: "date_start", description: "Start date (YYYY-MM-DD)" },
  { name: "date_end", description: "End date (YYYY-MM-DD)" },
];

const BA_GET_FILTER_FIELDS: FilterFieldSpec[] = [
  {
    name: "aspect",
    description: "Which BA data to fetch",
    enum: ["feature_metrics", "feature_summary", "drilldown"],
  },
  ...BA_LIST_FILTER_FIELDS,
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

function parseTeamRefId(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  return isNaN(n) ? undefined : n;
}

function aiInsightBuildBody(input: Record<string, unknown>) {
  const integrationType = input.integration_type ?? "all_assistants";
  return {
    teamRefId: parseTeamRefId(input.team_ref_id),
    startDate: input.date_start,
    endDate: input.date_end,
    integrationType:
      integrationType === "all_assistants"
        ? ["cursor", "windsurf"]
        : [integrationType],
    ...(input.granularity ? { granularity: input.granularity } : {}),
    ...(input.metric_type ? { metricType: input.metric_type } : {}),
  };
}

// ─── Path builders for consolidated resources ─────────────────────────────────

const DORA_METRIC_TO_PATH: Record<string, string> = {
  deployment_frequency: "deploymentFrequency",
  deployment_frequency_drilldown: "deploymentFrequency/drilldown",
  change_failure_rate: "changeFailureRate",
  change_failure_rate_drilldown: "changeFailureRate/drilldown",
  mttr: "mttr",
  lead_time: "leadtime",
};

function doraPathBuilder(input: Record<string, unknown>, _config: PathBuilderConfig): string {
  const metric = (input.metric as string) || "deployment_frequency";
  const suffix = DORA_METRIC_TO_PATH[metric] ?? DORA_METRIC_TO_PATH.deployment_frequency;
  return `${SEI}/v2/insights/efficiency/${suffix}`;
}

function teamDetailPathBuilder(input: Record<string, unknown>, _config: PathBuilderConfig): string {
  const teamRefId = input.team_ref_id as string;
  if (!teamRefId) throw new Error("team_ref_id is required for sei_team_detail");
  const aspect = (input.aspect as string) || "integrations";
  const suffix =
    aspect === "integrations"
      ? "integrations"
      : aspect === "developers"
        ? "developers"
        : "integration_filters";
  return `${SEI}/v2/teams/${encodeURIComponent(teamRefId)}/${suffix}`;
}

function orgTreeDetailPathBuilder(input: Record<string, unknown>, _config: PathBuilderConfig): string {
  const orgTreeId = input.org_tree_id as string;
  if (!orgTreeId) throw new Error("org_tree_id is required for sei_org_tree_detail");
  const aspect = (input.aspect as string) || "efficiency_profile";
  const suffix =
    aspect === "efficiency_profile"
      ? "efficiency_profile"
      : aspect === "productivity_profile"
        ? "productivity_profile"
        : aspect === "business_alignment_profile"
          ? "businessAlignmentProfile"
          : aspect === "integrations"
            ? "integrations"
            : "teams";
  return `${SEI}/v2/org-trees/${encodeURIComponent(orgTreeId)}/${suffix}`;
}

function baPathBuilder(input: Record<string, unknown>, _config: PathBuilderConfig): string {
  const aspect = (input.aspect as string) || "feature_metrics";
  const suffix =
    aspect === "feature_summary"
      ? "feature_summary"
      : aspect === "drilldown"
        ? "drilldown"
        : "feature_metrics";
  return `${SEI}/v2/insights/ba/${suffix}`;
}

function aiUsagePathBuilder(input: Record<string, unknown>, _config: PathBuilderConfig): string {
  const aspect = (input.aspect as string) || "metrics";
  const suffix =
    aspect === "metrics"
      ? "usage/metrics"
      : aspect === "breakdown"
        ? "usage/breakdown"
        : aspect === "summary"
          ? "usage/summary"
          : "usage/top_languages";
  return `${SEI}/v2/insights/coding-assistant/${suffix}`;
}

function aiAdoptionPathBuilder(input: Record<string, unknown>, _config: PathBuilderConfig): string {
  const aspect = (input.aspect as string) || "metrics";
  const suffix =
    aspect === "breakdown"
      ? "adoptions/breakdown"
      : aspect === "summary"
        ? "adoptions/summary"
        : "adoptions";
  return `${SEI}/v2/insights/coding-assistant/${suffix}`;
}

function aiImpactPathBuilder(input: Record<string, unknown>, _config: PathBuilderConfig): string {
  const aspect = (input.aspect as string) || "pr_velocity";
  const suffix = aspect === "rework" ? "rework/summary" : "pr-velocity/summary";
  return `${SEI}/v2/insights/coding-assistant/${suffix}`;
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
      headerBasedScoping: true,
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
      scope: "project",
      headerBasedScoping: true,
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
          bodyBuilder: (input) => {
            const refId = parseTeamRefId(input.team_ref_id);
            return {
              startDate: input.date_start,
              endDate: input.date_end,
              featureType: input.feature_type ?? "PR_VELOCITY",
              granularity: input.granularity ?? "WEEKLY",
              ...(refId !== undefined ? { teamRefIds: [refId] } : {}),
              ...(input.developer_ids ? { developerIds: input.developer_ids } : {}),
              ...(input.team_ids ? { teamIds: input.team_ids } : {}),
              ...(input.stack_by ? { stackBy: input.stack_by } : {}),
              ...(input.page !== undefined ? { page: input.page } : {}),
              ...(input.page_size !== undefined ? { pageSize: input.page_size } : {}),
            };
          },
          responseExtractor: passthrough,
          description: "Get productivity feature metrics (e.g. PR velocity) for a team",
        },
      },
    },

    // ─── DORA Metrics (consolidated: 6 → 1) ─────────────────────────────────────
    {
      resourceType: "sei_dora_metric",
      displayName: "SEI DORA Metric",
      description:
        "DORA metrics. harness_get with metric: deployment_frequency | deployment_frequency_drilldown | change_failure_rate | change_failure_rate_drilldown | mttr | lead_time. Pass team_ref_id, date_start, date_end, granularity.",
      toolset: "sei",
      scope: "project",
      headerBasedScoping: true,
      identifierFields: [],
      listFilterFields: [...DORA_FILTER_FIELDS],
      deepLinkTemplate: DORA_DEEP_LINK,
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/efficiency/deploymentFrequency`,
          pathBuilder: doraPathBuilder,
          bodyBuilder: doraBuildBody,
          responseExtractor: passthrough,
          description: "Get DORA metric. Pass metric (deployment_frequency, change_failure_rate, mttr, lead_time, or *_drilldown variants), team_ref_id, date_start, date_end, granularity.",
        },
      },
    },

    // ─── Teams ────────────────────────────────────────────────────────────────
    {
      resourceType: "sei_team",
      displayName: "SEI Team",
      description: "SEI team entity. Supports list and get.",
      toolset: "sei",
      scope: "account",
      headerBasedScoping: true,
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
    // Team detail (consolidated: integrations, developers, integration_filters → 1)
    {
      resourceType: "sei_team_detail",
      displayName: "SEI Team Detail",
      description:
        "Team sub-resources. harness_list with team_ref_id and aspect: integrations | developers | integration_filters. For integration_filters, optionally pass integration_type.",
      toolset: "sei",
      scope: "project",
      headerBasedScoping: true,
      identifierFields: ["team_ref_id"],
      listFilterFields: [
        {
          name: "aspect",
          description: "Which team detail to fetch",
          enum: ["integrations", "developers", "integration_filters"],
        },
        { name: "integration_type", description: "Filter by integration type (for aspect=integration_filters)" },
      ],
      deepLinkTemplate: TEAMS_DEEP_LINK,
      operations: {
        list: {
          method: "GET",
          path: `${SEI}/v2/teams`,
          pathBuilder: teamDetailPathBuilder,
          responseExtractor: passthrough,
          queryParams: { integration_type: "integrationType" },
          description: "List team integrations, developers, or integration filters. Pass team_ref_id and aspect.",
        },
      },
    },

    // ─── Org Trees ────────────────────────────────────────────────────────────
    {
      resourceType: "sei_org_tree",
      displayName: "SEI Org Tree",
      description: "SEI organizational tree. Supports list and get.",
      toolset: "sei",
      scope: "project",
      headerBasedScoping: true,
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
    // Org tree detail (consolidated: 5 sub-resources → 1)
    {
      resourceType: "sei_org_tree_detail",
      displayName: "SEI Org Tree Detail",
      description:
        "Org tree sub-resources. harness_get or harness_list with org_tree_id and aspect: efficiency_profile | productivity_profile | business_alignment_profile | integrations | teams.",
      toolset: "sei",
      scope: "project",
      headerBasedScoping: true,
      identifierFields: ["org_tree_id"],
      listFilterFields: [
        {
          name: "aspect",
          description: "Which org tree detail to fetch",
          enum: ["efficiency_profile", "productivity_profile", "business_alignment_profile", "integrations", "teams"],
        },
      ],
      deepLinkTemplate: ORG_TREE_DEEP_LINK,
      operations: {
        get: {
          method: "GET",
          path: `${SEI}/v2/org-trees`,
          pathBuilder: orgTreeDetailPathBuilder,
          responseExtractor: passthrough,
          description: "Get org tree efficiency/profile/integrations/teams. Pass org_tree_id and aspect.",
        },
        list: {
          method: "GET",
          path: `${SEI}/v2/org-trees`,
          pathBuilder: orgTreeDetailPathBuilder,
          responseExtractor: passthrough,
          description: "List org tree integrations or teams. Pass org_tree_id and aspect (integrations or teams).",
        },
      },
    },

    // ─── Business Alignment (consolidated: 3 → 1) ──────────────────────────────
    {
      resourceType: "sei_business_alignment",
      displayName: "SEI Business Alignment",
      description:
        "Business alignment. harness_list for profiles. harness_get for metrics/summary/drilldown (pass aspect: feature_metrics | feature_summary | drilldown, profile_id, team_ref_id, date_start, date_end).",
      toolset: "sei",
      scope: "project",
      headerBasedScoping: true,
      identifierFields: ["profile_id"],
      listFilterFields: BA_GET_FILTER_FIELDS,
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
          pathBuilder: baPathBuilder,
          bodyBuilder: baBuildBody,
          responseExtractor: passthrough,
          description: "Get BA feature metrics, feature summary, or drilldown. Pass aspect, profile_id, team_ref_id, date_start, date_end.",
        },
      },
    },

    // ─── AI Coding Insights (consolidated: 11 → 4) ─────────────────────────────
    // sei_ai_usage: metrics | breakdown | summary | top_languages
    {
      resourceType: "sei_ai_usage",
      displayName: "SEI AI Usage",
      description:
        "AI coding assistant usage. harness_get or harness_list with aspect: metrics | breakdown | summary | top_languages. Pass team_ref_id, date_start, date_end, integration_type. For metrics: granularity, metric_type.",
      toolset: "sei",
      scope: "project",
      headerBasedScoping: true,
      identifierFields: [],
      listFilterFields: [
        {
          name: "aspect",
          description: "Which usage data to fetch",
          enum: ["metrics", "breakdown", "summary", "top_languages"],
        },
        ...AI_FILTER_FIELDS,
        GRANULARITY_FIELD,
        METRIC_TYPE_FIELD,
      ],
      deepLinkTemplate: AI_DEEP_LINK,
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/usage/metrics`,
          pathBuilder: aiUsagePathBuilder,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get AI usage metrics or summary. Pass aspect (metrics|summary), team_ref_id, date_start, date_end.",
        },
        list: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/usage/metrics`,
          pathBuilder: aiUsagePathBuilder,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "List AI usage breakdown or top languages. Pass aspect (breakdown|top_languages), team_ref_id, date_start, date_end.",
        },
      },
    },
    // sei_ai_adoption: metrics | breakdown | summary
    {
      resourceType: "sei_ai_adoption",
      displayName: "SEI AI Adoption",
      description:
        "AI coding assistant adoption. harness_get or harness_list with aspect: metrics | breakdown | summary. Pass team_ref_id, date_start, date_end, integration_type, granularity.",
      toolset: "sei",
      scope: "project",
      headerBasedScoping: true,
      identifierFields: [],
      listFilterFields: [
        {
          name: "aspect",
          description: "Which adoption data to fetch",
          enum: ["metrics", "breakdown", "summary"],
        },
        ...AI_FILTER_FIELDS,
        GRANULARITY_FIELD,
      ],
      deepLinkTemplate: AI_DEEP_LINK,
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/adoptions`,
          pathBuilder: aiAdoptionPathBuilder,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get AI adoption metrics or summary. Pass aspect (metrics|summary), team_ref_id, date_start, date_end.",
        },
        list: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/adoptions`,
          pathBuilder: aiAdoptionPathBuilder,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "List AI adoption breakdown. Pass aspect=breakdown, team_ref_id, date_start, date_end.",
        },
      },
    },
    // sei_ai_impact: pr_velocity | rework
    {
      resourceType: "sei_ai_impact",
      displayName: "SEI AI Impact",
      description:
        "AI impact on PR velocity or rework. harness_get with aspect: pr_velocity | rework. Pass team_ref_id, date_start, date_end, integration_type, granularity.",
      toolset: "sei",
      scope: "project",
      headerBasedScoping: true,
      identifierFields: [],
      listFilterFields: [
        {
          name: "aspect",
          description: "Which impact metric to fetch",
          enum: ["pr_velocity", "rework"],
        },
        ...AI_FILTER_FIELDS,
        GRANULARITY_FIELD,
      ],
      deepLinkTemplate: AI_DEEP_LINK,
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/pr-velocity/summary`,
          pathBuilder: aiImpactPathBuilder,
          bodyBuilder: aiInsightBuildBody,
          responseExtractor: passthrough,
          description: "Get AI impact on PR velocity or rework. Pass aspect (pr_velocity|rework), team_ref_id, date_start, date_end.",
        },
      },
    },
    // sei_ai_raw_metric: per-developer raw metrics (unchanged)
    {
      resourceType: "sei_ai_raw_metric",
      displayName: "SEI AI Raw Metric",
      description:
        "Per-developer raw AI coding assistant metrics — lines suggested, accepted, acceptance rates per individual. Supports list.",
      toolset: "sei",
      scope: "project",
      headerBasedScoping: true,
      identifierFields: [],
      listFilterFields: [...AI_FILTER_FIELDS],
      deepLinkTemplate: AI_DEEP_LINK,
      operations: {
        list: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/raw_metrics/v2`,
          bodyBuilder: (input) => ({
            ...aiInsightBuildBody(input),
            pagination: {
              pageNumber: typeof input.page === "number" ? input.page : 0,
              maxPageSize: typeof input.size === "number" ? input.size : 10,
            },
          }),
          responseExtractor: passthrough,
          description: "Get per-developer raw AI coding assistant metrics",
        },
      },
    },
  ],
};
