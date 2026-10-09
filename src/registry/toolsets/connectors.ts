import type { ToolsetDefinition, BodySchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { ngExtract, pageExtract } from "../extractors.js";

const connectorCreateSchema: BodySchema = {
  description: "Connector definition",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Unique identifier (lowercase, hyphens, underscores)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "type", type: "string", required: true, description: "Connector type (e.g. Mcp, Github, DockerRegistry, K8sCluster, Aws, Gcp)" },
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

const llmModelDiscoverySchema: BodySchema = {
  description: "LLM model discovery request. Use secret references (e.g. account.my_secret) — never raw API keys.",
  fields: [
    { name: "provider", type: "string", required: true, description: "ANTHROPIC | OPENAI | GITHUB_COPILOT | HARNESS_OPENAI | HARNESS_ANTHROPIC" },
    { name: "authentication", type: "object", required: false, description: "{type, spec}. Token: {type:'Token',spec:{tokenRef:'account.secret_id'}}. Anthropic also supports BedrockApiKey, Vertex, CloudProvider; OpenAI supports Vertex." },
    { name: "url", type: "string", required: false, description: "Optional custom base URL" },
    { name: "region", type: "string", required: false, description: "Optional region" },
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
      description: "External integration connector. Supports full CRUD and test_connection. Default list/get/execute scope is project — pass org_id and project_id (or a project URL) on the first call. Use resource_scope='account' only when the user asked for account-level connectors.",
      toolset: "connectors",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["connector_id"],
      diagnosticHint: "Use harness_diagnose with resource_id set to the connector identifier to run a live connectivity test and get auth method, status history, and error details.",
      listFilterFields: [
        { name: "search_term", description: "Filter connectors by name or keyword" },
        { name: "type", description: "Connector type filter", enum: ["K8sCluster", "Git", "Splunk", "AppDynamics", "Prometheus", "Dynatrace", "Vault", "AzureKeyVault", "DockerRegistry", "Local", "AwsKms", "GcpKms", "AwsSecretManager", "Gcp", "Aws", "Azure", "Artifactory", "Jira", "Nexus", "Github", "Gitlab", "Bitbucket", "Codecommit", "CEAws", "CEAzure", "GcpCloudCost", "CEK8sCluster", "HttpHelmRepo", "NewRelic", "Datadog", "SumoLogic", "PagerDuty", "CustomHealth", "ServiceNow", "ErrorTracking", "Pdc", "AzureRepo", "Jenkins", "OciHelmRepo", "CustomSecretManager", "ElasticSearch", "GcpSecretManager", "AzureArtifacts", "Tas", "Spot", "Bamboo", "TerraformCloud", "SignalFX", "Harness", "Rancher", "JDBC", "Mcp"] },
        { name: "category", description: "Connector category filter", enum: ["CLOUD_PROVIDER", "SECRET_MANAGER", "CLOUD_COST", "ARTIFACTORY", "CODE_REPO", "MONITORING", "TICKETING", "DATABASE", "COMMUNICATION", "DOCUMENTATION", "ML_OPS", "MCP"] },
        { name: "connector_names", description: "Filter by connector names (comma-separated)" },
        { name: "connector_identifiers", description: "Filter by connector identifiers (comma-separated)" },
        { name: "connectivity_statuses", description: "Filter by connectivity status", enum: ["SUCCESS", "FAILURE", "PARTIAL", "UNKNOWN"] },
        { name: "connector_connectivity_modes", description: "Filter by connectivity mode", enum: ["DELEGATE", "MANAGER"] },
        { name: "description", description: "Filter by connector description" },
        { name: "inheriting_credentials_from_delegate", description: "Filter connectors inheriting credentials from delegate", type: "boolean" },
        { name: "tags", description: "Filter by tags as key:value pairs (JSON object)" },
        { name: "include_all_connectors_available_at_scope", type: "boolean", description: "When true, also return connectors inherited from parent scopes (org/account). Default: false. Set to true when picking an APM/observability connector for chaos_probe apmProbe." },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/connectors/{connectorIdentifier}",
      operations: {
        list: {
          method: "POST",
          path: "/ng/api/connectors/listV2",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            page: "pageIndex",
            size: "pageSize",
            include_all_connectors_available_at_scope: "includeAllConnectorsAvailableAtScope",
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { connector_id: "connectorIdentifier" },
          responseExtractor: ngExtract,
          description: "Get connector details",
        },
        create: {
          method: "POST",
          path: "/ng/api/connectors",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: buildBodyNormalized({ wrapKey: "connector" }),
          bodyWrapperKey: "connector",
          responseExtractor: ngExtract,
          description: "Create a new connector",
          bodySchema: connectorCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/ng/api/connectors",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: buildBodyNormalized({
            wrapKey: "connector",
            injectIdentifier: { inputField: "connector_id", bodyField: "identifier" },
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
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { connector_id: "connectorIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a connector",
        },
      },
      executeActions: {
        test_connection: {
          method: "POST",
          path: "/ng/api/connectors/testConnection/{connectorIdentifier}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { connector_id: "connectorIdentifier" },
          bodyBuilder: () => ({}),
          responseExtractor: ngExtract,
          actionDescription: "Test connectivity of a connector",
          bodySchema: { description: "No body required. Connector is identified by path parameter.", fields: [] },
        },
      },
    },
    {
      resourceType: "llm_model",
      displayName: "LLM Model",
      description:
        "Discover provider model targets (e.g. Claude, GPT models) available for draft LLM connector authentication details. " +
        "Supports list only; backed by POST /ng/api/llm-connector/models. Nothing is created or stored. " +
        "Pass the discovery request through harness_list params: provider (ANTHROPIC | OPENAI | GITHUB_COPILOT | HARNESS_OPENAI | HARNESS_ANTHROPIC), " +
        "authentication ({type, spec}), and optional url / region. " +
        "SECRETS: authentication must reference Harness secrets (e.g. spec.tokenRef='account.my_secret'); NEVER paste raw API keys. " +
        "Authentication shapes — ANTHROPIC: {type:'Token',spec:{tokenRef}} | {type:'BedrockApiKey',...} | {type:'Vertex',...} | {type:'CloudProvider',...}; " +
        "OPENAI: {type:'Token',spec:{tokenRef}} | {type:'Vertex',...}; GITHUB_COPILOT: {type:'Token',spec:{tokenRef}}. " +
        "Default scope is account; pass org_id / project_id only to resolve secrets at that scope. " +
        "Returns a list of {value, displayName}.",
      toolset: "connectors",
      scope: "account",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      identifierFields: [],
      compactItem: (item) => ({ value: item.value, displayName: item.displayName }),
      listFilterFields: [
        { name: "provider", description: "LLM provider (required)", required: true, enum: ["ANTHROPIC", "OPENAI", "GITHUB_COPILOT", "HARNESS_OPENAI", "HARNESS_ANTHROPIC"] },
        { name: "authentication", description: "Provider authentication object {type, spec}. Use secret references only (e.g. spec.tokenRef='account.my_secret'), never raw keys." },
        { name: "url", description: "Optional custom provider base URL" },
        { name: "region", description: "Optional provider region (e.g. for Bedrock/Vertex)" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/ng/api/llm-connector/models",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              provider: input.provider ?? body.provider,
              authentication: input.authentication ?? body.authentication,
              url: input.url ?? body.url,
              region: input.region ?? body.region,
            };
          },
          bodySchema: llmModelDiscoverySchema,
          responseExtractor: ngExtract,
          description: "Discover LLM models for a provider using draft authentication (secret refs only). Returns [{value, displayName}].",
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: ngExtract,
          description: "List all available connector types in the catalogue",
        },
      },
    },
  ],
};
