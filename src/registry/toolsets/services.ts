import type { ToolsetDefinition, BodySchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { ngExtract, pageExtract } from "../extractors.js";

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
      description: "Deployable service/workload definition. Supports full CRUD.",
      toolset: "services",
      scope: "project",
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
          pathParams: { service_id: "serviceIdentifier" },
          responseExtractor: ngExtract,
          description: "Get service details",
        },
        create: {
          method: "POST",
          path: "/ng/api/servicesV2",
          bodyBuilder: buildBodyNormalized({ unwrapKey: "service" }),
          responseExtractor: ngExtract,
          description: "Create a new service",
          bodySchema: serviceCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/ng/api/servicesV2",
          bodyBuilder: buildBodyNormalized({
            unwrapKey: "service",
            injectIdentifier: { inputField: "service_id", bodyField: "identifier" },
          }),
          responseExtractor: ngExtract,
          description: "Update an existing service",
          bodySchema: serviceUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/servicesV2/{serviceIdentifier}",
          pathParams: { service_id: "serviceIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a service",
        },
      },
    },
  ],
};
