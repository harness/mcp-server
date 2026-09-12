import type { ToolsetDefinition, PathBuilderConfig, BodySchema } from "../types.js";
import { ngExtract, harListExtract } from "../extractors.js";

// Canonical PackageType enum — matches RegistryRequest.PackageType in the v1 OpenAPI spec.
const PACKAGE_TYPES = [
  "CARGO", "COMPOSER", "CONDA", "CRAN", "DART", "DEBIAN", "DOCKER",
  "GENERIC", "GO", "HELM", "HELM_HTTP", "HUGGINGFACE", "MAVEN", "NPM",
  "NUGET", "PUPPET", "PYTHON", "RAW", "RPM", "RUBY", "SWIFT",
  "TERRAFORM", "TERRAFORM_BACKEND", "CONAN", "WOLFI", "ALPINE",
];

const registryCreateSchema: BodySchema = {
  description:
    "Registry body (RegistryRequest). The registry kind (VIRTUAL or UPSTREAM) is set via `config.type`. " +
    "`parentRef` is derived automatically from the scope — omit it unless you need to override.",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Registry slug / identifier (e.g. my-npm-registry)" },
    { name: "packageType", type: "string", required: true, description: `Package ecosystem: ${PACKAGE_TYPES.join(", ")}` },
    { name: "isPublic", type: "boolean", required: true, description: "Whether the registry is publicly accessible" },
    {
      name: "config",
      type: "object",
      required: true,
      description:
        "Registry-kind config — `config.type` is required. " +
        "VIRTUAL: `{ type: 'VIRTUAL', upstreamProxies: ['<spaceRef>/<registryName>', ...] }`. " +
        "UPSTREAM: `{ type: 'UPSTREAM', source: 'Dockerhub|PyPi|NpmJs|MavenCentral|NugetOrg|Crates|" +
        "RubyGems|GoProxy|HuggingFace|Anaconda|Pubdev|Packagist|PuppetForge|HelmChartRepo|" +
        "ConanCenter|TerraformRegistry|CRAN|Wolfi|Alpine|Custom', url: '<url>' }` (url required for Custom source).",
    },
    { name: "parentRef", type: "string", required: false, description: "Scope ref accountId/orgId/projectId — auto-filled from scope; override only when creating in a different scope" },
    { name: "description", type: "string", required: false, description: "Human-readable description" },
    { name: "allowedPattern", type: "array", required: false, description: "Glob patterns for artifacts allowed in this registry", itemType: "string" },
    { name: "blockedPattern", type: "array", required: false, description: "Glob patterns for artifacts blocked in this registry", itemType: "string" },
    { name: "cleanupPolicy", type: "array", required: false, description: "Cleanup policies attached to this registry" },
    { name: "labels", type: "array", required: false, description: "Labels to attach to the registry", itemType: "string" },
    { name: "policyRefs", type: "array", required: false, description: "OPA policy set references to enforce on this registry", itemType: "string" },
    { name: "scanners", type: "array", required: false, description: "Security scanners to run against artifacts in this registry" },
  ],
};

// PUT replaces the full resource — same required fields as create.
const registryUpdateSchema: BodySchema = {
  description: "Full registry definition to replace the existing one (PUT semantics). Same fields as create; `parentRef` is auto-filled.",
  fields: registryCreateSchema.fields,
};

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
          enum: PACKAGE_TYPES,
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
          responseExtractor: ngExtract,
          description: "Get registry details",
        },
        create: {
          method: "POST",
          path: "/har/api/v1/registry",
          // HAR create requires space_ref=<accountId>/<orgId>/<projectId>/+
          pathBuilder: (input, config) =>
            `/har/api/v1/registry?space_ref=${encodeURIComponent(`${harSpaceRef(input, config)}/+`)}`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input, config) => {
            const body = ((input.body ?? {}) as Record<string, unknown>);
            return {
              ...body,
              parentRef: body.parentRef ?? harSpaceRef(input, config),
            };
          },
          responseExtractor: ngExtract,
          description: "Create a new artifact registry",
          bodySchema: registryCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/har/api/v1/registry",
          pathBuilder: (input, config) =>
            `/har/api/v1/registry/${harRegistryRef(input, config)}/+`,
          pathParams: { registry_id: "registryIdentifier" },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input, config) => {
            const body = ((input.body ?? {}) as Record<string, unknown>);
            return {
              ...body,
              parentRef: body.parentRef ?? harSpaceRef(input, config),
            };
          },
          responseExtractor: ngExtract,
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
