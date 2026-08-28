import type { ToolsetDefinition } from "../types.js";
import { passthrough, harV3ListExtract } from "../extractors.js";

/**
 * HAR v3 read-only toolset.
 *
 * v3 is the standardized surface described in the Artifact Registry
 * v3 API standardization guide. Unlike v1 (which uses path-based
 * space refs like `/har/api/v1/spaces/{acct}/{org}/{proj}/+/…`),
 * v3 paths are flat and scope is passed via snake_case query params
 * (`account_identifier`, `org_identifier`, `project_identifier`).
 *
 * External gateway prefix: `/har/api/v3/…`.
 *
 * Scope: reads only. Writes (metadata upsert/save, firewall exception
 * create/update/status, tag add, bulk-evaluate, copy) and internal
 * operations (delete/restore/migrate, backfill, file preview/search)
 * are intentionally omitted — writes will land in a follow-up PR,
 * `x-internal: true` operations are excluded on purpose.
 */

const V3_SCOPE_PARAMS = {
  account: "account_identifier",
  org: "org_identifier",
  project: "project_identifier",
} as const;

const V3_PACKAGE_TYPES = [
  "CARGO", "COMPOSER", "CONDA", "DART", "DOCKER", "GENERIC", "GO", "HELM",
  "HUGGINGFACE", "MAVEN", "NPM", "NUGET", "PYTHON", "RAW", "RPM", "SWIFT",
  "ALPINE", "DEB", "GITLFS",
];

export const registriesV3Toolset: ToolsetDefinition = {
  name: "registries-v3",
  displayName: "Artifact Registries (v3)",
  description:
    "Harness Artifact Registry v3 — packages, versions, files, metadata, scans, firewall exceptions (reads).",
  resources: [
    {
      resourceType: "package_v3",
      displayName: "Package (v3)",
      description: "Package in a registry. v3 term for what v1 calls an artifact.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["package_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter packages by name or keyword" },
        { name: "registry_ids", description: "Comma-separated registry IDs to filter within" },
        { name: "package_types", description: "Package types filter", enum: V3_PACKAGE_TYPES },
        { name: "package_kind", description: "Package kind (huggingface model/dataset, terraform module/provider)" },
        {
          name: "deleted",
          description: "Include soft-deleted packages",
          enum: ["exclude", "include", "only"],
        },
        { name: "metadata", description: "Filter by metadata using key:value format" },
        { name: "include_meta", description: "Include the `meta` block in the response", type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/packages",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
            registry_ids: "registry_ids",
            package_types: "package_types",
            package_kind: "package_kind",
            deleted: "deleted",
            metadata: "metadata",
            include_meta: "include_meta",
            sort: "sort",
            page: "page",
            size: "size",
          },
          responseExtractor: harV3ListExtract,
          description: "List packages (v3)",
        },
      },
    },
    {
      resourceType: "version_v3",
      displayName: "Version (v3)",
      description: "Version of a package.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["version_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter versions by name or keyword" },
        { name: "registry_ids", description: "Comma-separated registry IDs" },
        { name: "package_ids", description: "Comma-separated package IDs" },
        { name: "package_types", description: "Package types filter", enum: V3_PACKAGE_TYPES },
        { name: "deleted", description: "Include soft-deleted versions", enum: ["exclude", "include", "only"] },
        { name: "metadata", description: "Filter by metadata using key:value format" },
        { name: "uploaded_by", description: "Filter by uploader user ID" },
        { name: "include_meta", description: "Include the `meta` block in the response", type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/versions",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
            registry_ids: "registry_ids",
            package_ids: "package_ids",
            package_types: "package_types",
            deleted: "deleted",
            metadata: "metadata",
            uploaded_by: "uploaded_by",
            include_meta: "include_meta",
            sort: "sort",
            page: "page",
            size: "size",
          },
          responseExtractor: harV3ListExtract,
          description: "List versions (v3)",
        },
      },
    },
    {
      resourceType: "file_v3",
      displayName: "File (v3)",
      description: "Files stored in a registry, scoped by registry / package / version.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["file_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter files by name or keyword" },
        { name: "registry_id", description: "Registry ID to scope the file search" },
        { name: "package_id", description: "Package ID to scope the file search" },
        { name: "version_id", description: "Version ID to scope the file search" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/files",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
            registry_id: "registry_id",
            package_id: "package_id",
            version_id: "version_id",
            sort: "sort",
            page: "page",
            size: "size",
          },
          responseExtractor: harV3ListExtract,
          description: "List files (v3)",
        },
      },
    },
    {
      resourceType: "registry_metadata_v3",
      displayName: "Registry Metadata (v3)",
      description: "Metadata key-value pairs attached to a registry.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["registry_id"],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/registries/{id}/metadata",
          pathParams: { registry_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get metadata for a registry (v3)",
        },
      },
    },
    {
      resourceType: "package_metadata_v3",
      displayName: "Package Metadata (v3)",
      description: "Metadata key-value pairs attached to a package.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["package_id"],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/packages/{id}/metadata",
          pathParams: { package_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get metadata for a package (v3)",
        },
      },
    },
    {
      resourceType: "version_metadata_v3",
      displayName: "Version Metadata (v3)",
      description: "Metadata key-value pairs attached to a version.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["version_id"],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/versions/{id}/metadata",
          pathParams: { version_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get metadata for a version (v3)",
        },
      },
    },
    {
      resourceType: "file_metadata_v3",
      displayName: "File Metadata (v3)",
      description: "Metadata key-value pairs attached to a file.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["file_id"],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/files/{id}/metadata",
          pathParams: { file_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get metadata for a file (v3)",
        },
      },
    },
    {
      resourceType: "metadata_key_v3",
      displayName: "Metadata Key (v3)",
      description: "Discover metadata keys defined in the account/org/project scope.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: [],
      listFilterFields: [
        { name: "search_term", description: "Filter keys by substring" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/metadata/keys",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
            page: "page",
            size: "size",
          },
          responseExtractor: harV3ListExtract,
          description: "List metadata keys (v3)",
        },
      },
    },
    {
      resourceType: "metadata_value_v3",
      displayName: "Metadata Value (v3)",
      description: "Discover the values a metadata key has taken across the scope.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: [],
      listFilterFields: [
        { name: "key", description: "Metadata key whose values to enumerate (required)", required: true },
        { name: "search_term", description: "Filter values by substring" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/metadata/values",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            key: "key",
            search_term: "search_term",
            page: "page",
            size: "size",
          },
          responseExtractor: harV3ListExtract,
          description: "List possible values for a metadata key (v3)",
        },
      },
    },
    {
      resourceType: "artifact_scan_v3",
      displayName: "Artifact Scan (v3)",
      description: "Firewall / policy scan results for artifacts.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["scan_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter scans by keyword" },
        { name: "registry_ids", description: "Comma-separated registry IDs" },
        { name: "package_types", description: "Package types filter", enum: V3_PACKAGE_TYPES },
        { name: "policy_set_ref", description: "OPA policy set reference" },
        { name: "categories", description: "Security violation categories to include" },
        { name: "scan_id", description: "Specific scan ID" },
        { name: "scan_status", description: "Scan status filter" },
        {
          name: "scope",
          description: "Registry scope",
          enum: ["none", "ancestors", "descendants"],
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/scans",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
            registry_ids: "registry_ids",
            package_types: "package_types",
            policy_set_ref: "policy_set_ref",
            categories: "categories",
            scan_id: "scan_id",
            scan_status: "scan_status",
            scope: "scope",
            sort: "sort",
            page: "page",
            size: "size",
          },
          responseExtractor: harV3ListExtract,
          description: "List artifact scan results (v3)",
        },
        get: {
          method: "GET",
          path: "/har/api/v3/scans/{id}/details",
          pathParams: { scan_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { policy_set_ref: "policy_set_ref" },
          responseExtractor: passthrough,
          description: "Get scan details for a single artifact scan (v3)",
        },
      },
    },
    {
      resourceType: "bulk_scan_evaluation_v3",
      displayName: "Bulk Scan Evaluation (v3)",
      description: "Status of an async bulk scan evaluation kicked off previously.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["evaluation_id"],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/scans/bulk-evaluate/{evaluation_id}",
          pathParams: { evaluation_id: "evaluation_id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get bulk scan evaluation status (v3)",
        },
      },
    },
    {
      resourceType: "firewall_exception_v3",
      displayName: "Firewall Exception (v3)",
      description: "Approved / pending exceptions that let a policy-blocked artifact through firewall.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["exception_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter exceptions by keyword" },
        { name: "status", description: "Filter by exception status" },
        { name: "package_name", description: "Filter by package name" },
        { name: "version", description: "Filter by version" },
        { name: "package_types", description: "Package types filter", enum: V3_PACKAGE_TYPES },
        { name: "registry_ids", description: "Comma-separated registry IDs" },
        { name: "exception_id", description: "Filter by exception ID" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/scans/exceptions",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
            status: "status",
            package_name: "package_name",
            version: "version",
            package_types: "package_types",
            registry_ids: "registry_ids",
            exception_id: "exception_id",
            sort: "sort",
            page: "page",
            size: "size",
          },
          responseExtractor: harV3ListExtract,
          description: "List firewall exceptions (v3)",
        },
      },
    },
    {
      resourceType: "firewall_exception_version_v3",
      displayName: "Firewall Exception Version (v3)",
      description: "Version listing used when authoring a firewall exception for a specific package.",
      toolset: "registries-v3",
      scope: "account",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: [],
      listFilterFields: [
        { name: "registry_id", description: "Registry UUID (required)", required: true },
        { name: "package_name", description: "Package name (required)", required: true },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/scans/versions",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            registry_id: "registry_id",
            package_name: "package_name",
            page: "page",
            size: "size",
          },
          responseExtractor: harV3ListExtract,
          description: "List versions available for firewall exception creation (v3)",
        },
      },
    },
  ],
};
