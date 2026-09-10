import type { ToolsetDefinition, BodySchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { ngExtract, pageExtract } from "../extractors.js";

/**
 * Service create/update body shaping — same unwrap/strip pattern as infrastructure, plus
 * ``ensureYamlWrapper``. NG accepts flat JSON for metadata-only services but drops
 * ``serviceDefinition`` (manifests, artifacts, deployment type) unless it is embedded in
 * ``body.yaml``. Without yaml synthesis, AI/HITL flows that POST JSON with
 * ``serviceDefinition`` persist a skeleton entity (deployment type undefined in UI).
 *
 * Inject org/project from tool-level ``org_id``/``project_id`` before yaml synthesis so
 * the generated ``body.yaml`` includes scope fields.
 */
const serviceScopeFields = [
  { from: "org_id", to: "orgIdentifier", onlyIfMissing: true },
  { from: "project_id", to: "projectIdentifier", onlyIfMissing: true },
] as const;

const serviceCreateBodyBuilder = buildBodyNormalized({
  unwrapKey: "service",
  ensureYamlWrapper: "service",
  injectFields: [...serviceScopeFields],
});

const serviceUpdateBodyBuilder = buildBodyNormalized({
  unwrapKey: "service",
  ensureYamlWrapper: "service",
  injectIdentifier: { inputField: "service_id", bodyField: "identifier" },
  injectFields: [...serviceScopeFields],
});

const serviceCreateSchema: BodySchema = {
  description: "Service definition",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Unique identifier (lowercase, hyphens, underscores)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "description", type: "string", required: false, description: "Optional description" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
    { name: "yaml", type: "yaml", required: false, description: "Full service YAML definition (for advanced config with manifests, artifacts, etc.)" },
  ],
};

const serviceUpdateSchema: BodySchema = {
  description: "Service update definition",
  fields: [
    { name: "identifier", type: "string", required: false, description: "Identifier (auto-injected from resource_id if missing)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "description", type: "string", required: false, description: "Updated description" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
  ],
};

export const servicesToolset: ToolsetDefinition = {
  name: "services",
  displayName: "Services",
  description: "Harness service entities representing deployable workloads",
  resources: [
    {
      resourceType: "service",
      displayName: "Service",
      description: "Deployable service/workload definition. Supports full CRUD. Default list/get scope is project — pass org_id and project_id (or a project URL) on the first call. Use resource_scope='account' only when the user asked for account-level services.",
      toolset: "services",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["service_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter services by name or keyword" },
        { name: "sort", description: "Field to sort by (e.g. name, identifier)" },
        { name: "order", description: "Sort order", enum: ["asc", "desc"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/services/{serviceIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/servicesV2",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            sort: "sort",
            order: "order",
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List services in a project",
        },
        get: {
          method: "GET",
          path: "/ng/api/servicesV2/{serviceIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { service_id: "serviceIdentifier" },
          responseExtractor: ngExtract,
          description: "Get service details",
        },
        create: {
          method: "POST",
          path: "/ng/api/servicesV2",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: serviceCreateBodyBuilder,
          responseExtractor: ngExtract,
          description: "Create a new service",
          bodySchema: serviceCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/ng/api/servicesV2",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: serviceUpdateBodyBuilder,
          responseExtractor: ngExtract,
          description: "Update an existing service",
          bodySchema: serviceUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/servicesV2/{serviceIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { service_id: "serviceIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a service",
        },
      },
    },
  ],
};
