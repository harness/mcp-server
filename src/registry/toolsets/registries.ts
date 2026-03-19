import type { ToolsetDefinition, PathBuilderConfig } from "../types.js";
import { passthrough, harListExtract } from "../extractors.js";

/**
 * HAR API uses path-based scope refs (not query params).
 * Space ref = {accountId}/{orgId}/{projectId}
 * Registry ref = {spaceRef}/{registryName}
 *
 * Matches the Go MCP server's utils.GetRef(scope, ...) pattern.
 */

function harSpaceRef(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const account = config.HARNESS_ACCOUNT_ID ?? "";
  const org = (input.org_id as string) || config.HARNESS_DEFAULT_ORG_ID || "";
  const project = (input.project_id as string) || config.HARNESS_DEFAULT_PROJECT_ID || "";
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
      description: "Artifact registry. Supports list and get.",
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
          responseExtractor: passthrough,
          description: "Get registry details",
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
