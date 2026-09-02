import type { ToolsetDefinition } from "../types.js";
import {
  passthrough,
  harV3ListExtract,
  harV3DataArrayUnwrap,
  harV3DataObjectUnwrap,
} from "../extractors.js";

// Projects a raw v3 package list item down to the fields agents actually need.
// The default `compactItems()` whitelist keeps `id`/`name`/timestamps but drops
// `packageType`, `packageKind`, `latestVersion`, `registryName`, etc — those
// aren't recoverable via a per-package `get`, so lose them here and they're
// gone. Also renames `id` -> `package_id` to match `identifierFields`.
const compactPackageV3 = (item: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (item.id != null) { out.package_id = item.id; out.id = item.id; }
  if (item.name != null) out.name = item.name;
  if (item.packageType != null) out.packageType = item.packageType;
  if (item.packageKind != null) out.packageKind = item.packageKind;
  if (item.latestVersion != null) out.latestVersion = item.latestVersion;
  if (item.registryId != null) out.registryId = item.registryId;
  if (item.registryName != null) out.registryName = item.registryName;
  if (item.isPublic != null) out.isPublic = item.isPublic;
  if (item.isQuarantined != null) out.isQuarantined = item.isQuarantined;
  if (item.quarantineReason != null) out.quarantineReason = item.quarantineReason;
  if (item.modifiedAt != null) out.modifiedAt = item.modifiedAt;
  if (item.deletedAt != null) out.deletedAt = item.deletedAt;
  if (item.orgIdentifier != null) out.orgIdentifier = item.orgIdentifier;
  if (item.projectIdentifier != null) out.projectIdentifier = item.projectIdentifier;
  return out;
};

const compactVersionV3 = (item: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (item.id != null) { out.version_id = item.id; out.id = item.id; }
  if (item.name != null) out.name = item.name;
  if (item.packageId != null) out.packageId = item.packageId;
  if (item.packageName != null) out.packageName = item.packageName;
  if (item.packageType != null) out.packageType = item.packageType;
  if (item.packageKind != null) out.packageKind = item.packageKind;
  if (item.registryId != null) out.registryId = item.registryId;
  if (item.registryName != null) out.registryName = item.registryName;
  if (item.registryType != null) out.registryType = item.registryType;
  if (item.pullCommand != null) out.pullCommand = item.pullCommand;
  if (item.isQuarantined != null) out.isQuarantined = item.isQuarantined;
  if (item.createdAt != null) out.createdAt = item.createdAt;
  if (item.modifiedAt != null) out.modifiedAt = item.modifiedAt;
  if (item.deletedAt != null) out.deletedAt = item.deletedAt;
  return out;
};

const compactFirewallExceptionV3 = (item: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (item.exceptionId != null) out.exceptionId = item.exceptionId;
  if (item.status != null) out.status = item.status;
  if (item.packageName != null) out.packageName = item.packageName;
  if (item.packageType != null) out.packageType = item.packageType;
  if (item.registryId != null) out.registryId = item.registryId;
  if (item.registryName != null) out.registryName = item.registryName;
  if (item.versionId != null) out.versionId = item.versionId;
  if (item.versionList != null) out.versionList = item.versionList;
  if (item.versionScanMap != null) out.versionScanMap = item.versionScanMap;
  if (item.businessJustification != null) out.businessJustification = item.businessJustification;
  if (item.remediationPlan != null) out.remediationPlan = item.remediationPlan;
  if (item.notes != null) out.notes = item.notes;
  if (item.expireAfter != null) out.expireAfter = item.expireAfter;
  if (item.expirationAt != null) out.expirationAt = item.expirationAt;
  if (item.statusChangedAt != null) out.statusChangedAt = item.statusChangedAt;
  if (item.createdAt != null) out.createdAt = item.createdAt;
  if (item.updatedAt != null) out.updatedAt = item.updatedAt;
  return out;
};

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

// Known values from api.yaml PackageTypeV3. Extensible — the API may add more
// (e.g. GITLFS) so treat this as guidance for agents, not a hard whitelist.
const V3_PACKAGE_TYPES = [
  "DOCKER", "MAVEN", "PYTHON", "GENERIC", "HELM", "HELM_HTTP", "NUGET", "NPM",
  "RPM", "CARGO", "COMPOSER", "GO", "HUGGINGFACE", "CONDA", "DART", "SWIFT",
  "PUPPET", "RUBY", "RAW", "DEBIAN", "CONAN", "TERRAFORM", "CRAN", "WOLFI",
  "ALPINE",
];
const V3_PACKAGE_KINDS = ["model", "dataset", "module", "provider"];
const V3_SCAN_STATUSES = ["ALLOWED", "BLOCKED", "WARN", "UNKNOWN"];
const V3_FIREWALL_EXCEPTION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"];
const V3_POLICY_CATEGORIES = [
  "Security", "License", "MaliciousPackage", "PackageAge", "OssRiskLevel", "Unknown",
];
const V3_SORT_DESC = "Sort spec `sort_field:sort_order`, e.g. `name:asc` or `modifiedAt:desc`.";
const V3_PACKAGE_TYPES_DESC =
  "Package type. Known values include DOCKER, MAVEN, PYTHON, NPM, HELM, HELM_HTTP, etc. The API is extensible; unknown values may appear.";

export const registriesV3Toolset: ToolsetDefinition = {
  name: "registries-v3",
  displayName: "Artifact Registries (v3)",
  description:
    "Harness Artifact Registry v3 — packages, versions, files, metadata, scans, firewall exceptions (reads).",
  // Opt-in until v3 writes and a v3 registry list land, so agents don't have to
  // disambiguate between v1 registries/artifacts and v3 packages/versions.
  optIn: true,
  resources: [
    {
      resourceType: "package_v3",
      displayName: "Package (v3)",
      description: "Package in a registry. v3 term for what v1 calls an artifact.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["package_id"],
      compactItem: compactPackageV3,
      listFilterFields: [
        { name: "search_term", description: "Filter packages by name or keyword" },
        { name: "registry_ids", description: "Comma-separated registry IDs to filter within" },
        { name: "package_types", description: V3_PACKAGE_TYPES_DESC, enum: V3_PACKAGE_TYPES },
        {
          name: "package_kind",
          description: "Package kind (huggingface model/dataset, terraform module/provider)",
          enum: V3_PACKAGE_KINDS,
        },
        {
          name: "deleted",
          description: "Include soft-deleted packages",
          enum: ["exclude", "include", "only"],
        },
        { name: "metadata", description: "Filter by metadata using key:value format" },
        {
          name: "include_meta",
          description: "Include list-envelope counts (`activeCount`/`deletedCount`) in the response",
          type: "boolean",
        },
        { name: "sort", description: V3_SORT_DESC },
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
      compactItem: compactVersionV3,
      listFilterFields: [
        { name: "search_term", description: "Filter versions by name or keyword" },
        { name: "registry_ids", description: "Comma-separated registry IDs" },
        { name: "package_ids", description: "Comma-separated package IDs" },
        { name: "package_types", description: V3_PACKAGE_TYPES_DESC, enum: V3_PACKAGE_TYPES },
        { name: "deleted", description: "Include soft-deleted versions", enum: ["exclude", "include", "only"] },
        { name: "metadata", description: "Filter by metadata using key:value format" },
        { name: "uploaded_by", description: "Filter by uploader user ID" },
        {
          name: "include_meta",
          description: "Include list-envelope counts (`activeCount`/`deletedCount`) in the response",
          type: "boolean",
        },
        { name: "sort", description: V3_SORT_DESC },
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
        { name: "sort", description: V3_SORT_DESC },
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
    // Metadata GETs (registry/package/version/file) are ACCOUNT-scoped in the
    // v3 spec — Get*MetadataV3 declares only AccountIdentifierV3, not org/project.
    // Responses are `{ data: [{ id, key, type, value }] }` which we unwrap to
    // `{ items: [...] }` so the tool boundary matches every other v3 list.
    {
      resourceType: "registry_metadata_v3",
      displayName: "Registry Metadata (v3)",
      description: "Metadata key-value pairs attached to a registry.",
      toolset: "registries-v3",
      scope: "account",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["registry_id"],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/registries/{id}/metadata",
          pathParams: { registry_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: harV3DataArrayUnwrap,
          description: "Get metadata for a registry (v3)",
        },
      },
    },
    {
      resourceType: "package_metadata_v3",
      displayName: "Package Metadata (v3)",
      description: "Metadata key-value pairs attached to a package.",
      toolset: "registries-v3",
      scope: "account",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["package_id"],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/packages/{id}/metadata",
          pathParams: { package_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: harV3DataArrayUnwrap,
          description: "Get metadata for a package (v3)",
        },
      },
    },
    {
      resourceType: "version_metadata_v3",
      displayName: "Version Metadata (v3)",
      description: "Metadata key-value pairs attached to a version.",
      toolset: "registries-v3",
      scope: "account",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["version_id"],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/versions/{id}/metadata",
          pathParams: { version_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: harV3DataArrayUnwrap,
          description: "Get metadata for a version (v3)",
        },
      },
    },
    {
      resourceType: "file_metadata_v3",
      displayName: "File Metadata (v3)",
      description: "Metadata key-value pairs attached to a file.",
      toolset: "registries-v3",
      scope: "account",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["file_id"],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/files/{id}/metadata",
          pathParams: { file_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: harV3DataArrayUnwrap,
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
        { name: "package_types", description: V3_PACKAGE_TYPES_DESC, enum: V3_PACKAGE_TYPES },
        { name: "policy_set_ref", description: "OPA policy set reference" },
        {
          name: "categories",
          description: "Security violation categories to include",
          enum: V3_POLICY_CATEGORIES,
        },
        { name: "scan_id", description: "Specific scan ID" },
        {
          name: "scan_status",
          description: "Scan status filter (scan-detail responses only surface `BLOCKED` / `WARN`)",
          enum: V3_SCAN_STATUSES,
        },
        {
          name: "scope",
          description: "Registry scope",
          enum: ["none", "ancestors", "descendants"],
        },
        { name: "sort", description: V3_SORT_DESC },
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
          // Response is `{ data: { packageName, scanStatus, ... } }`; unwrap.
          responseExtractor: harV3DataObjectUnwrap,
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
      compactItem: compactFirewallExceptionV3,
      listFilterFields: [
        { name: "search_term", description: "Filter exceptions by keyword" },
        {
          name: "status",
          description: "Filter by exception status",
          enum: V3_FIREWALL_EXCEPTION_STATUSES,
        },
        { name: "package_name", description: "Filter by package name" },
        { name: "version", description: "Filter by version" },
        { name: "package_types", description: V3_PACKAGE_TYPES_DESC, enum: V3_PACKAGE_TYPES },
        { name: "registry_ids", description: "Comma-separated registry IDs" },
        { name: "exception_id", description: "Filter by exception ID" },
        { name: "sort", description: V3_SORT_DESC },
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
      // Account-scoped: v3 spec's ListFirewallExceptionVersionsV3 takes only
      // AccountIdentifierV3 (no org / project). Confirmed against api.yaml.
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
