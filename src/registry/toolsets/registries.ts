import type { ToolsetDefinition, PathBuilderConfig, BodySchema } from "../types.js";
import { passthrough, harListExtract } from "../extractors.js";

// ---------------------------------------------------------------------------
// Body schemas
// ---------------------------------------------------------------------------

const PACKAGE_TYPES = [
  "CARGO", "COMPOSER", "CONDA", "DART", "DOCKER", "GENERIC", "GO", "HELM",
  "HELM_HTTP", "HUGGINGFACE", "MAVEN", "NPM", "NUGET", "PYTHON", "RAW",
  "RPM", "SWIFT", "DEBIAN", "CONAN", "TERRAFORM", "CRAN", "WOLFI", "ALPINE",
];

const registryCreateSchema: BodySchema = {
  description: "Registry definition. Set `config.type` to VIRTUAL (aggregates upstreams) or UPSTREAM (proxy to a single remote).",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Registry slug / identifier (e.g. my-npm-registry)" },
    { name: "type", type: "string", required: true, description: "Registry kind: VIRTUAL or UPSTREAM" },
    { name: "packageType", type: "string", required: true, description: `Package type: ${PACKAGE_TYPES.join(", ")}` },
    { name: "isPublic", type: "boolean", required: true, description: "Whether the registry is publicly accessible" },
    { name: "parentRef", type: "string", required: true, description: "Scope reference: accountId/orgId/projectId" },
    { name: "description", type: "string", required: false, description: "Human-readable description" },
    { name: "allowedPattern", type: "array", required: false, description: "Glob patterns for artifacts allowed in this registry", itemType: "string" },
    { name: "blockedPattern", type: "array", required: false, description: "Glob patterns for artifacts blocked in this registry", itemType: "string" },
    { name: "labels", type: "array", required: false, description: "Labels to attach to the registry", itemType: "string" },
    { name: "policyRefs", type: "array", required: false, description: "OPA policy set references to enforce on this registry", itemType: "string" },
    {
      name: "config",
      type: "object",
      required: false,
      description:
        "Registry-type-specific config. " +
        "VIRTUAL: `{ type: 'VIRTUAL', upstreamProxies: ['<registryRef>', ...] }`. " +
        "UPSTREAM: `{ type: 'UPSTREAM', source: 'Dockerhub|PyPi|NpmJs|MavenCentral|Custom|...', url: '<url>' }` (url required when source is Custom).",
    },
  ],
};

// Update uses the same shape as create but all fields are optional (PUT replaces the full resource).
const registryUpdateSchema: BodySchema = {
  description: "Full registry definition to replace the existing one (PUT semantics). Same fields as create; all are optional.",
  fields: registryCreateSchema.fields.map((f) => ({ ...f, required: false })),
};

/**
 * HAR API uses path-based scope refs (not query params).
 * Space ref = {accountId}/{orgId}/{projectId}
 * Registry ref = {spaceRef}/{registryName}
 *
 * Matches the Go MCP server's utils.GetRef(scope, ...) pattern.
 */

function harSpaceRef(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const account = config.HARNESS_ACCOUNT_ID ?? "";
  const org = (input.org_id as string) || config.HARNESS_ORG || "";
  const project = (input.project_id as string) || config.HARNESS_PROJECT || "";
  return `${account}/${org}/${project}`;
}

function harRegistryRef(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const registry = input.registry_id as string;
  return `${harSpaceRef(input, config)}/${registry}`;
}

export const registriesToolset: ToolsetDefinition = {
  name: "registries",
  displayName: "Artifact Registries",
  description: "Harness Artifact Registry — registries, artifacts, and versions",
  resources: [
    {
      resourceType: "registry",
      displayName: "Registry",
      description: "Artifact registry. Supports list, get, create, and update.",
      toolset: "registries",
      scope: "project",
      identifierFields: ["registry_id"],
      listFilterFields: [
        { name: "search", description: "Filter artifact registries by name or keyword" },
        { name: "type", description: "Registry type filter", enum: ["UPSTREAM", "VIRTUAL"] },
        {
          name: "package_type",
          description: "Filter registries by package type",
          enum: [
            "CARGO", "COMPOSER", "CONDA", "DART", "DOCKER", "GENERIC", "GO", "HELM",
            "HUGGINGFACE", "MAVEN", "NPM", "NUGET", "PYTHON", "RAW", "RPM", "SWIFT",
          ],
        },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/registries/{registryIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v1/spaces",
          pathBuilder: (input, config) =>
            `/har/api/v1/spaces/${harSpaceRef(input, config)}/+/registries`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search: "search_term",
            type: "type",
            package_type: "package_type",
            page: "page",
            size: "size",
          },
          responseExtractor: harListExtract("registries"),
          description: "List artifact registries",
        },
        get: {
          method: "GET",
          path: "/har/api/v1/registry",
          pathBuilder: (input, config) =>
            `/har/api/v1/registry/${harRegistryRef(input, config)}/+`,
          pathParams: { registry_id: "registryIdentifier" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get registry details",
        },
        create: {
          method: "POST",
          path: "/har/api/v1/registry",
          // space_ref is a required query param; derive it from scope config.
          pathBuilder: (input, config) =>
            `/har/api/v1/registry?space_ref=${encodeURIComponent(harSpaceRef(input, config))}`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a new artifact registry",
          bodySchema: registryCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/har/api/v1/registry",
          pathBuilder: (input, config) =>
            `/har/api/v1/registry/${harRegistryRef(input, config)}/+`,
          pathParams: { registry_id: "registryIdentifier" },
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update (replace) an existing artifact registry",
          bodySchema: registryUpdateSchema,
        },
      },
    },
    {
      resourceType: "artifact",
      displayName: "Artifact",
      description: "Artifact within a registry. Supports list.",
      toolset: "registries",
      scope: "project",
      identifierFields: ["registry_id", "artifact_id"],
      listFilterFields: [
        { name: "search", description: "Filter artifacts by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/registries/{registryIdentifier}/artifacts/{artifactIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v1/registry",
          pathBuilder: (input, config) =>
            `/har/api/v1/registry/${harRegistryRef(input, config)}/+/artifacts`,
          pathParams: { registry_id: "registryIdentifier" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search: "search_term",
            page: "page",
            size: "size",
          },
          responseExtractor: harListExtract("artifacts"),
          description: "List artifacts in a registry",
        },
      },
    },
    {
      resourceType: "artifact_version",
      displayName: "Artifact Version",
      description: "Version of an artifact. Supports list.",
      toolset: "registries",
      scope: "project",
      identifierFields: ["registry_id", "artifact_id", "version"],
      listFilterFields: [
        { name: "search", description: "Filter artifact versions by name or keyword" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v1/registry",
          pathBuilder: (input, config) => {
            const artifact = input.artifact_id as string;
            return `/har/api/v1/registry/${harRegistryRef(input, config)}/+/artifact/${artifact}/+/versions`;
          },
          pathParams: {
            registry_id: "registryIdentifier",
            artifact_id: "artifactIdentifier",
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search: "search_term",
            page: "page",
            size: "size",
          },
          responseExtractor: harListExtract("artifactVersions"),
          description: "List versions of an artifact",
        },
      },
    },
    {
      resourceType: "artifact_file",
      displayName: "Artifact File",
      description: "Files within an artifact version. Supports list.",
      toolset: "registries",
      scope: "project",
      identifierFields: ["registry_id", "artifact_id", "version"],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v1/registry",
          pathBuilder: (input, config) => {
            const artifact = input.artifact_id as string;
            const version = input.version as string;
            return `/har/api/v1/registry/${harRegistryRef(input, config)}/+/artifact/${artifact}/+/version/${version}/files`;
          },
          pathParams: {
            registry_id: "registryIdentifier",
            artifact_id: "artifactIdentifier",
            version: "versionIdentifier",
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            sort_order: "sort_order",
            sort_field: "sort_field",
            search: "search_term",
            page: "page",
            size: "size",
          },
          responseExtractor: harListExtract("files"),
          description: "List files in an artifact version",
        },
      },
    },
  ],
};
