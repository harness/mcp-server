import type { ToolsetDefinition, BodySchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { ngExtract, pageExtract } from "../extractors.js";

/**
 * Body builder for service override create/update.
 * Injects org/project scope fields into the body since the ServiceOverrides V2
 * API expects them in the request body (not just query params).
 */
const overrideBodyBuilder = buildBodyNormalized({
  injectFields: [
    { from: "org_id", to: "orgIdentifier", onlyIfMissing: true },
    { from: "project_id", to: "projectIdentifier", onlyIfMissing: true },
  ],
});

const overrideCreateSchema: BodySchema = {
  description: "Service Override V2 definition. Specify overrides for variables, manifests, config files, and application settings.",
  fields: [
    { name: "environmentRef", type: "string", required: true, description: "Environment reference (e.g. 'env1' or 'account.env1')" },
    { name: "type", type: "string", required: true, description: "Override type: ENV_GLOBAL_OVERRIDE, ENV_SERVICE_OVERRIDE, INFRA_GLOBAL_OVERRIDE, INFRA_SERVICE_OVERRIDE, CLUSTER_GLOBAL_OVERRIDE, CLUSTER_SERVICE_OVERRIDE" },
    { name: "serviceRef", type: "string", required: false, description: "Service reference (required for service-specific override types)" },
    { name: "infraIdentifier", type: "string", required: false, description: "Infrastructure identifier (required for infra-scoped override types)" },
    { name: "clusterIdentifier", type: "string", required: false, description: "Cluster identifier (required for cluster-scoped override types)" },
    { name: "identifier", type: "string", required: false, description: "Override identifier (auto-generated if not provided)" },
    {
      name: "spec", type: "object", required: false, description: "Structured override spec with variables, manifests, configFiles, applicationSettings, connectionStrings",
      fields: [
        { name: "variables", type: "array", required: false, description: "Variable overrides [{name, type, value}]", itemType: "NGVariable" },
        { name: "manifests", type: "array", required: false, description: "Manifest overrides", itemType: "ManifestConfigWrapper" },
        { name: "configFiles", type: "array", required: false, description: "Config file overrides", itemType: "ConfigFileWrapper" },
        { name: "applicationSettings", type: "object", required: false, description: "Application settings override (Azure)" },
        { name: "connectionStrings", type: "object", required: false, description: "Connection strings override (Azure)" },
      ],
    },
    { name: "yaml", type: "yaml", required: false, description: "Full override YAML (alternative to spec). Format: overrides:\\n  variables: [...]\\n  manifests: [...]\\n  configFiles: [...]" },
  ],
};

const overrideUpdateSchema: BodySchema = {
  description: "Service Override V2 update definition",
  fields: [
    { name: "identifier", type: "string", required: false, description: "Override identifier (auto-injected from resource_id if missing)" },
    { name: "environmentRef", type: "string", required: true, description: "Environment reference" },
    { name: "type", type: "string", required: true, description: "Override type: ENV_GLOBAL_OVERRIDE, ENV_SERVICE_OVERRIDE, INFRA_GLOBAL_OVERRIDE, INFRA_SERVICE_OVERRIDE, CLUSTER_GLOBAL_OVERRIDE, CLUSTER_SERVICE_OVERRIDE" },
    { name: "serviceRef", type: "string", required: false, description: "Service reference" },
    { name: "infraIdentifier", type: "string", required: false, description: "Infrastructure identifier" },
    { name: "clusterIdentifier", type: "string", required: false, description: "Cluster identifier" },
    {
      name: "spec", type: "object", required: false, description: "Structured override spec",
      fields: [
        { name: "variables", type: "array", required: false, description: "Variable overrides [{name, type, value}]", itemType: "NGVariable" },
        { name: "manifests", type: "array", required: false, description: "Manifest overrides", itemType: "ManifestConfigWrapper" },
        { name: "configFiles", type: "array", required: false, description: "Config file overrides", itemType: "ConfigFileWrapper" },
        { name: "applicationSettings", type: "object", required: false, description: "Application settings override" },
        { name: "connectionStrings", type: "object", required: false, description: "Connection strings override" },
      ],
    },
    { name: "yaml", type: "yaml", required: false, description: "Full override YAML (alternative to spec)" },
  ],
};

export const overridesToolset: ToolsetDefinition = {
  name: "overrides",
  displayName: "Service Overrides",
  description: "Harness Service Overrides V2 — override variables, manifests, config files, and application settings at environment, infrastructure, or cluster scope. Shows impacted services, environments, and infrastructure.",
  resources: [
    {
      resourceType: "service_override",
      displayName: "Service Override",
      description: "Override configuration for services across environments, infrastructure, or clusters. Supports ENV_GLOBAL_OVERRIDE (all services in env), ENV_SERVICE_OVERRIDE (specific service in env), INFRA_GLOBAL_OVERRIDE (all services on infra), INFRA_SERVICE_OVERRIDE (specific service on infra), CLUSTER_GLOBAL_OVERRIDE, and CLUSTER_SERVICE_OVERRIDE types. Returns YAML configuration and details about impacted service, environment, and infrastructure.",
      toolset: "overrides",
      scope: "project",
      identifierFields: ["override_id"],
      listFilterFields: [
        { name: "environment_id", description: "Environment identifier to list overrides for", required: true },
        { name: "service_id", description: "Optional service identifier to filter overrides for a specific service" },
        { name: "sort", description: "Sort criteria (e.g. lastModifiedAt,desc)" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/cd/orgs/{orgIdentifier}/projects/{projectIdentifier}/serviceOverrides?serviceOverrideType={type}",
      diagnosticHint: "Use harness_list(resource_type='service_override', environment_id='<env>') to list all overrides for an environment. The 'type' field indicates the scope: ENV_GLOBAL_OVERRIDE affects all services, ENV_SERVICE_OVERRIDE targets a specific service, INFRA_*_OVERRIDE targets infrastructure level, CLUSTER_*_OVERRIDE targets cluster level. Check serviceRef, infraIdentifier, and clusterIdentifier to understand impact.",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/environmentsV2/serviceOverrides",
          queryParams: {
            environment_id: "environmentIdentifier",
            service_id: "serviceIdentifier",
            sort: "sort",
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List service overrides for an environment. Requires environment_id. Optionally filter by service_id.",
        },
        get: {
          method: "GET",
          path: "/ng/api/serviceOverrides/{identifier}",
          pathParams: { override_id: "identifier" },
          responseExtractor: ngExtract,
          description: "Get a service override by identifier. Returns full YAML configuration and details including impacted service, environment, infrastructure, and override type.",
        },
        create: {
          method: "POST",
          path: "/ng/api/serviceOverrides",
          bodyBuilder: overrideBodyBuilder,
          responseExtractor: ngExtract,
          bodySchema: overrideCreateSchema,
          description: "Create a new service override. Requires environmentRef and type. Provide either spec (structured) or yaml for the override configuration.",
        },
        update: {
          method: "PUT",
          path: "/ng/api/serviceOverrides",
          bodyBuilder: buildBodyNormalized({
            injectIdentifier: { inputField: "override_id", bodyField: "identifier" },
            injectFields: [
              { from: "org_id", to: "orgIdentifier", onlyIfMissing: true },
              { from: "project_id", to: "projectIdentifier", onlyIfMissing: true },
            ],
          }),
          responseExtractor: ngExtract,
          bodySchema: overrideUpdateSchema,
          description: "Update an existing service override. Requires environmentRef and type in the body.",
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/serviceOverrides/{identifier}",
          pathParams: { override_id: "identifier" },
          responseExtractor: ngExtract,
          description: "Delete a service override by identifier.",
        },
      },
    },
  ],
};
