import type { ToolsetDefinition, BodySchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { ngExtract, pageExtract } from "../extractors.js";

const connectorCreateSchema: BodySchema = {
  description: "Connector definition",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Unique identifier (lowercase, hyphens, underscores)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "type", type: "string", required: true, description: "Connector type (e.g. Github, DockerRegistry, K8sCluster, Aws, Gcp)" },
    { name: "spec", type: "object", required: true, description: "Type-specific configuration (varies by connector type)" },
    { name: "description", type: "string", required: false, description: "Optional description" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
  ],
};

const connectorUpdateSchema: BodySchema = {
  description: "Connector update definition",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Connector identifier" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "type", type: "string", required: true, description: "Connector type" },
    { name: "spec", type: "object", required: true, description: "Type-specific configuration" },
    { name: "description", type: "string", required: false, description: "Updated description" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
  ],
};

export const connectorsToolset: ToolsetDefinition = {
  name: "connectors",
  displayName: "Connectors",
  description: "Integration connectors (GitHub, Docker, AWS, GCP, etc.)",
  resources: [
    {
      resourceType: "connector",
      displayName: "Connector",
      description: "External integration connector. Supports full CRUD and test_connection.",
      toolset: "connectors",
      scope: "project",
      identifierFields: ["connector_id"],
      diagnosticHint: "Use harness_diagnose with resource_id set to the connector identifier to run a live connectivity test and get auth method, status history, and error details.",
      listFilterFields: ["search_term", "type", "category"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/connectors/{connectorIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/connectors",
          queryParams: {
            search_term: "searchTerm",
            type: "type",
            category: "category",
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List connectors",
        },
        get: {
          method: "GET",
          path: "/ng/api/connectors/{connectorIdentifier}",
          pathParams: { connector_id: "connectorIdentifier" },
          responseExtractor: ngExtract,
          description: "Get connector details",
        },
        create: {
          method: "POST",
          path: "/ng/api/connectors",
          bodyBuilder: buildBodyNormalized({ unwrapKey: "connector" }),
          responseExtractor: ngExtract,
          description: "Create a new connector",
          bodySchema: connectorCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/ng/api/connectors",
          bodyBuilder: buildBodyNormalized({
            unwrapKey: "connector",
            injectFields: [{ from: "type", to: "connectionType", onlyIfMissing: true }],
          }),
          responseExtractor: ngExtract,
          description: "Update a connector",
          bodySchema: connectorUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/connectors/{connectorIdentifier}",
          pathParams: { connector_id: "connectorIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a connector",
        },
      },
      executeActions: {
        test_connection: {
          method: "POST",
          path: "/ng/api/connectors/testConnection/{connectorIdentifier}",
          pathParams: { connector_id: "connectorIdentifier" },
          bodyBuilder: () => ({}),
          responseExtractor: ngExtract,
          actionDescription: "Test connectivity of a connector",
        },
      },
    },
    {
      resourceType: "connector_catalogue",
      displayName: "Connector Catalogue",
      description: "Catalogue of available connector types. Supports list only.",
      toolset: "connectors",
      scope: "account",
      identifierFields: [],
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/connectors/catalogue",
          responseExtractor: ngExtract,
          description: "List all available connector types in the catalogue",
        },
      },
    },
  ],
};
