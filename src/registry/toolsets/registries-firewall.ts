import type { ToolsetDefinition, BodySchema } from "../types.js";
import {
  passthrough, harV3ListExtract, harV3DataObjectUnwrap, harV3ScanEvaluationExtract, firewallExceptionListExtract,
  bulkScanEvaluationExtract,
} from "../extractors.js";
import { V3_SCOPE_PARAMS, V3_PACKAGE_TYPES, V3_SORT_DESC, V3_PACKAGE_TYPES_DESC } from "./registries-v3.js";

// The scan list only accepts these two; the backend rejects ALLOWED/UNKNOWN with a 400.
const V3_SCAN_LIST_STATUSES = ["BLOCKED", "WARN"];

// Limits from BulkScanEvaluateSyncRequestV3 / BulkScanEvaluationRequestV3 in the v3 spec.
const EVALUATE_PACKAGES_MAX_ARTIFACTS = 50;
const BULK_EVALUATE_MAX_ARTIFACTS = 10000;
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

const artifactScanEvaluateSchema: BodySchema = {
  description: "Re-evaluate one artifact against firewall policies. Provide exactly one of scanId or versionId.",
  fields: [
    { name: "scanId", type: "string", required: false, description: "Scan to re-evaluate (same as resource_id)" },
    { name: "versionId", type: "string", required: false, description: "Artifact version UUID to evaluate instead of a scan" },
  ],
};

const packagesEvaluateSchema = (max: number, withSkipCache: boolean): BodySchema => ({
  description: `Packages to check against one registry's firewall policies (1-${max}).`,
  fields: [
    { name: "registryId", type: "string", required: true, description: "Registry UUID (registry `uuid`, or `registryId` on a scan)" },
    { name: "artifacts", type: "array", required: true, description: "[{ packageName, version }]", itemType: "object" },
    ...(withSkipCache
      ? [{ name: "skipCache", type: "boolean" as const, required: false, description: "Ignore cached results" }]
      : []),
  ],
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const packagesEvaluateBody = (action: string, max: number, withSkipCache: boolean) =>
  (input: Record<string, unknown>): Record<string, unknown> => {
    const body = (input.body ?? {}) as Record<string, unknown>;
    // registry_id (param) and body.registryId are aliases; refuse to pick one silently when they disagree.
    if (input.registry_id != null && body.registryId != null && input.registry_id !== body.registryId) {
      throw new Error(`${action}: registry_id and body.registryId differ; pass only one`);
    }
    const registryId = input.registry_id ?? body.registryId;
    if (typeof registryId !== "string" || !UUID_RE.test(registryId)) {
      throw new Error(`${action} needs registryId as a registry UUID (registry \`uuid\`, or registryId on a scan)`);
    }
    if (withSkipCache && body.skipCache != null && typeof body.skipCache !== "boolean") {
      throw new Error(`${action}: skipCache must be a boolean`);
    }
    const artifacts = body.artifacts;
    if (!Array.isArray(artifacts) || artifacts.length === 0 || artifacts.length > max) {
      throw new Error(`${action} needs 1-${max} artifacts, each { packageName, version }`);
    }
    const normalized = artifacts.map((a, i) => {
      const art = (a ?? {}) as Record<string, unknown>;
      if (typeof art.packageName !== "string" || art.packageName === ""
        || typeof art.version !== "string" || art.version === "") {
        throw new Error(`${action}: artifacts[${i}] needs both packageName and version`);
      }
      return { packageName: art.packageName, version: art.version };
    });
    return {
      registryId,
      artifacts: normalized,
      ...(withSkipCache && body.skipCache != null ? { skipCache: body.skipCache } : {}),
    };
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

// The default `compactItems()` whitelist keeps only ids/timestamps here, dropping `packageName`, `version`,
// `scanStatus` and `exemptionStatus` — without them an agent can't tell what is blocked or whether it is
// already exempted. Verbose `policySets`/`buildDetails`/`rootPackages` are left to `get` (scan details).
const compactArtifactScanV3 = (item: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (item.id != null) { out.scan_id = item.id; out.id = item.id; }
  if (item.packageName != null) out.packageName = item.packageName;
  if (item.packageType != null) out.packageType = item.packageType;
  if (item.version != null) out.version = item.version;
  if (item.versionId != null) out.versionId = item.versionId;
  if (item.purl != null) out.purl = item.purl;
  if (item.scanStatus != null) out.scanStatus = item.scanStatus;
  if (item.securityViolationCategories != null) out.securityViolationCategories = item.securityViolationCategories;
  if (item.exemptionStatus != null) out.exemptionStatus = item.exemptionStatus;
  if (item.totalAffectedPipelines != null) out.totalAffectedPipelines = item.totalAffectedPipelines;
  if (item.registryId != null) out.registryId = item.registryId;
  if (item.registryName != null) out.registryName = item.registryName;
  if (item.parentRegistryId != null) out.parentRegistryId = item.parentRegistryId;
  if (item.parentRegistryName != null) out.parentRegistryName = item.parentRegistryName;
  // Backend emits these two with a capital R (see ArtifactScanV3 in the v3 spec).
  if (item.RegistryOrgId != null) out.RegistryOrgId = item.RegistryOrgId;
  if (item.RegistryProjectId != null) out.RegistryProjectId = item.RegistryProjectId;
  if (item.parentRegistryOrgId != null) out.parentRegistryOrgId = item.parentRegistryOrgId;
  if (item.parentRegistryProjectId != null) out.parentRegistryProjectId = item.parentRegistryProjectId;
  if (item.lastEvaluatedAt != null) out.lastEvaluatedAt = item.lastEvaluatedAt;
  if (item.lastEvaluatedBy != null) out.lastEvaluatedBy = item.lastEvaluatedBy;
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
 * Write operations included: on-demand artifact scan re-evaluation, and firewall exception
 * create/update/delete and approve/reject (account-scoped).
 * `x-internal: true` operations are excluded on purpose.
 */
export const registriesFirewallToolset: ToolsetDefinition = {
  name: "registries-firewall",
  displayName: "Artifact Registry Firewall (v3)",
  description:
    "Harness Artifact Registry v3 firewall — artifact scans with on-demand re-evaluation, pre-pull policy " +
    "checks for specific package versions (sync and bulk), and firewall exception " +
    "create/update/delete/approve/reject (account-scoped writes).",
  optIn: false,
  resources: [
    {
      resourceType: "artifact_scan",
      displayName: "Artifact Scan (v3)",
      description:
        "Firewall / policy scan results for artifacts. To list across every org and project, use " +
        "resource_scope=account with filter scope=descendants; without it only that level's registries are included. " +
        "Lists only BLOCKED/WARN scans of pulled versions; absence is not proof of safety, use evaluate_packages.",
      toolset: "registries-firewall",
      scope: "project",
      // org/project are optional on GetArtifactScansV3, and GetArtifactScanDetailsV3 takes neither. The backend
      // lists only the requested space's registries unless `scope=descendants` widens it to child spaces.
      supportedScopes: ["account", "org", "project"],
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["scan_id"],
      compactItem: compactArtifactScanV3,
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
          description: "Scan status filter. Only BLOCKED and WARN are accepted by the list API.",
          enum: V3_SCAN_LIST_STATUSES,
        },
        {
          name: "scope",
          description:
            "Which registries to include relative to the requested scope: none (default, that level only), " +
            "ancestors (plus parent levels), descendants (plus all child orgs/projects)",
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
          path: "/har/api/v3/scans/evaluate",
          // Re-running an evaluation only re-queues the same policy check, so a retry is harmless.
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            const scanId = input.scan_id ?? body?.scanId;
            const versionId = input.version_id ?? body?.versionId;
            if ((scanId == null) === (versionId == null)) {
              throw new Error("evaluate needs exactly one of scan_id (resource_id) or version_id");
            }
            return scanId != null ? { scanId } : { versionId };
          },
          // Response is `{ data: { status } }`; unwrap.
          responseExtractor: harV3DataObjectUnwrap,
          actionDescription:
            "Re-run the firewall policy evaluation for one artifact on demand, e.g. after a policy change, an " +
            "exemption, or to refresh fixVersionDetails. Pass exactly one of resource_id (scan_id) or " +
            "params.version_id. Asynchronous: returns a status (PENDING/PROCESSING/SUCCESS/FAILED) right away; " +
            "re-check the result with harness_get on the scan (lastEvaluatedAt, scanStatus, fixVersionDetails).",
          bodySchema: artifactScanEvaluateSchema,
        },
        evaluate_packages: {
          method: "POST",
          path: "/har/api/v3/scans/bulk-evaluate-sync",
          // The sync endpoint evaluates inline and writes nothing (BulkScanEvaluateSyncRequestV3).
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          bodyBuilder: packagesEvaluateBody("evaluate_packages", EVALUATE_PACKAGES_MAX_ARTIFACTS, true),
          // Response is `{ data: [ArtifactScanDetailsV3, ...] }`; project to `{ items, total }`.
          responseExtractor: harV3ScanEvaluationExtract,
          actionDescription:
            "Pre-pull check: would these exact versions pass the firewall, even if never pulled? Synchronous, " +
            "read-only; one scan detail per artifact (scanStatus, policySetFailureDetails, fixVersionDetails). " +
            "Over 50 artifacts: bulk_evaluate.",
          bodySchema: packagesEvaluateSchema(EVALUATE_PACKAGES_MAX_ARTIFACTS, true),
        },
        bulk_evaluate: {
          method: "POST",
          path: "/har/api/v3/scans/bulk-evaluate",
          // Queues an evaluation job that stores scan results; a retry would queue a second job.
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: packagesEvaluateBody("bulk_evaluate", BULK_EVALUATE_MAX_ARTIFACTS, false),
          // Response is `{ data: { evaluationId } }`; unwrap.
          responseExtractor: harV3DataObjectUnwrap,
          actionDescription:
            "Queue an async check of many versions (e.g. a lock file); stores scan results. Returns evaluationId; " +
            "poll harness_get bulk_scan_evaluation until status is SUCCESS or FAILURE.",
          bodySchema: packagesEvaluateSchema(BULK_EVALUATE_MAX_ARTIFACTS, false),
        },
      },
    },
    {
      resourceType: "bulk_scan_evaluation",
      displayName: "Bulk Scan Evaluation (v3)",
      description:
        "Result of artifact_scan bulk_evaluate: per-status counts plus the non-ALLOWED scans (capped).",
      toolset: "registries-firewall",
      scope: "project",
      // GetBulkScanEvaluationStatusV3 takes optional org/project, so poll at whatever scope bulk_evaluate used.
      supportedScopes: ["account", "org", "project"],
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["evaluation_id"],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/scans/bulk-evaluate/{evaluation_id}",
          pathParams: { evaluation_id: "evaluation_id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          // Response is `{ data: { evaluationId, status, scans, error } }` with up to 10000 scans; project to
          // per-status counts plus the non-ALLOWED scans (capped).
          responseExtractor: bulkScanEvaluationExtract,
          description: "Get bulk scan evaluation status (v3)",
        },
      },
    },
    {
      resourceType: "firewall_exception",
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
          responseExtractor: firewallExceptionListExtract,
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
      resourceType: "firewall_exception_version",
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
  ],
};
