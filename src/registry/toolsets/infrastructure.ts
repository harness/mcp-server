import type { ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract } from "../extractors.js";

export const infrastructureToolset: ToolsetDefinition = {
  name: "infrastructure",
  displayName: "Infrastructure",
  description: "Infrastructure definitions for deployment targets",
  resources: [
    {
      resourceType: "infrastructure",
      displayName: "Infrastructure Definition",
      description: "Infrastructure definition within an environment. Supports full CRUD.",
      toolset: "infrastructure",
      scope: "project",
      identifierFields: ["infrastructure_id"],
      listFilterFields: ["environment_id", "search_term"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/environments",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/infrastructures",
          queryParams: {
            environment_id: "environmentIdentifier",
            search_term: "searchTerm",
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List infrastructure definitions",
        },
        get: {
          method: "GET",
          path: "/ng/api/infrastructures/{infraIdentifier}",
          pathParams: { infrastructure_id: "infraIdentifier" },
          queryParams: { environment_id: "environmentIdentifier" },
          responseExtractor: ngExtract,
          description: "Get infrastructure definition details",
        },
        create: {
          method: "POST",
          path: "/ng/api/infrastructures",
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Infrastructure definition",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Unique identifier" },
              { name: "name", type: "string", required: true, description: "Display name" },
              { name: "type", type: "string", required: true, description: "Infrastructure type (e.g. KubernetesDirect, KubernetesGcp)" },
              { name: "environmentRef", type: "string", required: true, description: "Environment reference identifier" },
              { name: "deploymentType", type: "string", required: false, description: "Deployment type (e.g. Kubernetes)" },
              { name: "yaml", type: "yaml", required: false, description: "Full infrastructure YAML definition" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Create infrastructure definition",
        },
        update: {
          method: "PUT",
          path: "/ng/api/infrastructures",
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Infrastructure definition update",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Infrastructure identifier" },
              { name: "name", type: "string", required: true, description: "Display name" },
              { name: "type", type: "string", required: true, description: "Infrastructure type" },
              { name: "environmentRef", type: "string", required: true, description: "Environment reference identifier" },
              { name: "yaml", type: "yaml", required: false, description: "Full infrastructure YAML definition" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Update infrastructure definition",
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/infrastructures/{infraIdentifier}",
          pathParams: { infrastructure_id: "infraIdentifier" },
          queryParams: { environment_id: "environmentIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete infrastructure definition",
        },
      },
      executeActions: {
        move_configs: {
          method: "POST",
          path: "/ng/api/infrastructures/move-config/{infraIdentifier}",
          pathParams: { infrastructure_id: "infraIdentifier" },
          queryParams: { environment_id: "environmentIdentifier" },
          bodyBuilder: (input) => input.body,
          bodySchema: {
            description: "Move configuration request",
            fields: [
              { name: "connectorRef", type: "string", required: false, description: "Connector reference for remote storage" },
              { name: "repoName", type: "string", required: false, description: "Repository name" },
              { name: "branch", type: "string", required: false, description: "Branch name" },
              { name: "filePath", type: "string", required: false, description: "File path in the repository" },
              { name: "moveConfigOperationType", type: "string", required: false, description: "Operation type: INLINE_TO_REMOTE or REMOTE_TO_INLINE" },
            ],
          },
          responseExtractor: ngExtract,
          actionDescription: "Move infrastructure configuration (e.g., move inline config to remote or vice versa)",
        },
      },
    },
  ],
};
