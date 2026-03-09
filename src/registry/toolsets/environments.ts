import type { ToolsetDefinition, BodySchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { ngExtract, pageExtract } from "../extractors.js";

const environmentCreateSchema: BodySchema = {
  description: "Environment definition",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Unique identifier (lowercase, hyphens, underscores)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "type", type: "string", required: true, description: "Environment type: Production or PreProduction" },
    { name: "description", type: "string", required: false, description: "Optional description" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
    { name: "yaml", type: "yaml", required: false, description: "Full environment YAML definition (for advanced config)" },
  ],
};

const environmentUpdateSchema: BodySchema = {
  description: "Environment update definition",
  fields: [
    { name: "identifier", type: "string", required: false, description: "Identifier (auto-injected from resource_id if missing)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "type", type: "string", required: true, description: "Environment type: Production or PreProduction" },
    { name: "description", type: "string", required: false, description: "Updated description" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
  ],
};

export const environmentsToolset: ToolsetDefinition = {
  name: "environments",
  displayName: "Environments",
  description: "Deployment target environments (dev, staging, prod, etc.)",
  resources: [
    {
      resourceType: "environment",
      displayName: "Environment",
      description: "Deployment target environment. Supports full CRUD.",
      toolset: "environments",
      scope: "project",
      identifierFields: ["environment_id"],
      listFilterFields: ["search_term", "env_type", "sort"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/environments/{environmentIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/environmentsV2",
          queryParams: {
            search_term: "searchTerm",
            env_type: "envType",
            sort: "sort",
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List environments in a project",
        },
        get: {
          method: "GET",
          path: "/ng/api/environmentsV2/{environmentIdentifier}",
          pathParams: { environment_id: "environmentIdentifier" },
          responseExtractor: ngExtract,
          description: "Get environment details",
        },
        create: {
          method: "POST",
          path: "/ng/api/environmentsV2",
          bodyBuilder: buildBodyNormalized({ unwrapKey: "environment" }),
          responseExtractor: ngExtract,
          description: "Create a new environment",
          bodySchema: environmentCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/ng/api/environmentsV2",
          bodyBuilder: buildBodyNormalized({
            unwrapKey: "environment",
            injectIdentifier: { inputField: "environment_id", bodyField: "identifier" },
          }),
          responseExtractor: ngExtract,
          description: "Update an existing environment",
          bodySchema: environmentUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/environmentsV2/{environmentIdentifier}",
          pathParams: { environment_id: "environmentIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete an environment",
        },
      },
      executeActions: {
        move_configs: {
          method: "POST",
          path: "/ng/api/environmentsV2/move-config/{environmentIdentifier}",
          pathParams: { environment_id: "environmentIdentifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: ngExtract,
          actionDescription: "Move environment configuration (e.g., move inline config to remote or vice versa)",
          bodySchema: {
            description: "Move configuration request",
            fields: [
              { name: "connectorRef", type: "string", required: false, description: "Connector reference for remote storage" },
              { name: "repoName", type: "string", required: false, description: "Repository name" },
              { name: "branch", type: "string", required: false, description: "Branch name" },
              { name: "filePath", type: "string", required: false, description: "File path in the repository" },
              { name: "moveConfigOperationType", type: "string", required: false, description: "INLINE_TO_REMOTE or REMOTE_TO_INLINE" },
            ],
          },
        },
      },
    },
  ],
};
