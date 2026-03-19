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
      listFilterFields: [
        { name: "search_term", description: "Filter environments by name or keyword" },
        { name: "env_type", description: "Environment type filter", enum: ["Production", "PreProduction"] },
        { name: "sort", description: "Field to sort by (e.g. name, identifier)" },
        { name: "order", description: "Sort order", enum: ["asc", "desc"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/environments/{environmentIdentifier}/details",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/environmentsV2",
          queryParams: {
            search_term: "searchTerm",
            env_type: "envType",
            sort: "sort",
            order: "order",
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
          queryParams: {
            connector_ref: "connectorRef",
            repo_name: "repoName",
            branch: "branch",
            file_path: "filePath",
            commit_msg: "commitMsg",
            is_new_branch: "isNewBranch",
            base_branch: "baseBranch",
            is_harness_code_repo: "isHarnessCodeRepo",
            move_config_type: "moveConfigType",
          },
          bodyBuilder: () => ({}),
          responseExtractor: ngExtract,
          actionDescription: "Move environment configuration (e.g., move inline config to remote or vice versa)",
          bodySchema: {
            description: "Move configuration request. All parameters are passed as query params.",
            fields: [
              { name: "connector_ref", type: "string", required: false, description: "Connector reference for remote storage" },
              { name: "repo_name", type: "string", required: false, description: "Repository name" },
              { name: "branch", type: "string", required: false, description: "Branch name" },
              { name: "file_path", type: "string", required: false, description: "File path in the repository" },
              { name: "commit_msg", type: "string", required: false, description: "Commit message" },
              { name: "is_new_branch", type: "boolean", required: false, description: "Whether to create a new branch" },
              { name: "base_branch", type: "string", required: false, description: "Base branch if creating a new branch" },
              { name: "is_harness_code_repo", type: "boolean", required: false, description: "Whether the repo is a Harness Code repo" },
              { name: "move_config_type", type: "string", required: true, description: "INLINE_TO_REMOTE (REMOTE_TO_INLINE not supported for environments)" },
            ],
          },
        },
      },
    },
  ],
};
