import type { ToolsetDefinition, BodySchema } from "../types.js";
import { passthrough } from "../extractors.js";

const featureFlagCreateSchema: BodySchema = {
  description: "Feature flag definition",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Flag key/identifier (unique within project)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "kind", type: "string", required: true, description: "Flag kind: boolean or multivariate" },
    { name: "permanent", type: "boolean", required: false, description: "Whether the flag is permanent (won't be cleaned up)" },
    { name: "description", type: "string", required: false, description: "Optional description" },
  ],
};

const featureFlagToggleSchema: BodySchema = {
  description: "Toggle instructions (built automatically from enable field)",
  fields: [
    { name: "enable", type: "boolean", required: true, description: "true to turn on, false to turn off" },
    { name: "environment", type: "string", required: true, description: "Target environment identifier" },
  ],
};

export const featureFlagsToolset: ToolsetDefinition = {
  name: "feature-flags",
  displayName: "Feature Management & Experimentation",
  description: "Harness FME — feature flags, workspaces, and environments",
  resources: [
    {
      resourceType: "fme_workspace",
      displayName: "FME Workspace",
      description: "Feature Management workspace. Supports list.",
      toolset: "feature-flags",
      scope: "project",
      identifierFields: ["workspace_id"],
      operations: {
        list: {
          method: "GET",
          path: "/cf/admin/workspaces",
          responseExtractor: passthrough,
          description: "List FME workspaces",
        },
      },
    },
    {
      resourceType: "fme_environment",
      displayName: "FME Environment",
      description: "Feature Management environment. Supports list.",
      toolset: "feature-flags",
      scope: "project",
      identifierFields: ["environment_id"],
      operations: {
        list: {
          method: "GET",
          path: "/cf/admin/environments",
          responseExtractor: passthrough,
          description: "List FME environments",
        },
      },
    },
    {
      resourceType: "fme_feature_flag",
      displayName: "FME Feature Flag",
      description:
        "Feature flag basic metadata (name, description, traffic type, tags, rollout status) via the Split.io API. Does not require an environment — use feature_flag get for environment-specific definitions.",
      toolset: "feature-flags",
      scope: "account",
      identifierFields: ["workspace_id", "feature_flag_name"],
      operations: {
        get: {
          method: "GET",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}",
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          responseExtractor: passthrough,
          description: "Get a specific feature flag's metadata without requiring an environment",
        },
      },
    },
    {
      resourceType: "feature_flag",
      displayName: "Feature Flag",
      description:
        "Feature flag. Supports list, get, create, delete, and toggle action.",
      toolset: "feature-flags",
      scope: "project",
      identifierFields: ["flag_id"],
      listFilterFields: ["name", "environment"],
      deepLinkTemplate: "/ng/account/{accountId}/cf/orgs/{orgIdentifier}/projects/{projectIdentifier}/feature-flags/{flagIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/cf/admin/features",
          queryParams: {
            name: "name",
            environment: "environment",
            page: "pageNumber",
            size: "pageSize",
          },
          responseExtractor: passthrough,
          description: "List feature flags",
        },
        get: {
          method: "GET",
          path: "/cf/admin/features/{flagIdentifier}",
          pathParams: { flag_id: "flagIdentifier" },
          queryParams: { environment: "environment" },
          responseExtractor: passthrough,
          description: "Get feature flag details",
        },
        create: {
          method: "POST",
          path: "/cf/admin/features",
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a new feature flag",
          bodySchema: featureFlagCreateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/cf/admin/features/{flagIdentifier}",
          pathParams: { flag_id: "flagIdentifier" },
          responseExtractor: passthrough,
          description: "Delete a feature flag",
        },
      },
      executeActions: {
        toggle: {
          method: "PATCH",
          path: "/cf/admin/features/{flagIdentifier}",
          pathParams: { flag_id: "flagIdentifier" },
          queryParams: { environment: "environment" },
          bodyBuilder: (input) => {
            if (input.enable === undefined || input.enable === null) {
              throw new Error("'enable' field is required for toggle action — set to true (on) or false (off)");
            }
            return {
              instructions: [
                { kind: input.enable ? "turnFlagOn" : "turnFlagOff" },
              ],
            };
          },
          responseExtractor: passthrough,
          actionDescription:
            "Toggle a feature flag on/off. Set 'enable' to true/false and specify 'environment'.",
          bodySchema: featureFlagToggleSchema,
        },
      },
    },
  ],
};
