import type { ToolsetDefinition, BodySchema } from "../types.js";
import { passthrough, harV3ListExtract, harV3DataArrayUnwrap, harV3DataObjectUnwrap } from "../extractors.js";
import { V3_SCOPE_PARAMS, V3_PACKAGE_TYPES, V3_SORT_DESC, V3_PACKAGE_TYPES_DESC } from "./registries-v3.js";

const V3_SCAN_STATUSES = ["ALLOWED", "BLOCKED", "WARN", "UNKNOWN"];
const V3_FIREWALL_EXCEPTION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"];
const V3_POLICY_CATEGORIES = [
  "Security", "License", "MaliciousPackage", "PackageAge", "OssRiskLevel", "Unknown",
];

const firewallExceptionCreateSchema: BodySchema = {
  description:
    "Request to create a firewall exception for a policy-blocked artifact. " +
    "The exception starts in PENDING status and requires approval before it takes effect.",
  fields: [
    { name: "registryId", type: "string", required: true, description: "UUID of the registry containing the artifact" },
    { name: "packageName", type: "string", required: true, description: "Name of the package to except" },
    { name: "businessJustification", type: "string", required: true, description: "Business justification for allowing the blocked artifact" },
    { name: "versionList", type: "array", required: false, description: "Specific versions to except. Empty array means all versions.", itemType: "string" },
    { name: "expireAfter", type: "number", required: false, description: "Days after approval when the exception expires. Omit for never-expires." },
    { name: "remediationPlan", type: "string", required: false, description: "Plan for eventual remediation (optional)" },
  ],
};

// Only allowed server-side while status is PENDING — once approved/rejected the
// exception is immutable via this endpoint (use the status endpoint instead).
const firewallExceptionUpdateSchema: BodySchema = {
  description:
    "Request to update a pending firewall exception. Only allowed while status is PENDING; " +
    "approved or rejected exceptions cannot be edited this way.",
  fields: [
    { name: "businessJustification", type: "string", required: false, description: "Updated business justification for the exception" },
    { name: "versionList", type: "array", required: false, description: "Updated list of versions to except. Empty array means all versions.", itemType: "string" },
    { name: "expireAfter", type: "number", required: false, description: "Days after approval when the exception expires. Omitting or sending null leaves the existing value unchanged — this field cannot be cleared via update." },
    { name: "remediationPlan", type: "string", required: false, description: "Updated plan for remediation. Omitting or sending null leaves the existing value unchanged — this field cannot be cleared via update." },
  ],
};

// `status` is set by the approve/reject action itself, not supplied by the caller.
const firewallExceptionApprovalSchema: BodySchema = {
  description: "Approval decision for a pending firewall exception.",
  fields: [
    { name: "notes", type: "string", required: false, description: "Note from the approver explaining the decision" },
  ],
};

// Server-side limits: the sync endpoint evaluates inline, the async one queues a job.
const SYNC_EVALUATE_MAX_ARTIFACTS = 50;
const ASYNC_EVALUATE_MAX_ARTIFACTS = 10000;

const evaluateBodySchema = (max: number, withSkipCache: boolean): BodySchema => ({
  description: `Artifacts to evaluate against the registry's firewall policies (max ${max}).`,
  fields: [
    { name: "registryId", type: "string", required: true, description: "UUID of the registry whose firewall policies to apply" },
    {
      name: "artifacts",
      type: "array",
      required: true,
      description: `Artifacts to evaluate, each { packageName, version } (max ${max})`,
    },
    ...(withSkipCache
      ? [{ name: "skipCache", type: "boolean" as const, required: false, description: "Bypass cached scan results and re-evaluate" }]
      : []),
  ],
});

const evaluateBody = (max: number, allowSkipCache: boolean) => (input: Record<string, unknown>) => {
  const body = (input.body ?? {}) as Record<string, unknown>;
  const artifacts = body.artifacts;
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    throw new Error("body.artifacts must be a non-empty array of { packageName, version }.");
  }
  if (artifacts.length > max) {
    throw new Error(`body.artifacts accepts at most ${max} artifacts per call (got ${artifacts.length}). Split the request.`);
  }
  const invalid = artifacts.findIndex((a) => {
    const item = a as Record<string, unknown> | null;
    return typeof item?.packageName !== "string" || typeof item?.version !== "string";
  });
  if (invalid !== -1) {
    throw new Error(`body.artifacts[${invalid}] must have string packageName and version.`);
  }
  return {
    registryId: body.registryId,
    artifacts: artifacts.map((a) => {
      const item = a as Record<string, unknown>;
      return { packageName: item.packageName, version: item.version };
    }),
    ...(allowSkipCache && typeof body.skipCache === "boolean" ? { skipCache: body.skipCache } : {}),
  };
};

// Build-info rows live under `pipelineData` with blocked totals in `meta`.
const pipelineBuildInfoExtract = (raw: unknown): unknown => {
  if (typeof raw !== "object" || raw === null) return raw;
  const r = raw as Record<string, unknown>;
  const items = Array.isArray(r.pipelineData) ? r.pipelineData : [];
  const meta = r.meta as Record<string, unknown> | undefined;
  return {
    items,
    total: items.length,
    page: r.page,
    size: r.size,
    hasMore: r.hasMore,
    ...(typeof meta?.totalBlockedPipelines === "number" ? { totalBlockedPipelines: meta.totalBlockedPipelines } : {}),
    ...(typeof meta?.totalBlockedDependencies === "number" ? { totalBlockedDependencies: meta.totalBlockedDependencies } : {}),
  };
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
 * HAR v3 firewall / scan toolset.
 *
 * Split out of `registries-v3` (which stays opt-in to avoid a naming
 * collision between v1 registries/artifacts and v3 packages/versions) because
 * these resources — artifact scans, bulk scan evaluations, firewall
 * exceptions and the version list used to author them — have no v1
 * equivalent at all, so that collision-avoidance rationale does not apply.
 * Default-enabled so firewall exception management works out of the box.
 *
 * External gateway prefix: `/har/api/v3/…`.
 *
 * Write operations included: firewall exception create/update/delete and
 * approve/reject (all account-scoped), and the async bulk_evaluate action,
 * which queues an evaluation job. The sync evaluate action writes nothing.
 * `x-internal: true` operations are excluded on purpose.
 */
export const registriesFirewallToolset: ToolsetDefinition = {
  name: "registries-firewall",
  displayName: "Artifact Registry Firewall (v3)",
  description:
    "Harness Artifact Registry v3 firewall — artifact scans, sync and async firewall evaluation, " +
    "pipeline build info, and firewall exception create/update/delete/approve/reject (account-scoped writes).",
  optIn: false,
  resources: [
    {
      resourceType: "artifact_scan_v3",
      displayName: "Artifact Scan (v3)",
      description: "Firewall / policy scan results for artifacts.",
      toolset: "registries-firewall",
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
      executeActions: {
        evaluate: {
          method: "POST",
          path: "/har/api/v3/scans/bulk-evaluate-sync",
          // Evaluates inline and writes nothing, so it stays available in read-only mode.
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          bodyBuilder: evaluateBody(SYNC_EVALUATE_MAX_ARTIFACTS, true),
          responseExtractor: harV3DataArrayUnwrap,
          actionDescription:
            `Check whether up to ${SYNC_EVALUATE_MAX_ARTIFACTS} package versions would be allowed, warned or blocked by a registry's firewall policies, ` +
            "without pulling them. Nothing is stored. Body: { registryId, artifacts: [{ packageName, version }], skipCache? }. " +
            "For larger batches use bulk_evaluate.",
          bodySchema: evaluateBodySchema(SYNC_EVALUATE_MAX_ARTIFACTS, true),
        },
        bulk_evaluate: {
          method: "POST",
          path: "/har/api/v3/scans/bulk-evaluate",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: evaluateBody(ASYNC_EVALUATE_MAX_ARTIFACTS, false),
          responseExtractor: harV3DataObjectUnwrap,
          actionDescription:
            `Queue firewall policy evaluation for up to ${ASYNC_EVALUATE_MAX_ARTIFACTS} package versions. Returns an evaluationId; ` +
            "poll harness_get resource_type=bulk_scan_evaluation_v3 with evaluation_id for results. " +
            "Body: { registryId, artifacts: [{ packageName, version }] }.",
          bodySchema: evaluateBodySchema(ASYNC_EVALUATE_MAX_ARTIFACTS, false),
        },
      },
    },
    {
      resourceType: "bulk_scan_evaluation_v3",
      displayName: "Bulk Scan Evaluation (v3)",
      description: "Status of an async bulk scan evaluation kicked off previously.",
      toolset: "registries-firewall",
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
      toolset: "registries-firewall",
      // account-scoped: CreateFirewallExceptionV3 only accepts account_identifier (no org/project).
      // List accepts optional org/project for filtering — pass them explicitly via filter fields.
      scope: "account",
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
        { name: "org_id", description: "Org identifier to narrow list scope (optional)" },
        { name: "project_id", description: "Project identifier to narrow list scope (optional)" },
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
            org_id: "org_identifier",
            project_id: "project_identifier",
          },
          responseExtractor: harV3ListExtract,
          description: "List firewall exceptions (v3)",
        },
        create: {
          method: "POST",
          path: "/har/api/v3/scans/exceptions",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a firewall exception for a policy-blocked artifact (starts in PENDING status, requires approval)",
          bodySchema: firewallExceptionCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/har/api/v3/scans/exceptions/{id}",
          pathParams: { exception_id: "id" },
          // PUT, but it's a partial update server-side — omitted/null fields are left
          // unchanged rather than cleared (see firewallExceptionUpdateSchema). Still
          // idempotent for a fixed input, so safe to retry.
          operationPolicy: { risk: "medium_write", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a pending firewall exception by exception_id. Only allowed while status is PENDING. This is a partial update — fields you omit (or send as null) keep their current value; expireAfter and remediationPlan cannot be cleared this way.",
          bodySchema: firewallExceptionUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/har/api/v3/scans/exceptions/{id}",
          pathParams: { exception_id: "id" },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete a firewall exception by exception_id.",
        },
      },
      executeActions: {
        approve: {
          method: "PUT",
          path: "/har/api/v3/scans/exceptions/{id}/status",
          pathParams: { exception_id: "id" },
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            return {
              status: "APPROVED",
              notes: input.notes ?? body?.notes,
            };
          },
          responseExtractor: passthrough,
          actionDescription: "Approve a pending firewall exception. Requires exception_id. Optional: notes.",
          bodySchema: firewallExceptionApprovalSchema,
        },
        reject: {
          method: "PUT",
          path: "/har/api/v3/scans/exceptions/{id}/status",
          pathParams: { exception_id: "id" },
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            return {
              status: "REJECTED",
              notes: input.notes ?? body?.notes,
            };
          },
          responseExtractor: passthrough,
          actionDescription: "Reject a pending firewall exception. Requires exception_id. Optional: notes.",
          bodySchema: firewallExceptionApprovalSchema,
        },
      },
    },
    {
      resourceType: "firewall_exception_version_v3",
      displayName: "Firewall Exception Version (v3)",
      description: "Version listing used when authoring a firewall exception for a specific package.",
      // Account-scoped: v3 spec's ListFirewallExceptionVersionsV3 takes only
      // AccountIdentifierV3 (no org / project). Confirmed against api.yaml.
      toolset: "registries-firewall",
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
    {
      resourceType: "firewall_build_info_v3",
      displayName: "Firewall Pipeline Build Info (v3)",
      description:
        "Pipeline builds that pulled firewall-blocked dependencies, with totalBlockedPipelines / totalBlockedDependencies. " +
        "Use it to find which pipelines a blocked package or scan affects.",
      toolset: "registries-firewall",
      scope: "project",
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: [],
      listFilterFields: [
        { name: "package_name", description: "Filter by package name" },
        { name: "version", description: "Filter by package version" },
        { name: "registry_id", description: "Filter by registry UUID" },
        { name: "pipeline_id", description: "Filter by pipeline identifier" },
        { name: "scan_id", description: "Filter by scan ID (from artifact_scan_v3)" },
        { name: "projects", description: "Comma-separated project identifiers" },
        { name: "categories", description: "Security violation categories to include", enum: V3_POLICY_CATEGORIES },
        { name: "package_types", description: V3_PACKAGE_TYPES_DESC, enum: V3_PACKAGE_TYPES },
        { name: "scope", description: "Registry scope", enum: ["none", "ancestors", "descendants"] },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/build-info/pipeline/details",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            package_name: "package_name",
            version: "version",
            registry_id: "registry_id",
            pipeline_id: "pipeline_id",
            scan_id: "scan_id",
            projects: "projects",
            categories: "categories",
            package_types: "package_types",
            scope: "scope",
            page: "page",
            size: "size",
          },
          skipCompact: true,
          responseExtractor: pipelineBuildInfoExtract,
          description: "List pipeline build info for firewall-blocked dependencies (v3)",
        },
      },
    },
  ],
};
