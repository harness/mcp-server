import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

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
          path: "/har/api/v1/registry",
          queryParams: {
            search: "search",
            type: "type",
            package_type: "package_type",
            page: "page",
            size: "size",
          },
          responseExtractor: passthrough,
          description: "List artifact registries",
        },
        get: {
          method: "GET",
          path: "/har/api/v1/registry/{registryIdentifier}",
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
          path: "/har/api/v1/registry/{registryIdentifier}/artifacts",
          pathParams: { registry_id: "registryIdentifier" },
          queryParams: {
            search: "search",
            page: "page",
            size: "size",
          },
          responseExtractor: passthrough,
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
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v1/registry/{registryIdentifier}/artifact/{artifactIdentifier}/versions",
          pathParams: {
            registry_id: "registryIdentifier",
            artifact_id: "artifactIdentifier",
          },
          responseExtractor: passthrough,
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
          path: "/har/api/v1/registry/{registryIdentifier}/artifact/{artifactIdentifier}/version/{versionIdentifier}/files",
          pathParams: {
            registry_id: "registryIdentifier",
            artifact_id: "artifactIdentifier",
            version: "versionIdentifier",
          },
          responseExtractor: passthrough,
          description: "List files in an artifact version",
        },
      },
    },
  ],
};
