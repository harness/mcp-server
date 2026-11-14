import type { ToolsetDefinition } from "../types.js";
import { deployGetExtract, offsetListExtract } from "../extractors.js";
import { MC_SCOPE } from "./scopes.js";
import { projectRelatedActivity } from "./related-activities.js";
import { isRecord } from "../../utils/type-guards.js";

/**
 * Compact a deploy list item. The deploy API returns an always-empty `title`
 * and a multi-KB `summary` changelog — the generic key whitelist would keep the
 * empty title (useless) and drop the genuinely identifying fields (`id`,
 * `buildVersions`, `deployTimestamp`). This keeps the identity an agent
 * actually needs while dropping the noise:
 *   - `summary` truncated to its first line (the "### Change Log for X" header)
 *   - `services` derived from buildVersions (service + version only)
 *   - related activities projected the same way as in the detail view
 * `status` is kept when the API supplies one: correlating a deploy to an
 * incident hinges on whether it succeeded, so it must survive compaction.
 * Full summary/buildVersions remain available via compact:false or harness_get.
 */
function compactDeploy(item: Record<string, unknown>): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  if (typeof item.id === "string") slim.id = item.id;
  if (typeof item.projectId === "string") slim.projectId = item.projectId;
  if (typeof item.summary === "string" && item.summary.length > 0) {
    slim.summary = item.summary.split("\n", 1)[0];
  }
  if (item.status !== null && item.status !== undefined) slim.status = item.status;
  if (Array.isArray(item.environments)) slim.environments = item.environments;
  if (Array.isArray(item.buildVersions)) {
    slim.services = item.buildVersions.map((bv) => {
      if (!isRecord(bv)) return bv;
      return { service: bv.service, version: bv.version };
    });
  }
  if (typeof item.deployTimestamp === "number") slim.deployTimestamp = item.deployTimestamp;
  if (typeof item.webLink === "string") slim.webLink = item.webLink;
  if (Array.isArray(item.relatedActivities) && item.relatedActivities.length > 0) {
    slim.relatedActivities = item.relatedActivities.map(projectRelatedActivity);
  }
  return slim;
}

export const deploysToolset: ToolsetDefinition = {
  name: "deploys",
  displayName: "AI-SRE Deploys",
  description: "Harness AI-SRE deployment history — list and inspect service deploys",
  resources: [
    {
      resourceType: "deploy",
      displayName: "Deploy",
      description: "AI-SRE deployment activity for a project's services. Read-only: list and get. "
        + "This entity carries current state only — the deploy's history is a separate resource: "
        + "harness_list(resource_type='activity_timeline', filters={activity_id: <deploy id>}).",
      toolset: "deploys",
      scope: "project",
      scopeParams: MC_SCOPE,
      identifierFields: ["deploy_id"],
      compactItem: compactDeploy,
      relatedResources: [
        {
          resourceType: "activity_timeline",
          relationship: "child",
          description: "Chronological event stream for this deploy; list it with filters.activity_id = the deploy id",
        },
      ],
      listFilterFields: [
        { name: "service", description: "Filter by service name (multi-value, OR-combined)" },
        { name: "environment", description: "Filter by environment label (multi-value, OR-combined)" },
        { name: "deployed_after", description: "Only deploys at or after this time (ISO-8601, e.g. 2026-05-01T00:00:00Z)" },
        { name: "deployed_before", description: "Only deploys at or before this time (ISO-8601)" },
        { name: "sort_direction", description: "Sort direction on deploy time", enum: ["ASC", "DESC"] },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/gateway/ir/tp/api/v1/mc/deploys",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            service: "service",
            environment: "environment",
            deployed_after: "deployedAfter",
            deployed_before: "deployedBefore",
            sort_direction: "sortDirection",
            page: "page",
            size: "pageSize",
          },
          responseExtractor: offsetListExtract,
          description: "List deploys with filtering by service, environment, and deploy time range",
        },
        get: {
          method: "GET",
          path: "/gateway/ir/tp/api/v1/mc/deploys/{deployId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { deploy_id: "deployId" },
          responseExtractor: deployGetExtract,
          description: "Get deploy details by ID (e.g. DEPLU65-8065, format: DEPL<env>-<number>)",
        },
      },
    },
  ],
};
