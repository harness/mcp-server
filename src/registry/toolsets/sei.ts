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

export const seiToolset: ToolsetDefinition = {
  name: "sei",
  displayName: "Software Engineering Insights",
  description:
    "Harness SEI — engineering metrics, DORA metrics, teams, org trees, business alignment, and AI coding insights",
  resources: [
    // ------- Existing -------
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
          queryParams: {
            page: "page",
            size: "size",
          },
          responseExtractor: passthrough,
          description: "List SEI metrics",
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
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
        { name: "granularity", description: "Time granularity", enum: ["DAY", "WEEK", "MONTH"] },
      ],
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
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
        { name: "granularity", description: "Time granularity", enum: ["DAY", "WEEK", "MONTH"] },
      ],
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
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
        { name: "granularity", description: "Time granularity", enum: ["DAY", "WEEK", "MONTH"] },
      ],
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
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
        { name: "granularity", description: "Time granularity", enum: ["DAY", "WEEK", "MONTH"] },
      ],
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
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
        { name: "granularity", description: "Time granularity", enum: ["DAY", "WEEK", "MONTH"] },
      ],
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
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
        { name: "granularity", description: "Time granularity", enum: ["DAY", "WEEK", "MONTH"] },
      ],
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
          responseExtractor: passthrough,
          description: "List developers in an SEI team",
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

    // ------- Business Alignment -------
    {
      resourceType: "sei_business_alignment",
      displayName: "SEI Business Alignment",
      description: "Business alignment profiles and insight metrics. Supports list and get.",
      toolset: "sei",
      scope: "account",
      identifierFields: ["profile_id"],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/business-alignment",
      operations: {
        list: {
          method: "GET",
          path: `${SEI}/v2/business-alignment/profiles`,
          responseExtractor: passthrough,
          description: "List business alignment profiles",
        },
        get: {
          method: "POST",
          path: `${SEI}/v2/business-alignment/insights`,
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

    // ------- AI Coding Insights -------
    {
      resourceType: "sei_ai_usage",
      displayName: "SEI AI Usage",
      description: "AI coding assistant usage metrics. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/usage/metrics`,
          bodyBuilder: (input) => ({
            teamRefId: input.team_ref_id,
            dateStart: input.date_start,
            dateEnd: input.date_end,
          }),
          responseExtractor: passthrough,
          description: "Get AI coding assistant usage metrics",
        },
      },
    },
    {
      resourceType: "sei_ai_usage_breakdown",
      displayName: "SEI AI Usage Breakdown",
      description: "AI coding assistant usage breakdown by dimension. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        list: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/usage/breakdown`,
          bodyBuilder: (input) => ({
            teamRefId: input.team_ref_id,
            dateStart: input.date_start,
            dateEnd: input.date_end,
          }),
          responseExtractor: passthrough,
          description: "Get AI coding assistant usage breakdown",
        },
      },
    },
    {
      resourceType: "sei_ai_adoption",
      displayName: "SEI AI Adoption",
      description: "AI coding assistant adoption metrics. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/adoptions`,
          bodyBuilder: (input) => ({
            teamRefId: input.team_ref_id,
            dateStart: input.date_start,
            dateEnd: input.date_end,
          }),
          responseExtractor: passthrough,
          description: "Get AI coding assistant adoption metrics",
        },
      },
    },
    {
      resourceType: "sei_ai_adoption_breakdown",
      displayName: "SEI AI Adoption Breakdown",
      description: "AI coding assistant adoption breakdown by dimension. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        list: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/adoptions/breakdown`,
          bodyBuilder: (input) => ({
            teamRefId: input.team_ref_id,
            dateStart: input.date_start,
            dateEnd: input.date_end,
          }),
          responseExtractor: passthrough,
          description: "Get AI coding assistant adoption breakdown",
        },
      },
    },
    {
      resourceType: "sei_ai_impact",
      displayName: "SEI AI Impact",
      description: "AI coding assistant impact on PR velocity and rework. Supports get.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
        { name: "metric_type", description: "Metric type filter" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        get: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/pr-velocity/summary`,
          bodyBuilder: (input) => ({
            teamRefId: input.team_ref_id,
            dateStart: input.date_start,
            dateEnd: input.date_end,
          }),
          responseExtractor: passthrough,
          description: "Get AI coding assistant impact on PR velocity",
        },
      },
    },
    {
      resourceType: "sei_ai_raw_metric",
      displayName: "SEI AI Raw Metric",
      description: "Raw AI coding assistant metrics. Supports list.",
      toolset: "sei",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        { name: "team_ref_id", description: "Team reference identifier" },
        { name: "date_start", description: "Start date for metric calculation" },
        { name: "date_end", description: "End date for metric calculation" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/module/sei/insights/ai-coding",
      operations: {
        list: {
          method: "POST",
          path: `${SEI}/v2/insights/coding-assistant/raw_metrics`,
          bodyBuilder: (input) => ({
            teamRefId: input.team_ref_id,
            dateStart: input.date_start,
            dateEnd: input.date_end,
          }),
          responseExtractor: passthrough,
          description: "Get raw AI coding assistant metrics",
        },
      },
    },
  ],
};
