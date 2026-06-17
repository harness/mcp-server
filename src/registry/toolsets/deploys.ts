import type { ToolsetDefinition } from "../types.js";
import { offsetListExtract, passthrough } from "../extractors.js";

/**
 * Same custom scope naming as the incidents API (both route through
 * /api/v1/mc/ behind the @HarnessAuth filter): accountId / orgId / projectId
 * rather than the standard NG accountIdentifier / orgIdentifier /
 * projectIdentifier. The client still appends its default `accountIdentifier`
 * query param; the Java side ignores unknown params.
 */
const DEPLOY_SCOPE = { account: "accountId", org: "orgId", project: "projectId" } as const;

/**
 * Compact a deploy list item. The deploy API returns an always-empty `title`,
 * an always-null `status`, and a multi-KB `summary` changelog — the generic
 * key whitelist would keep the first two (useless) and drop the genuinely
 * identifying fields (`id`, `buildVersions`, `deployTimestamp`). This keeps the
 * identity an agent actually needs while dropping the noise:
 *   - `summary` truncated to its first line (the "### Change Log for X" header)
 *   - `services` derived from buildVersions (service + version only)
 * Full summary/buildVersions remain available via compact:false or harness_get.
 */
function compactDeploy(item: Record<string, unknown>): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  if (typeof item.id === "string") slim.id = item.id;
  if (typeof item.projectId === "string") slim.projectId = item.projectId;
  if (typeof item.summary === "string" && item.summary.length > 0) {
    slim.summary = item.summary.split("\n", 1)[0];
  }
  if (Array.isArray(item.environments)) slim.environments = item.environments;
  if (Array.isArray(item.buildVersions)) {
    slim.services = item.buildVersions.map((bv) => {
      const b = (bv ?? {}) as Record<string, unknown>;
      return { service: b.service, version: b.version };
    });
  }
  if (item.deployTimestamp !== undefined) slim.deployTimestamp = item.deployTimestamp;
  if (typeof item.webLink === "string") slim.webLink = item.webLink;
  return slim;
}

export const deploysToolset: ToolsetDefinition = {
  name: "deploys",
  displayName: "Deploys",
  description: "Harness deployment history — list and inspect service deploys",
  resources: [
    {
      resourceType: "deploy",
      displayName: "Deploy",
      description: "Deployment activity for a project's services. Read-only: list and get.",
      toolset: "deploys",
      scope: "project",
      scopeParams: DEPLOY_SCOPE,
      identifierFields: ["deploy_id"],
      compactItem: compactDeploy,
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
          responseExtractor: passthrough,
          description: "Get deploy details by ID (e.g. DEPL-24)",
        },
      },
    },
  ],
};
