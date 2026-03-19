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
      listFilterFields: [
        { name: "search_term", description: "Filter connectors by name or keyword" },
        { name: "type", description: "Connector type filter", enum: ["K8sCluster", "Git", "Splunk", "AppDynamics", "Prometheus", "Dynatrace", "Vault", "AzureKeyVault", "DockerRegistry", "Local", "AwsKms", "GcpKms", "AwsSecretManager", "Gcp", "Aws", "Azure", "Artifactory", "Jira", "Nexus", "Github", "Gitlab", "Bitbucket", "Codecommit", "CEAws", "CEAzure", "GcpCloudCost", "CEK8sCluster", "HttpHelmRepo", "NewRelic", "Datadog", "SumoLogic", "PagerDuty", "CustomHealth", "ServiceNow", "ErrorTracking", "Pdc", "AzureRepo", "Jenkins", "OciHelmRepo", "CustomSecretManager", "ElasticSearch", "GcpSecretManager", "AzureArtifacts", "Tas", "Spot", "Bamboo", "TerraformCloud", "SignalFX", "Harness", "Rancher", "JDBC"] },
        { name: "category", description: "Connector category filter", enum: ["CLOUD_PROVIDER", "SECRET_MANAGER", "CLOUD_COST", "ARTIFACTORY", "CODE_REPO", "MONITORING", "TICKETING", "DATABASE", "COMMUNICATION", "DOCUMENTATION", "ML_OPS"] },
        { name: "connector_names", description: "Filter by connector names (comma-separated)" },
        { name: "connector_identifiers", description: "Filter by connector identifiers (comma-separated)" },
        { name: "connectivity_statuses", description: "Filter by connectivity status", enum: ["SUCCESS", "FAILURE", "PARTIAL", "UNKNOWN"] },
        { name: "connector_connectivity_modes", description: "Filter by connectivity mode", enum: ["DELEGATE", "MANAGER"] },
        { name: "description", description: "Filter by connector description" },
        { name: "inheriting_credentials_from_delegate", description: "Filter connectors inheriting credentials from delegate", type: "boolean" },
        { name: "tags", description: "Filter by tags as key:value pairs (JSON object)" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/connectors/{connectorIdentifier}",
      operations: {
        list: {
          method: "POST",
          path: "/ng/api/connectors/listV2",
          queryParams: {
            search_term: "searchTerm",
            page: "pageIndex",
            size: "pageSize",
          },
          bodyBuilder: (input) => {
            const csv = (v: unknown): string[] | undefined => {
              if (!v) return undefined;
              return String(v).split(",").map((s) => s.trim()).filter(Boolean);
            };
            return {
              filterType: "Connector",
              types: csv(input.type ?? input.types),
              categories: csv(input.category ?? input.categories),
              connectorNames: csv(input.connector_names),
              connectorIdentifiers: csv(input.connector_identifiers),
              connectivityStatuses: csv(input.connectivity_statuses),
              connectorConnectivityModes: csv(input.connector_connectivity_modes),
              description: input.description || undefined,
              inheritingCredentialsFromDelegate: input.inheriting_credentials_from_delegate,
              tags: input.tags,
            };
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
          bodyBuilder: buildBodyNormalized({ wrapKey: "connector" }),
          bodyWrapperKey: "connector",
          responseExtractor: ngExtract,
          description: "Create a new connector",
          bodySchema: connectorCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/ng/api/connectors",
          bodyBuilder: buildBodyNormalized({
            wrapKey: "connector",
            injectFields: [{ from: "type", to: "connectionType", onlyIfMissing: true }],
          }),
          bodyWrapperKey: "connector",
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
          bodySchema: { description: "No body required. Connector is identified by path parameter.", fields: [] },
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
