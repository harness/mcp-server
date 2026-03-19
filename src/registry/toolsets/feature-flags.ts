import type { ToolsetDefinition, BodySchema } from "../types.js";
import { passthrough } from "../extractors.js";

/**
 * FME response extractor that flattens `trafficType.id` → `trafficTypeId`
 * at the top level so deep link templates can reference it.
 */
function flattenTrafficType(item: Record<string, unknown>): void {
  const tt = item.trafficType;
  if (tt && typeof tt === "object" && !Array.isArray(tt)) {
    const ttRecord = tt as Record<string, unknown>;
    if (ttRecord.id !== undefined && item.trafficTypeId === undefined) {
      item.trafficTypeId = ttRecord.id;
    }
  }
}

/** Extract FME feature flag list — passthrough with trafficType.id flattened on each item. */
const fmeListExtract = (raw: unknown): unknown => {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const objects = r.objects;
    if (Array.isArray(objects)) {
      for (const item of objects) {
        if (item && typeof item === "object") {
          flattenTrafficType(item as Record<string, unknown>);
        }
      }
    }
  }
  return raw;
};

/** Extract FME feature flag single item — passthrough with trafficType.id flattened. */
const fmeGetExtract = (raw: unknown): unknown => {
  if (raw && typeof raw === "object") {
    flattenTrafficType(raw as Record<string, unknown>);
  }
  return raw;
};

const fmeFeatureFlagUpdateSchema: BodySchema = {
  description: "Partial update for an FME feature flag's metadata",
  fields: [
    { name: "description", type: "string", required: false, description: "Updated description" },
    { name: "tags", type: "array", required: false, description: "Updated tags list", itemType: "string" },
    { name: "rolloutStatus", type: "object", required: false, description: "Rollout status to assign (use fme_rollout_status to discover valid values)" },
  ],
};

export const featureFlagsToolset: ToolsetDefinition = {
  name: "feature-flags",
  displayName: "Feature Management & Experimentation",
  description: "Harness FME — feature flags, workspaces, environments, and rollout statuses via the Split.io API",
  resources: [
    // ── FME Resources (Split.io API at https://api.split.io) ───────────
    // These use account scope to avoid injecting orgIdentifier/projectIdentifier
    // which Split.io does not use. Auth is via x-api-key header only.
    {
      resourceType: "fme_workspace",
      displayName: "FME Workspace",
      description: "Feature Management workspace. Supports list with pagination (offset/size, default 20, max 1000).",
      toolset: "feature-flags",
      scope: "account",
      identifierFields: ["workspace_id"],
      product: "fme",
      listFilterFields: [
        { name: "offset", description: "Pagination offset for feature flag workspaces", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/workspaces",
          queryParams: {
            offset: "offset",
            size: "limit",
          },
          responseExtractor: passthrough,
          description: "List FME workspaces with pagination (offset and size params, max 1000)",
        },
      },
    },
    {
      resourceType: "fme_environment",
      displayName: "FME Environment",
      description: "Feature Management environment. Supports list. Requires a workspace_id.",
      toolset: "feature-flags",
      scope: "account",
      identifierFields: ["workspace_id", "environment_id"],
      product: "fme",
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/environments/ws/{wsId}",
          pathParams: { workspace_id: "wsId" },
          responseExtractor: passthrough,
          description: "List FME environments for a workspace",
        },
      },
    },
    {
      resourceType: "fme_feature_flag",
      displayName: "FME Feature Flag",
      description:
        "Feature flag via the Split.io API. List flags by workspace with filtering (status, name, tags, rollout_status_id) and pagination (offset/size, default 20, max 50). Supports get, delete, update, and kill/restore execute actions.",
      toolset: "feature-flags",
      scope: "account",
      identifierFields: ["workspace_id", "feature_flag_name"],
      product: "fme",
      deepLinkTemplate: "/ng/account/{accountId}/module/fme/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/resources/targets/{trafficTypeId}/splits/{id}",
      listFilterFields: [
        { name: "offset", description: "Pagination offset for FME feature flags", type: "number" },
        {
          name: "status",
          description:
            "Filter by Split lifecycle status on each flag (`ACTIVE`, `ARCHIVED`, etc.). The list API does not support this as a query parameter; the MCP server paginates through all flags and returns only matches.",
          type: "string",
          enum: ["ACTIVE", "ARCHIVED"],
        },
        { name: "rollout_status_id", description: "Filter by rollout status UUID (use fme_rollout_status to discover valid IDs)", type: "string" },
        { name: "name", description: "Filter flags by name (partial match)", type: "string" },
        { name: "tags", description: "Filter flags by tag", type: "string" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/splits/ws/{wsId}",
          pathParams: { workspace_id: "wsId" },
          queryParams: {
            offset: "offset",
            size: "limit",
            // `status` is not a documented Split list query param; Registry applies it client-side after paging.
            rollout_status_id: "rolloutStatus",
            name: "name",
            tags: "tag",
          },
          responseExtractor: fmeListExtract,
          description:
            "List feature flags for a workspace with filtering and pagination (offset and size params, max 50). Pass filters.status=ARCHIVED (or ACTIVE) to return only flags with that lifecycle status (full workspace scan).",
        },
        get: {
          method: "GET",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}",
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          responseExtractor: fmeGetExtract,
          description: "Get a specific feature flag's metadata without requiring an environment",
        },
        delete: {
          method: "DELETE",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}",
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          responseExtractor: passthrough,
          description: "Delete a feature flag from a workspace",
        },
        update: {
          method: "PATCH",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}",
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a feature flag's metadata (description, tags, rolloutStatus)",
          bodySchema: fmeFeatureFlagUpdateSchema,
        },
      },
      executeActions: {
        kill: {
          method: "PUT",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}/kill",
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          responseExtractor: passthrough,
          actionDescription: "Kill (turn off) a feature flag in a specific environment. Requires workspace_id, feature_flag_name, and environment_id.",
        },
        restore: {
          method: "PUT",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}/restore",
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          responseExtractor: passthrough,
          actionDescription: "Restore (re-enable) a killed feature flag in a specific environment. Requires workspace_id, feature_flag_name, and environment_id.",
        },
      },
    },
    {
      resourceType: "fme_feature_flag_definition",
      displayName: "FME Feature Flag Definition",
      description:
        "Detailed definition of a feature flag in a specific environment, including treatments, rules, targeting, and traffic allocation.",
      toolset: "feature-flags",
      scope: "account",
      identifierFields: ["workspace_id", "feature_flag_name", "environment_id"],
      product: "fme",
      operations: {
        get: {
          method: "GET",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}",
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          responseExtractor: passthrough,
          description: "Get feature flag definition in a specific environment (treatments, rules, default rule, traffic allocation)",
        },
      },
    },
    {
      resourceType: "fme_rollout_status",
      displayName: "FME Rollout Status",
      description:
        "Rollout status definitions for a workspace (e.g. Killed, Permanent, Ramping). Use to discover valid rollout_status_id UUIDs for filtering fme_feature_flag lists.",
      toolset: "feature-flags",
      scope: "account",
      identifierFields: ["workspace_id"],
      product: "fme",
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/rolloutStatuses/ws/{wsId}",
          pathParams: { workspace_id: "wsId" },
          responseExtractor: passthrough,
          description: "List rollout status definitions for a workspace (Killed, Permanent, Ramping, etc.)",
        },
      },
    },
  ],
};
