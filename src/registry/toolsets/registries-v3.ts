import type { ToolsetDefinition } from "../types.js";
import { harV3ListExtract, harV3DataArrayUnwrap, harV3DataObjectUnwrap } from "../extractors.js";

// The stats endpoints reject more than 100 UUIDs per request.
const V3_STATS_MAX_IDS = 100;

const toIdList = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return raw.map((v) => String(v).trim()).filter((v) => v.length > 0);
};

const statsBody = (inputKey: string, bodyKey: string) => (input: Record<string, unknown>) => {
  const ids = toIdList(input[inputKey]);
  if (ids.length === 0) {
    throw new Error(`${inputKey} must contain at least one UUID.`);
  }
  if (ids.length > V3_STATS_MAX_IDS) {
    throw new Error(`${inputKey} accepts at most ${V3_STATS_MAX_IDS} UUIDs per call (got ${ids.length}). Split the request.`);
  }
  return { [bodyKey]: ids };
};

// Deployments carry prod / non-prod environment counts in `meta`, which
// harV3ListExtract deliberately does not forward.
const versionDeploymentsExtract = (raw: unknown): unknown => {
  const base = harV3ListExtract(raw);
  if (typeof raw !== "object" || raw === null || typeof base !== "object" || base === null) return base;
  const meta = (raw as Record<string, unknown>).meta as Record<string, unknown> | undefined;
  return {
    ...(base as Record<string, unknown>),
    ...(typeof meta?.prodEnvCount === "number" ? { prodEnvCount: meta.prodEnvCount } : {}),
    ...(typeof meta?.nonProdEnvCount === "number" ? { nonProdEnvCount: meta.nonProdEnvCount } : {}),
  };
};

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

/**
 * HAR v3 toolset.
 *
 * v3 is the standardized surface described in the Artifact Registry
 * v3 API standardization guide. Unlike v1 (which uses path-based
 * space refs like `/har/api/v1/spaces/{acct}/{org}/{proj}/+/…`),
 * v3 paths are flat and scope is passed via snake_case query params
 * (`account_identifier`, `org_identifier`, `project_identifier`).
 *
 * External gateway prefix: `/har/api/v3/…`.
 *
 * Firewall exception / scan resources live in the separate, default-enabled
 * `registries-firewall` toolset (no v1 equivalent, so no naming collision to
 * guard against) — see `./registries-firewall.js`.
 * `x-internal: true` operations are excluded on purpose.
 */

// Shared with `registries-firewall.ts`, which has no v1 equivalent to collide
// with and so does not need this toolset's opt-in gating.
export const V3_SCOPE_PARAMS = {
  account: "account_identifier",
  org: "org_identifier",
  project: "project_identifier",
} as const;

// Known values from api.yaml PackageTypeV3. Extensible — the API may add more
// (e.g. GITLFS) so treat this as guidance for agents, not a hard whitelist.
export const V3_PACKAGE_TYPES = [
  "DOCKER", "MAVEN", "PYTHON", "GENERIC", "HELM", "HELM_HTTP", "NUGET", "NPM",
  "RPM", "CARGO", "COMPOSER", "GO", "HUGGINGFACE", "CONDA", "DART", "SWIFT",
  "PUPPET", "RUBY", "RAW", "DEBIAN", "CONAN", "TERRAFORM", "CRAN", "WOLFI",
  "ALPINE",
];
const V3_PACKAGE_KINDS = ["model", "dataset", "module", "provider"];
export const V3_SORT_DESC = "Sort spec `sort_field:sort_order`, e.g. `name:asc` or `modifiedAt:desc`.";
export const V3_PACKAGE_TYPES_DESC =
  "Package type. Known values include DOCKER, MAVEN, PYTHON, NPM, HELM, HELM_HTTP, etc. The API is extensible; unknown values may appear.";

export const registriesV3Toolset: ToolsetDefinition = {
  name: "registries-v3",
  displayName: "Artifact Registries (v3)",
  description:
    "Harness Artifact Registry v3 — packages, versions, files, metadata, scans, firewall exceptions. Includes firewall exception create/update/delete and approve/reject (account-scoped writes).",
  // Opt-in until a v3 registry list lands, so agents don't have to
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
    // GetFileDetailsV3 / ListVersionDeploymentsV3 / GetSystemInfoV3 declare only
    // AccountIdentifierV3, so they live on their own account-scoped resource
    // types instead of as `get` on the project-scoped list resources.
    {
      resourceType: "file_detail_v3",
      displayName: "File Detail (v3)",
      description:
        "Detail for a single file by UUID: checksums, size, content type, and a downloadUrl / downloadCmd. File bytes are never returned — share the downloadUrl instead.",
      toolset: "registries-v3",
      scope: "account",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["file_id"],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/files/{id}",
          pathParams: { file_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: harV3DataObjectUnwrap,
          description: "Get file details by UUID (v3). Get file_id from file_v3 list.",
        },
      },
    },
    {
      resourceType: "version_deployment_v3",
      displayName: "Version Deployment (v3)",
      description:
        "Harness CD environments and services currently running a version, with prodEnvCount / nonProdEnvCount totals. " +
        "For Docker and Helm versions pass package_tag (the image or chart tag) — without it the list is empty.",
      toolset: "registries-v3",
      scope: "account",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["version_id"],
      listFilterFields: [
        { name: "version_id", description: "Version UUID (required)", required: true },
        { name: "package_tag", description: "Tag to resolve deployments for. Required in practice for DOCKER and HELM versions." },
        { name: "env_type", description: "Environment type filter", enum: ["PRODUCTION", "PRE_PRODUCTION"] },
        { name: "search_term", description: "Filter deployments by keyword" },
        { name: "sort", description: V3_SORT_DESC },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/versions/{id}/deployments",
          pathParams: { version_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            package_tag: "package_tag",
            env_type: "env_type",
            search_term: "search_term",
            sort: "sort",
            page: "page",
            size: "size",
          },
          skipCompact: true,
          responseExtractor: versionDeploymentsExtract,
          description: "List CD deployments of a version (v3)",
        },
      },
    },
    {
      resourceType: "system_info_v3",
      displayName: "System Info (v3)",
      description:
        "Artifact Registry system info for the account: registryHost and registryUrl. Use it to build push/pull hostnames (e.g. docker login <registryHost>).",
      toolset: "registries-v3",
      scope: "account",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/system/info",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: harV3DataObjectUnwrap,
          description: "Get the account's registry host and URL (v3)",
        },
      },
    },
    // Stats endpoints are read-only POSTs that hydrate up to 100 UUIDs at a time.
    {
      resourceType: "registry_stats_v3",
      displayName: "Registry Stats (v3)",
      description: "Package count, size, download count and artifact count for up to 100 registries by UUID.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: [],
      listFilterFields: [
        { name: "registry_ids", description: `Comma-separated registry UUIDs, max ${V3_STATS_MAX_IDS} (required)`, required: true },
        { name: "scope", description: "Registry scope", enum: ["none", "ancestors", "descendants"] },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/har/api/v3/registries/stats",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { scope: "scope" },
          skipScopeBodyInjection: true,
          bodyBuilder: statsBody("registry_ids", "registryIds"),
          skipCompact: true,
          responseExtractor: harV3ListExtract,
          description: "Get stats for registries (v3)",
        },
      },
    },
    {
      resourceType: "package_stats_v3",
      displayName: "Package Stats (v3)",
      description: "Artifact count, size and download count for up to 100 packages by UUID.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: [],
      listFilterFields: [
        { name: "package_ids", description: `Comma-separated package UUIDs, max ${V3_STATS_MAX_IDS} (required)`, required: true },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/har/api/v3/packages/stats",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          bodyBuilder: statsBody("package_ids", "packageIds"),
          skipCompact: true,
          responseExtractor: harV3ListExtract,
          description: "Get stats for packages (v3)",
        },
      },
    },
    {
      resourceType: "version_stats_v3",
      displayName: "Version Stats (v3)",
      description:
        "Download count, file count, size, scan status / scan ID and deployment metadata for up to 100 versions by UUID.",
      toolset: "registries-v3",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: [],
      listFilterFields: [
        { name: "version_ids", description: `Comma-separated version UUIDs, max ${V3_STATS_MAX_IDS} (required)`, required: true },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/har/api/v3/versions/stats",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          bodyBuilder: statsBody("version_ids", "versionIds"),
          skipCompact: true,
          responseExtractor: harV3ListExtract,
          description: "Get stats for versions (v3)",
        },
      },
    },
  ],
};
