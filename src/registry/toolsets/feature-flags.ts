import type { ToolsetDefinition, BodySchema } from "../types.js";
import { passthrough, fmeListExtract, fmeGetExtract, fmeV4PaginatedListExtract } from "../extractors.js";
import { isFmeHarnessNativeSelected, logFmeDeprecation, requireFmeIdentifier, requireHarnessNativeSegmentScope, resolveFmeDualMode } from "../scope-utils.js";

const fmeActionExtract = (raw: unknown) => {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) return raw;
  return { success: true, result: raw };
};

// The confirmed Harness-native FME v4 API (/fme/api/v4/...) does not use the
// standard NG orgIdentifier/projectIdentifier query param convention — it expects
// account_id/organization_identifier/project_identifier instead (confirmed live
// against qa.harness.io). Applied per-route (never resource-level) on dual-mode
// resources so the legacy Split.io branch's wire format stays untouched.
const FME_HARNESS_NATIVE_SCOPE_PARAMS = {
  account: "account_id",
  org: "organization_identifier",
  project: "project_identifier",
};

// Harness-native v4 create bodies (CreateFeatureFlagRequest/CreateSegmentRequest,
// confirmed against Harness_Split/Main) accept tags as [{name: string}]; callers
// commonly pass bare strings instead, so normalize the same way update already does.
function normalizeFmeTags(tags: unknown): unknown {
  return Array.isArray(tags) ? tags.map((t) => (typeof t === "string" ? { name: t } : t)) : tags;
}

const FME_SEGMENT_KINDS = ["STANDARD", "LARGE", "RULE_BASED"] as const;
type FmeSegmentKind = (typeof FME_SEGMENT_KINDS)[number];

function canonicalizeFmeSegmentKind(raw: unknown): FmeSegmentKind | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return FME_SEGMENT_KINDS.find((kind) => kind.toLowerCase() === trimmed.toLowerCase());
}

const FME_SEGMENT_TYPE_QUERY_PARAMS = { segment_type: "segment_type" } as const;
const fmeSegmentTypeParamsSchema = {
  fields: [
    {
      name: "segment_type",
      required: true,
      description: "Required. STANDARD | LARGE | RULE_BASED.",
    },
  ],
};

const FME_SEGMENT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
type FmeSegmentStatus = (typeof FME_SEGMENT_STATUSES)[number];

function canonicalizeFmeSegmentStatus(raw: unknown): FmeSegmentStatus | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return FME_SEGMENT_STATUSES.find((status) => status.toLowerCase() === trimmed.toLowerCase());
}

function applyFmeSegmentTypeQuery(input: Record<string, unknown>, operation: string): void {
  const raw = input.segment_type;
  if (raw === undefined || raw === null || raw === "") {
    throw new Error(
      `fme_segment.${operation}: segment_type is required (${FME_SEGMENT_KINDS.join(" | ")}).`,
    );
  }
  const kind = canonicalizeFmeSegmentKind(raw);
  if (kind === undefined) {
    throw new Error(
      `fme_segment.${operation}: invalid segment_type '${String(raw)}'. Must be one of: ${FME_SEGMENT_KINDS.join(", ")}.`,
    );
  }
  input.segment_type = kind;
}

function applyFmeOptionalStatusQuery(input: Record<string, unknown>, resource: string, operation: string): void {
  const raw = input.status;
  if (raw === undefined || raw === null || raw === "") return;
  const status = canonicalizeFmeSegmentStatus(raw);
  if (status === undefined) {
    throw new Error(
      `${resource}.${operation}: invalid status '${String(raw)}'. Must be one of: ${FME_SEGMENT_STATUSES.join(", ")}.`,
    );
  }
  input.status = status;
}

function resolveFmeCreateSegmentType(body: Record<string, unknown> | undefined): FmeSegmentKind {
  const primary = body?.segmentType;
  if (primary === undefined || primary === null || primary === "") {
    throw new Error(
      "fme_segment.create: segmentType is required (STANDARD | LARGE | RULE_BASED).",
    );
  }
  const kind = canonicalizeFmeSegmentKind(primary);
  if (kind === undefined) {
    throw new Error(
      `fme_segment.create: invalid segmentType '${String(primary)}'. Must be one of: ${FME_SEGMENT_KINDS.join(", ")}.`,
    );
  }
  return kind;
}

const fmeFeatureFlagUpdateSchema: BodySchema = {
  description: "Partial update for an FME feature flag's metadata. Provide the fields you want to change. Legacy mode (workspace_id): converted to JSON Patch (RFC 6902) automatically — description/tags/rolloutStatus only. Harness-native mode (org_id+project_id): sent as JSON Merge Patch (RFC 7396) — description/tags/owners/rolloutStatus; set description/tags/owners to null (or [] for tags/owners) to clear them, omit a field to leave it unchanged.",
  fields: [
    { name: "description", type: "string", required: false, description: "Updated description" },
    { name: "tags", type: "array", required: false, description: "Updated tags — provide as [{name: 'tag1'}] or ['tag1', 'tag2'] (strings are auto-wrapped)", itemType: "object" },
    { name: "owners", type: "array", required: false, description: "Harness-native mode only. Updated owners — each entry is {type: \"USER\", id or email} or {type: \"GROUP\", identifier}", itemType: "object" },
    { name: "rolloutStatus", type: "object", required: false, description: "Rollout status — provide as {id: '<uuid>'} (use fme_rollout_status to discover valid IDs)" },
  ],
};

const fmeFeatureFlagCreateSchema: BodySchema = {
  description: "Create a new feature flag. Legacy mode (workspace_id + traffic_type_id): name required, description optional — tags/owners not supported on create (the Split API has no create-time support; use harness_update after creation). Harness-native mode (org_id+project_id): name and trafficType required, description/tags/owners optional.",
  fields: [
    { name: "name", type: "string", required: true, description: "Feature flag name (must be unique within the workspace/project)" },
    { name: "description", type: "string", required: false, description: "Optional description of the feature flag" },
    { name: "trafficType", type: "string", required: false, description: "Traffic type name. Required in Harness-native (org_id+project_id) mode; also accepted as top-level traffic_type_id or traffic_type. Ignored in legacy mode (pass traffic_type_id as a path param there instead)" },
    { name: "tags", type: "array", required: false, description: "Harness-native mode only. Each entry is {name: string}; bare strings are accepted and auto-wrapped", itemType: "object" },
    { name: "owners", type: "array", required: false, description: "Harness-native mode only. Each entry is {type: \"USER\", id or email} or {type: \"GROUP\", identifier}", itemType: "object" },
  ],
};

const fmeFeatureFlagKillRestoreReallocateSchema: BodySchema = {
  description: "Optional comment and/or title recorded with the action. Both fields are accepted in legacy (workspace_id) and Harness-native (org_id+project_id) mode.",
  fields: [
    { name: "comment", type: "string", required: false, description: "Optional comment explaining the change" },
    { name: "title", type: "string", required: false, description: "Optional short title for the change" },
  ],
};

const fmeFeatureFlagArchiveSchema: BodySchema = {
  description: "Optional comment and/or title recorded with the action.",
  fields: [
    { name: "comment", type: "string", required: false, description: "Optional comment explaining the change" },
    { name: "title", type: "string", required: false, description: "Optional short title for the change" },
  ],
};

const fmeEnvironmentCreateSchema: BodySchema = {
  description:
    "Create an FME environment (Harness-native org_id+project_id only). name is required (max 15 characters). isProduction is optional (default false). production is accepted as an alias for isProduction.",
  fields: [
    { name: "name", type: "string", required: true, description: "Environment name (unique in the project; max 15 characters)" },
    { name: "isProduction", type: "boolean", required: false, description: "Whether this is a production environment. Optional; defaults to false on the backend if omitted." },
    { name: "production", type: "boolean", required: false, description: "Alias for isProduction." },
  ],
};

const fmeEnvironmentUpdateSchema: BodySchema = {
  description:
    "Partial environment update via JSON Merge Patch (RFC 7396), Harness-native only. name and isProduction are not clearable — omit to leave unchanged. production is accepted as an alias for isProduction.",
  fields: [
    { name: "name", type: "string", required: false, description: "Updated name; omit to leave unchanged. Blank names are rejected. Not clearable." },
    { name: "isProduction", type: "boolean", required: false, description: "Updated production flag. Omit to leave unchanged; not clearable." },
    { name: "production", type: "boolean", required: false, description: "Alias for isProduction." },
  ],
};

function fmeEnvironmentProduction(body: Record<string, unknown> | undefined): boolean | undefined {
  if (!body) return undefined;
  if (body.isProduction !== undefined && body.isProduction !== null) return Boolean(body.isProduction);
  if (body.production !== undefined && body.production !== null) return Boolean(body.production);
  return undefined;
}

/** MCP never had workspace_id get/create/update/delete for environments (#806 list-only). */
function resolveNativeOnlyEnvironmentRoute(
  input: Record<string, unknown>,
  operation: string,
  opts: { collection?: boolean; mergePatch?: boolean } = {},
) {
  const mode = resolveFmeDualMode(input, "fme_environment");
  if (mode.mode === "legacy") {
    throw new Error(
      `fme_environment.${operation}: Harness-native (org_id/project_id) only — MCP never supported workspace_id for this operation (list remains dual-mode).`,
    );
  }
  if (opts.collection) {
    return {
      path: "/fme/api/v4/environments",
      product: "harness" as const,
      scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
    };
  }
  const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_environment"));
  return {
    path: `/fme/api/v4/environments/${environmentId}`,
    product: "harness" as const,
    scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
    ...(opts.mergePatch ? { headers: { "Content-Type": "application/merge-patch+json" } } : {}),
  };
}

const fmeFeatureFlagDefinitionCreateSchema: BodySchema = {
  description: "Create a feature flag definition in a specific environment (initial treatments, rules, and default rule required)",
  fields: [
    { name: "treatments", type: "array", required: true, description: "Array of treatment objects with name (string) and optional configurations (JSON string). Required.", itemType: "object" },
    { name: "defaultTreatment", type: "string", required: true, description: "The treatment to serve when no rules match or the flag is killed. Must match a treatment name. Required." },
    { name: "defaultRule", type: "array", required: true, description: "Default rule buckets (treatment/size pairs) applied when no targeting rules match. Required.", itemType: "object" },
    { name: "rules", type: "array", required: false, description: "Targeting rules array — each rule has buckets (treatment/size pairs) and a condition (combiner + matchers)", itemType: "object" },
    { name: "baselineTreatment", type: "string", required: false, description: "The baseline (control) treatment for experimentation" },
    { name: "trafficAllocation", type: "number", required: false, description: "Percentage of traffic to include (0–100)" },
    { name: "comment", type: "string", required: false, description: "Comment describing the change" },
    { name: "title", type: "string", required: false, description: "Harness-native mode only. Optional definition title." },
  ],
};

const fmeFeatureFlagDefinitionUpdateSchema: BodySchema = {
  description: "Update a feature flag definition in a specific environment (treatments, rules, targeting, traffic allocation)",
  fields: [
    { name: "treatments", type: "array", required: false, description: "Array of treatment objects with name (string) and optional configurations (JSON string)", itemType: "object" },
    { name: "defaultTreatment", type: "string", required: false, description: "The treatment to serve when no rules match or the flag is killed" },
    { name: "baselineTreatment", type: "string", required: false, description: "The baseline (control) treatment for experimentation" },
    { name: "rules", type: "array", required: false, description: "Targeting rules array — each rule has buckets (treatment/size pairs) and a condition (combiner + matchers)", itemType: "object" },
    { name: "defaultRule", type: "array", required: false, description: "Default rule buckets (treatment/size pairs) applied when no targeting rules match", itemType: "object" },
    { name: "trafficAllocation", type: "number", required: false, description: "Percentage of traffic to include (0–100)" },
    { name: "comment", type: "string", required: false, description: "Comment describing the change" },
    { name: "title", type: "string", required: false, description: "Harness-native mode only. Optional definition title." },
  ],
};

const fmeRbsCreateSchema: BodySchema = {
  description: "Create a new rule-based segment in a workspace",
  fields: [
    { name: "name", type: "string", required: true, description: "Segment name" },
    { name: "description", type: "string", required: false, description: "Optional segment description" },
  ],
};

const fmeSegmentCreateSchema: BodySchema = {
  description: "Create a new segment. name, trafficType, and segmentType are required; description/tags/owners are optional.",
  fields: [
    { name: "name", type: "string", required: true, description: "Segment name (must be unique within the project)" },
    { name: "segmentType", type: "string", required: true, description: "Required. STANDARD | LARGE | RULE_BASED." },
    { name: "description", type: "string", required: false, description: "Optional description of the segment" },
    { name: "trafficType", type: "string", required: true, description: "Traffic type name" },
    { name: "tags", type: "array", required: false, description: "Each entry is {name: string}; bare strings are accepted and auto-wrapped", itemType: "object" },
    { name: "owners", type: "array", required: false, description: "Each entry is {type: \"USER\", id or email} or {type: \"GROUP\", identifier}", itemType: "object" },
  ],
};

const fmeSegmentUpdateSchema: BodySchema = {
  description: "Partial segment update. Omit a field to leave it unchanged; set description/tags/owners to null (or [] for tags/owners) to clear.",
  fields: [
    { name: "description", type: "string", required: false, description: "Updated description; null clears it" },
    { name: "tags", type: "array", required: false, description: "Updated tags — [{name: 'tag1'}] or ['tag1']; null or [] clears", itemType: "object" },
    { name: "owners", type: "array", required: false, description: "Updated owners — {type: \"USER\", id or email} or {type: \"GROUP\", identifier}; null or [] clears", itemType: "object" },
  ],
};

const fmeSegmentDefinitionKeysAddSchema: BodySchema = {
  description: "Add or replace membership keys on a segment definition. Body.keys is required (empty allowed only with replace=true). Optional comment/title.",
  fields: [
    { name: "keys", type: "array", required: true, description: "Identity keys to add (or the full set when replace=true). Max 10000.", itemType: "string" },
    { name: "comment", type: "string", required: false, description: "Optional comment recorded with the change" },
    { name: "title", type: "string", required: false, description: "Optional short title for the change" },
  ],
};

const fmeSegmentDefinitionKeysRemoveSchema: BodySchema = {
  description: "Remove membership keys from a segment definition. Body.keys must contain at least one key. Optional comment/title.",
  fields: [
    { name: "keys", type: "array", required: true, description: "Identity keys to remove (min 1, max 10000)", itemType: "string" },
    { name: "comment", type: "string", required: false, description: "Optional comment recorded with the change" },
    { name: "title", type: "string", required: false, description: "Optional short title for the change" },
  ],
};

function fmeSegmentDefinitionKeysBody(input: Record<string, unknown>, opts: { requireNonEmpty: boolean }): Record<string, unknown> {
  const body = input.body as Record<string, unknown> | undefined;
  const keys = body?.keys;
  const replace = input.replace === true || input.replace === "true";
  if (!Array.isArray(keys) || (opts.requireNonEmpty && keys.length === 0)) {
    throw new Error(
      opts.requireNonEmpty
        ? "fme_segment_definition.remove_keys requires body.keys with at least one key."
        : "fme_segment_definition.add_keys requires body.keys (array; empty only when replace=true).",
    );
  }
  if (!opts.requireNonEmpty && keys.length === 0 && !replace) {
    throw new Error("fme_segment_definition.add_keys requires body.keys (array; empty only when replace=true).");
  }
  return {
    keys,
    ...(body?.comment !== undefined ? { comment: body.comment } : {}),
    ...(body?.title !== undefined ? { title: body.title } : {}),
  };
}

const fmeSegmentDefinitionCreateSchema: BodySchema = {
  description: "Create a segment definition in an environment. Omit the body (or send {}) to create an empty/default shell.",
  fields: [{ name: "description", type: "string", required: false, description: "Optional description for the definition" }],
};

const fmeSegmentDefinitionUpdateSchema: BodySchema = {
  description: "Update a segment definition. description is the only mutable field: omit it to leave unchanged, pass null to clear it, or a string to set it.",
  fields: [{ name: "description", type: "string", required: false, description: "Omit to keep the current value, null to clear it, or a string to set it" }],
};

const fmeRbsUpdateDefinitionSchema: BodySchema = {
  description: "Update a rule-based segment definition in an environment. Rules use: {condition: {combiner: 'AND', matchers: [{type, attribute, ...}]}}. Matcher types: IN_LIST_STRING (strings:[]), GREATER_THAN_OR_EQUAL_NUMBER (number:N), LESS_THAN_OR_EQUAL_NUMBER (number:N), BETWEEN_NUMBER (between:{from,to}), BOOLEAN (bool:true/false), ON_DATE (date:ms), IN_SPLIT (depends:{splitName,treatment}). Combiner values: AND, OR.",
  fields: [
    { name: "title", type: "string", required: false, description: "Segment title" },
    { name: "comment", type: "string", required: false, description: "Comment about the change" },
    { name: "rules", type: "array", required: false, description: "Targeting rules. Each: {condition: {combiner: 'AND'|'OR', matchers: [{type: 'IN_LIST_STRING', attribute: 'field', strings: [...]}]}}", itemType: "object" },
    { name: "excludedKeys", type: "array", required: false, description: "User keys to exclude from the segment", itemType: "string" },
    { name: "excludedSegments", type: "array", required: false, description: "Segments to exclude. Each: {name: 'segment_name', type: 'standard_segment'|'rule_based_segment'}", itemType: "object" },
  ],
};

const fmeIdentityUpdateSchema: BodySchema = {
  description: "Update identity attributes. Body: {values: {attr: value}}. The 'values' object is a flat map of attribute names to values (e.g. {name: 'Display Name', plan: 'enterprise'}). Only provided attributes are updated; others are preserved.",
  fields: [
    { name: "values", type: "object", required: true, description: "Flat map of attribute names to values. Use 'name' key for display name. Only provided keys are updated." },
  ],
};

const fmeSegmentKeysUpdateSchema: BodySchema = {
  description: "Add keys to a standard segment. The Split Admin API only supports adding keys; removal requires the UI or a different API version.",
  fields: [
    { name: "add", type: "array", required: true, description: "Keys to add to the segment (string array of identity keys)", itemType: "string" },
    { name: "comment", type: "string", required: false, description: "Comment describing the change (metadata only, not sent to API)" },
  ],
};

const fmeRbsChangeRequestSchema: BodySchema = {
  description: "Create a change request for a rule-based segment definition",
  fields: [
    { name: "title", type: "string", required: true, description: "Change request title" },
    { name: "operationType", type: "string", required: true, description: "Change operation type (e.g. UPDATE)" },
    { name: "comment", type: "string", required: false, description: "Optional comment for the change request" },
    { name: "approvers", type: "array", required: false, description: "Email(s) of approver(s)", itemType: "string" },
    {
      name: "ruleBasedSegment", type: "object", required: true, description: "The segment definition to apply",
      fields: [
        { name: "title", type: "string", required: false, description: "Segment title" },
        { name: "rules", type: "array", required: false, description: "Targeting rules", itemType: "object" },
        { name: "excludedKeys", type: "array", required: false, description: "Keys to exclude", itemType: "string" },
        { name: "excludedSegments", type: "array", required: false, description: "Segments to exclude", itemType: "object" },
        { name: "comment", type: "string", required: false, description: "Segment comment" },
      ],
    },
  ],
};

function resolveNativeOnlyDefinitionRoute(
  input: Record<string, unknown>,
  operation: string,
  opts: { collection?: boolean; suffix?: string } = {},
) {
  const mode = resolveFmeDualMode(input, "fme_feature_flag_definition");
  if (mode.mode === "legacy") {
    throw new Error(
      `fme_feature_flag_definition.${operation}: Harness-native (org_id/project_id) only — pass org_id+project_id instead of workspace_id.`,
    );
  }

  if (opts.collection) {
    requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag_definition");
    return {
      path: "/fme/api/v4/feature-flag-definitions",
      product: "harness" as const,
      scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
    };
  }

  const flagName = encodeURIComponent(
    requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag_definition"),
  );
  requireFmeIdentifier(input, "environment_id", "fme_feature_flag_definition");
  return {
    path: `/fme/api/v4/feature-flag-definitions/${flagName}${opts.suffix ?? ""}`,
    product: "harness" as const,
    scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
  };
}

export const featureFlagsToolset: ToolsetDefinition = {
  name: "feature-flags",
  displayName: "Feature Management & Experimentation",
  description:
    "Harness FME — feature flags, segments, environments, and rollout statuses. " +
    "Two mutually exclusive scoping modes: legacy workspace_id (Split.io API) or " +
    "Harness-native org_id+project_id. If you already have org_id and project_id, use " +
    "them directly and skip fme_workspace entirely — org/project fully identify scope " +
    "on their own; there is no need to look up a workspace first.",
  resources: [
    // ── FME Resources (Split.io API at https://api.split.io) ───────────
    // These use account scope to avoid injecting orgIdentifier/projectIdentifier
    // which Split.io does not use. Auth is via Bearer token (HARNESS_FME_API_KEY,
    // or a non-placeholder HARNESS_API_KEY fallback for self-hosted sessions).
    {
      resourceType: "fme_workspace",
      displayName: "FME Workspace",
      description:
        "Feature Management workspace — legacy Split.io concept only, used solely to discover a " +
        "workspace_id for other fme_* resources' deprecated legacy calls. Not used by Harness-native " +
        "calls at all: if you already have org_id and project_id, skip this resource entirely and " +
        "pass them directly to the fme_* resource you actually want. Supports list with pagination " +
        "(offset/size, default 20, max 1000).",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id"],
      product: "fme",
      listFilterFields: [
        { name: "offset", description: "Pagination offset for feature flag workspaces", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/workspaces",
          routeResolver: (input) => {
            if (isFmeHarnessNativeSelected(input, "fme_workspace.list")) {
              throw new Error(
                "fme_workspace: this resource has no Harness-native equivalent — it exists only to discover workspace_id values for the deprecated legacy contract.",
              );
            }
            logFmeDeprecation(
              "[DEPRECATION] fme_workspace: this resource and the workspace_id contract it supports are deprecated.",
            );
            return { path: "/internal/api/v2/workspaces" };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            offset: "offset",
            size: "limit",
          },
          responseExtractor: passthrough,
          description: "List FME workspaces with pagination (offset and size params, max 1000)",
        },
      },
    },
    {
      resourceType: "fme_environment",
      displayName: "FME Environment",
      description:
        "Feature Management environment. Dual-mode list (workspace_id or org_id+project_id). get/create/update/delete are Harness-native only. Native create/update use isProduction (production accepted as an alias). Native PATCH is JSON Merge Patch; name and isProduction are not clearable. Name max 15 characters. Delete returns 400 hasDependents while SDK API keys (always created with a new env), flags, or segments remain.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id", "environment_id"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from harness_list resource_type=fme_workspace). Deprecated — omit and pass org_id+project_id instead for Harness-native scoping." },
        { name: "offset", description: "Harness-native pagination offset (default 0)", type: "number" },
        { name: "limit", description: "Harness-native page size (default 100, max 100)", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_environment");
            if (mode.mode === "legacy") {
              return { path: `/internal/api/v2/environments/ws/${encodeURIComponent(mode.workspaceId)}` };
            }
            return { path: "/fme/api/v4/environments", product: "harness", scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { offset: "offset", size: "limit", limit: "limit" },
          responseExtractor: fmeV4PaginatedListExtract,
          description: "List FME environments for a workspace (legacy) or org_id+project_id project (Harness-native). Native envelope {data, limit, offset, totalCount} is promoted to items/total; harness_list size maps to limit.",
        },
        get: {
          method: "GET",
          path: "",
          routeResolver: (input) => resolveNativeOnlyEnvironmentRoute(input, "get"),
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description:
            "Get a single environment by environment_id (UUID from list). Harness-native only (org_id+project_id). MCP never supported workspace_id get.",
        },
        create: {
          method: "POST",
          path: "",
          routeResolver: (input) => resolveNativeOnlyEnvironmentRoute(input, "create", { collection: true }),
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            const production = fmeEnvironmentProduction(body);
            return {
              name: body?.name,
              ...(production !== undefined ? { isProduction: production } : {}),
            };
          },
          responseExtractor: passthrough,
          bodySchema: fmeEnvironmentCreateSchema,
          description:
            "Create an environment (Harness-native only). Body requires name (max 15 characters). Optional isProduction (CreateEnvironmentRequest). NG scope is not injected into the JSON.",
        },
        update: {
          method: "PATCH",
          path: "",
          routeResolver: (input) => resolveNativeOnlyEnvironmentRoute(input, "update", { mergePatch: true }),
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            if (!body) return {};
            const production = fmeEnvironmentProduction(body);
            return {
              ...(typeof body.name === "string" ? { name: body.name } : {}),
              ...(production !== undefined ? { isProduction: production } : {}),
            };
          },
          responseExtractor: passthrough,
          bodySchema: fmeEnvironmentUpdateSchema,
          description:
            "Update an environment by environment_id (Harness-native only). JSON Merge Patch on name and isProduction (not clearable).",
        },
        delete: {
          method: "DELETE",
          path: "",
          routeResolver: (input) => resolveNativeOnlyEnvironmentRoute(input, "delete"),
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description:
            "Delete (archive) an environment by environment_id (Harness-native only). Returns 400 hasDependents while SDK API keys, flags, or segments still target it. Create via EnvironmentStarterKit always provisions client/server API keys, so a brand-new environment cannot be deleted until those keys are removed.",
        },
      },
    },
    {
      resourceType: "fme_feature_flag",
      displayName: "FME Feature Flag",
      description:
        "Feature flag. Dual-mode scoping: pass org_id+project_id (Harness-native, preferred — no " +
        "workspace lookup needed) or the deprecated workspace_id (Split.io API). Both modes support " +
        "list/get/create/delete/update/kill/restore/reallocate/archive/unarchive. List supports " +
        "filtering (name, tags, rollout_status_id) and pagination (offset/size, default 20, max 50).",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id", "feature_flag_name"],
      product: "fme",
      deepLinkTemplate: "/ng/account/{accountId}/module/fme/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/resources/targets/{trafficTypeId}/splits/{id}",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from harness_list resource_type=fme_workspace). Deprecated — omit and pass org_id+project_id instead for Harness-native scoping." },
        { name: "offset", description: "Pagination offset for FME feature flags", type: "number" },
        { name: "rollout_status_id", description: "Filter by rollout status UUID (use fme_rollout_status to discover valid IDs)", type: "string" },
        { name: "name", description: "Filter flags by name (partial match)", type: "string" },
        { name: "tags", description: "Filter flags by tag", type: "string" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            if (mode.mode === "legacy") {
              return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}` };
            }
            return { path: "/fme/api/v4/feature-flags", product: "harness", scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            offset: "offset",
            size: "limit",
            rollout_status_id: "rolloutStatus",
            name: "name",
            tags: "tag",
          },
          responseExtractor: fmeListExtract,
          description:
            "List feature flags by workspace_id (legacy, deprecated) or org_id+project_id (Harness-native), with filtering and pagination (offset and size params, max 50).",
        },
        get: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            if (mode.mode === "legacy") {
              return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}` };
            }
            return { path: `/fme/api/v4/feature-flags/${flagName}`, product: "harness", scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: fmeGetExtract,
          description: "Get a specific feature flag's metadata without requiring an environment (legacy: workspace_id; Harness-native: org_id+project_id).",
        },
        create: {
          method: "POST",
          path: "/internal/api/v2/splits/ws/{wsId}/trafficTypes/{trafficTypeId}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            if (mode.mode === "harness_native") {
              return { path: "/fme/api/v4/feature-flags", product: "harness", scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS };
            }
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/trafficTypes/${encodeURIComponent(requireFmeIdentifier(input, "traffic_type_id", "fme_feature_flag"))}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { workspace_id: "wsId", traffic_type_id: "trafficTypeId" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            if (isFmeHarnessNativeSelected(input, "fme_feature_flag")) {
              const trafficType = (body?.trafficType ?? input.traffic_type_id ?? input.traffic_type ?? body?.traffic_type) as string | undefined;
              if (!trafficType) {
                throw new Error(
                  'fme_feature_flag.create: "trafficType" is required in Harness-native mode — pass body.trafficType, traffic_type_id, or traffic_type.',
                );
              }
              const name = body?.name ?? input.name;
              if (!name) {
                throw new Error(
                  'fme_feature_flag.create: "name" is required in Harness-native mode — pass body.name.',
                );
              }
              return {
                name,
                trafficType,
                ...(body?.description !== undefined ? { description: body.description } : {}),
                ...(body?.tags !== undefined ? { tags: normalizeFmeTags(body.tags) } : {}),
                ...(body?.owners !== undefined ? { owners: body.owners } : {}),
              };
            }
            return {
              name: body?.name ?? input.name,
              ...(body?.description || input.description ? { description: body?.description ?? input.description } : {}),
            };
          },
          responseExtractor: passthrough,
          bodySchema: fmeFeatureFlagCreateSchema,
          description: "Create a feature flag. Legacy mode (workspace_id): requires workspace_id + traffic_type_id (get from fme_traffic_type); body: name, optional description (no tags/owners — use harness_update after creation). Harness-native mode (org_id+project_id): body requires name + trafficType (or pass traffic_type_id / traffic_type at top level), optional description/tags/owners.",
        },
        delete: {
          method: "DELETE",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            if (mode.mode === "legacy") {
              return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}` };
            }
            return { path: `/fme/api/v4/feature-flags/${flagName}`, product: "harness", scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS };
          },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete a feature flag from a workspace (legacy) or org_id+project_id-scoped project (Harness-native)",
        },
        update: {
          method: "PATCH",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            if (mode.mode === "harness_native") {
              return {
                path: `/fme/api/v4/feature-flags/${flagName}`,
                product: "harness",
                scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
                headers: { "Content-Type": "application/merge-patch+json" },
              };
            }
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            if (isFmeHarnessNativeSelected(input, "fme_feature_flag")) {
              // JSON Merge Patch (RFC 7396): omit a field to leave it unchanged, set it to update,
              // or (for description/tags/owners) set it to null/[] to clear it. rolloutStatus is
              // set-only — the backend rejects an explicit null for it.
              if (!body) return {};
              return {
                ...(body.description !== undefined ? { description: body.description } : {}),
                ...(body.tags !== undefined ? { tags: body.tags === null ? null : normalizeFmeTags(body.tags) } : {}),
                ...(body.owners !== undefined ? { owners: body.owners } : {}),
                ...(body.rolloutStatus !== undefined ? { rolloutStatus: body.rolloutStatus } : {}),
              };
            }
            if (!body) return [];
            const ops: Array<{ op: string; path: string; value: unknown }> = [];
            if (body.description !== undefined) {
              ops.push({ op: "replace", path: "/description", value: body.description });
            }
            if (body.tags !== undefined) {
              const rawTags = body.tags as unknown[];
              const tags = Array.isArray(rawTags)
                ? rawTags.map((t) => (typeof t === "string" ? { name: t } : t))
                : rawTags;
              ops.push({ op: "replace", path: "/tags", value: tags });
            }
            if (body.rolloutStatus !== undefined) {
              const rs = body.rolloutStatus as Record<string, unknown>;
              if (rs && rs.id) {
                ops.push({ op: "replace", path: "/rolloutStatus/id", value: rs.id });
              }
            }
            return ops;
          },
          responseExtractor: passthrough,
          description: "Update a feature flag's metadata. Legacy mode (workspace_id): description/tags/rolloutStatus via JSON Patch (RFC 6902) — provide fields directly, they're converted to patch ops automatically. Harness-native mode (org_id+project_id): description/tags/owners/rolloutStatus via JSON Merge Patch (RFC 7396) — omit a field to leave it unchanged, set it to update, or set description/tags/owners to null (or [] for tags/owners) to clear it; rolloutStatus is set-only (no null).",
          bodySchema: fmeFeatureFlagUpdateSchema,
        },
      },
      executeActions: {
        kill: {
          method: "PUT",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}/kill",
          methodBuilder: (input) => (isFmeHarnessNativeSelected(input, "fme_feature_flag") ? "POST" : "PUT"),
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_feature_flag"));
            if (mode.mode === "harness_native") {
              return {
                path: `/fme/api/v4/feature-flag-definitions/${flagName}/kill`,
                product: "harness",
                scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
              };
            }
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/environments/${environmentId}/kill` };
          },
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          queryParams: { environment_id: "environment_id" },
          bodyBuilder: (input) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              ...(body.comment !== undefined ? { comment: body.comment } : {}),
              ...(body.title !== undefined ? { title: body.title } : {}),
            };
          },
          responseExtractor: fmeActionExtract,
          actionDescription:
            "Kill (turn off) a feature flag in a specific environment. Requires feature_flag_name and environment_id, plus workspace_id (legacy) or org_id+project_id (Harness-native). Optional comment/title recorded with the change.",
          bodySchema: fmeFeatureFlagKillRestoreReallocateSchema,
        },
        restore: {
          method: "PUT",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}/restore",
          methodBuilder: (input) => (isFmeHarnessNativeSelected(input, "fme_feature_flag") ? "POST" : "PUT"),
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_feature_flag"));
            if (mode.mode === "harness_native") {
              return {
                path: `/fme/api/v4/feature-flag-definitions/${flagName}/restore`,
                product: "harness",
                scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
              };
            }
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/environments/${environmentId}/restore` };
          },
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          queryParams: { environment_id: "environment_id" },
          bodyBuilder: (input) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              ...(body.comment !== undefined ? { comment: body.comment } : {}),
              ...(body.title !== undefined ? { title: body.title } : {}),
            };
          },
          responseExtractor: fmeActionExtract,
          actionDescription:
            "Restore (re-enable) a killed feature flag in a specific environment. Requires feature_flag_name and environment_id, plus workspace_id (legacy) or org_id+project_id (Harness-native). Optional comment/title recorded with the change.",
          bodySchema: fmeFeatureFlagKillRestoreReallocateSchema,
        },
        reallocate: {
          method: "POST",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}/reallocate",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_feature_flag"));
            if (mode.mode === "harness_native") {
              return {
                path: `/fme/api/v4/feature-flag-definitions/${flagName}/reallocate`,
                product: "harness",
                scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
              };
            }
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/environments/${environmentId}/reallocate` };
          },
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          queryParams: { environment_id: "environment_id" },
          bodyBuilder: (input) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              ...(body.comment !== undefined ? { comment: body.comment } : {}),
              ...(body.title !== undefined ? { title: body.title } : {}),
            };
          },
          responseExtractor: fmeActionExtract,
          actionDescription:
            "Reallocate traffic across treatments for a feature flag in a specific environment, without a full targeting-rules update. Requires feature_flag_name and environment_id, plus workspace_id (legacy) or org_id+project_id (Harness-native). Optional comment/title recorded with the change.",
          bodySchema: fmeFeatureFlagKillRestoreReallocateSchema,
        },
        archive: {
          method: "POST",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/archive",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            if (mode.mode === "harness_native") {
              return {
                path: `/fme/api/v4/feature-flags/${flagName}/archive`,
                product: "harness",
                scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
              };
            }
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/archive` };
          },
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          bodyBuilder: (input) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              ...(body.comment !== undefined ? { comment: body.comment } : {}),
              ...(body.title !== undefined ? { title: body.title } : {}),
            };
          },
          responseExtractor: fmeActionExtract,
          actionDescription:
            "Archive a feature flag. Requires feature_flag_name, plus workspace_id (legacy) or org_id+project_id (Harness-native). Subject to OPA policy checks (409 on failure). Optional comment/title recorded with the change.",
          bodySchema: fmeFeatureFlagArchiveSchema,
        },
        unarchive: {
          method: "POST",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/unarchive",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            if (mode.mode === "harness_native") {
              return {
                path: `/fme/api/v4/feature-flags/${flagName}/unarchive`,
                product: "harness",
                scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
              };
            }
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/unarchive` };
          },
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          bodyBuilder: (input) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              ...(body.comment !== undefined ? { comment: body.comment } : {}),
              ...(body.title !== undefined ? { title: body.title } : {}),
            };
          },
          responseExtractor: fmeActionExtract,
          actionDescription:
            "Unarchive a previously archived feature flag. Requires feature_flag_name, plus workspace_id (legacy) or org_id+project_id (Harness-native). Returns 409 if the flag has dependent objects. Optional comment/title recorded with the change.",
          bodySchema: fmeFeatureFlagArchiveSchema,
        },
      },
    },
    {
      resourceType: "fme_feature_flag_definition",
      displayName: "FME Feature Flag Definition",
      description:
        "Detailed definition of a feature flag in a specific environment: treatments, rules, targeting, and traffic allocation. Create requires treatments, defaultTreatment, and defaultRule. Get/create/update: pass org_id+project_id (preferred) or the deprecated workspace_id. List/delete/kill/restore/reallocate: org_id+project_id only. Native list requires feature_flag_name and uses offset/limit (max 100); it does not take environment_id. Other ops require environment_id. Kill/restore/reallocate are the same actions as on fme_feature_flag; either resource works.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id", "environment_id", "feature_flag_name"],
      product: "fme",
      listFilterFields: [
        { name: "feature_flag_name", description: "Feature flag name whose definitions to list. Required.", required: true },
        { name: "offset", description: "Pagination offset (default 0)", type: "number" },
        { name: "limit", description: "Page size (default 100, max 100)", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => resolveNativeOnlyDefinitionRoute(input, "list", { collection: true }),
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { feature_flag_name: "feature_flag_name", offset: "offset", limit: "limit" },
          responseExtractor: passthrough,
          description:
            "List feature flag definitions for a flag across environments (org_id+project_id only). Requires feature_flag_name. Pagination uses offset and limit (default 100, max 100). Do not pass environment_id.",
        },
        get: {
          method: "GET",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag_definition");
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag_definition"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_feature_flag_definition"));
            if (mode.mode === "harness_native") {
              return { path: `/fme/api/v4/feature-flag-definitions/${flagName}`, product: "harness", scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS };
            }
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/environments/${environmentId}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          queryParams: { environment_id: "environment_id" },
          responseExtractor: passthrough,
          description:
            "Get a feature flag definition in a specific environment (treatments, rules, default rule, traffic allocation). Requires feature_flag_name and environment_id. Pass org_id+project_id (preferred) or deprecated workspace_id.",
        },
        create: {
          method: "POST",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag_definition");
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag_definition"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_feature_flag_definition"));
            if (mode.mode === "harness_native") {
              return { path: `/fme/api/v4/feature-flag-definitions/${flagName}`, product: "harness", scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS };
            }
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/environments/${environmentId}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          queryParams: { environment_id: "environment_id" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          bodySchema: fmeFeatureFlagDefinitionCreateSchema,
          description:
            "Create a feature flag definition in a specific environment. Requires treatments (array of treatment objects), defaultTreatment (string matching a treatment name), and defaultRule (array of bucket objects). Optional: rules, baselineTreatment, trafficAllocation, comment, title (Harness-native only). Requires feature_flag_name and environment_id. Pass org_id+project_id (preferred) or deprecated workspace_id.",
        },
        update: {
          method: "PUT",
          methodBuilder: (input) => (isFmeHarnessNativeSelected(input, "fme_feature_flag_definition") ? "PATCH" : "PUT"),
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag_definition");
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag_definition"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_feature_flag_definition"));
            if (mode.mode === "harness_native") {
              return {
                path: `/fme/api/v4/feature-flag-definitions/${flagName}`,
                product: "harness",
                scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
                headers: { "Content-Type": "application/merge-patch+json" },
              };
            }
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/environments/${environmentId}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          queryParams: { environment_id: "environment_id" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          bodySchema: fmeFeatureFlagDefinitionUpdateSchema,
          description:
            "Update a feature flag definition in a specific environment (treatments, rules, default rule, traffic allocation, baseline treatment). Requires feature_flag_name and environment_id. Pass org_id+project_id (preferred) or deprecated workspace_id. Native update is JSON Merge Patch: omit a field to leave it unchanged; treatments/rules/defaultRule are omit-to-keep but reject explicit null (not clearable). Legacy update is a full replace.",
        },
        delete: {
          method: "DELETE",
          path: "",
          routeResolver: (input) => resolveNativeOnlyDefinitionRoute(input, "delete"),
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          queryParams: { environment_id: "environment_id" },
          responseExtractor: passthrough,
          description:
            "Delete a feature flag definition in an environment (org_id+project_id only). Requires feature_flag_name and environment_id.",
        },
      },
      executeActions: {
        kill: {
          method: "POST",
          path: "",
          routeResolver: (input) => resolveNativeOnlyDefinitionRoute(input, "kill", { suffix: "/kill" }),
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          queryParams: { environment_id: "environment_id" },
          bodyBuilder: (input) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              ...(body.comment !== undefined ? { comment: body.comment } : {}),
              ...(body.title !== undefined ? { title: body.title } : {}),
            };
          },
          responseExtractor: fmeActionExtract,
          actionDescription:
            "Kill (turn off) a feature flag definition in an environment (org_id+project_id only). Requires feature_flag_name and environment_id. Optional body comment/title. Same action as fme_feature_flag kill.",
          bodySchema: fmeFeatureFlagKillRestoreReallocateSchema,
        },
        restore: {
          method: "POST",
          path: "",
          routeResolver: (input) => resolveNativeOnlyDefinitionRoute(input, "restore", { suffix: "/restore" }),
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          queryParams: { environment_id: "environment_id" },
          bodyBuilder: (input) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              ...(body.comment !== undefined ? { comment: body.comment } : {}),
              ...(body.title !== undefined ? { title: body.title } : {}),
            };
          },
          responseExtractor: fmeActionExtract,
          actionDescription:
            "Restore a killed feature flag definition in an environment (org_id+project_id only). Requires feature_flag_name and environment_id. Optional body comment/title. Same action as fme_feature_flag restore.",
          bodySchema: fmeFeatureFlagKillRestoreReallocateSchema,
        },
        reallocate: {
          method: "POST",
          path: "",
          routeResolver: (input) => resolveNativeOnlyDefinitionRoute(input, "reallocate", { suffix: "/reallocate" }),
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          queryParams: { environment_id: "environment_id" },
          bodyBuilder: (input) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              ...(body.comment !== undefined ? { comment: body.comment } : {}),
              ...(body.title !== undefined ? { title: body.title } : {}),
            };
          },
          responseExtractor: fmeActionExtract,
          actionDescription:
            "Reallocate traffic across treatments for a feature flag definition in an environment (org_id+project_id only). Requires feature_flag_name and environment_id. Optional body comment/title. Same action as fme_feature_flag reallocate.",
          bodySchema: fmeFeatureFlagKillRestoreReallocateSchema,
        },
      },
    },
    {
      resourceType: "fme_rollout_status",
      displayName: "FME Rollout Status",
      description:
        "Rollout status definitions (e.g. Killed, Permanent, Ramping). Dual-mode: pass org_id+project_id (preferred) or the deprecated workspace_id. Use harness_list to discover rollout_status_id UUIDs for filtering fme_feature_flag lists. Pagination uses offset/limit (max 100; harness_list size maps to limit).",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from fme_workspace). Deprecated — omit and pass org_id+project_id instead for Harness-native scoping." },
        { name: "offset", description: "Harness-native pagination offset (default 0)", type: "number" },
        { name: "limit", description: "Harness-native page size (default 100, max 100)", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_rollout_status");
            if (mode.mode === "legacy") {
              return { path: `/internal/api/v2/rolloutStatuses/ws/${encodeURIComponent(mode.workspaceId)}` };
            }
            return { path: "/fme/api/v4/rollout-statuses", product: "harness", scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { offset: "offset", size: "limit", limit: "limit" },
          responseExtractor: fmeV4PaginatedListExtract,
          description:
            "List rollout statuses. Pass org_id+project_id (preferred) or deprecated workspace_id. Optional offset/limit (harness_list size maps to limit).",
        },
      },
    },
    // ── FME Rule-Based Segments ───────────────────────────────────────────
    {
      resourceType: "fme_rule_based_segment",
      displayName: "(Deprecated) FME Rule-Based Segment",
      description:
        "Deprecated — use fme_segment instead for new integrations. Rule-based segment in a workspace. Supports list, get, create (requires traffic_type_id), and delete via the legacy workspace_id contract only — org_id+project_id (Harness-native) is rejected on every operation here in favor of fme_segment. Create requires traffic_type_id passed via params.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id", "segment_name"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from fme_workspace). This resource only supports the legacy workspace_id contract; use fme_segment for Harness-native org_id+project_id scoping." },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_rule_based_segment");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_rule_based_segment.list: Harness-native (org_id/project_id) mode is not supported on this deprecated resource — use fme_segment instead.",
              );
            }
            return { path: `/internal/api/v2/rule-based-segments/ws/${encodeURIComponent(mode.workspaceId)}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "List all rule-based segments in a workspace",
        },
        get: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_rule_based_segment");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_rule_based_segment.get: Harness-native (org_id/project_id) mode is not supported on this deprecated resource — use fme_segment instead.",
              );
            }
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_rule_based_segment"));
            return { path: `/internal/api/v2/rule-based-segments/ws/${encodeURIComponent(mode.workspaceId)}/${segmentName}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get a rule-based segment by name (workspace-level metadata)",
        },
        create: {
          method: "POST",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_rule_based_segment");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_rule_based_segment.create: Harness-native (org_id/project_id) mode is not supported on this deprecated resource — use fme_segment instead.",
              );
            }
            return { path: `/internal/api/v2/rule-based-segments/ws/${encodeURIComponent(mode.workspaceId)}/trafficTypes/${encodeURIComponent(requireFmeIdentifier(input, "traffic_type_id", "fme_rule_based_segment"))}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            return {
              name: body?.name ?? input.name,
              ...(body?.description || input.description ? { description: body?.description ?? input.description } : {}),
            };
          },
          responseExtractor: passthrough,
          bodySchema: fmeRbsCreateSchema,
          description: "Create a rule-based segment. Pass traffic_type_id via params. Body requires name, optional description.",
        },
        delete: {
          method: "DELETE",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_rule_based_segment");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_rule_based_segment.delete: Harness-native (org_id/project_id) mode is not supported on this deprecated resource — use fme_segment instead.",
              );
            }
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_rule_based_segment"));
            return { path: `/internal/api/v2/rule-based-segments/ws/${encodeURIComponent(mode.workspaceId)}/${segmentName}` };
          },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete a rule-based segment from a workspace. Environment-level configs must be removed separately.",
        },
      },
    },
    {
      resourceType: "fme_rule_based_segment_definition",
      displayName: "(Deprecated) FME Rule-Based Segment Definition",
      description:
        "Deprecated — use fme_segment_definition instead for new integrations. Environment-specific definition of a rule-based segment, including targeting rules, exclusions, and matchers. Supports list (by environment), update, and enable/disable/change_request execute actions.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id", "environment_id", "segment_name"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from fme_workspace). Deprecated — omit and pass org_id+project_id instead for Harness-native scoping." },
        { name: "environment_id", description: "FME environment ID (get from fme_environment)", required: true },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/rule-based-segments/ws/{wsId}/environments/{environmentId}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_rule_based_segment_definition");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_rule_based_segment_definition.list: Harness-native (org_id/project_id) mode is not supported on this deprecated resource — use fme_segment_definition instead.",
              );
            }
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_rule_based_segment_definition"));
            return { path: `/internal/api/v2/rule-based-segments/ws/${encodeURIComponent(mode.workspaceId)}/environments/${environmentId}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId", environment_id: "environmentId" },
          responseExtractor: passthrough,
          description: "List rule-based segment definitions in a specific environment",
        },
        update: {
          method: "PUT",
          path: "/internal/api/v2/rule-based-segments/ws/{wsId}/{rbSegmentName}/environments/{environmentId}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_rule_based_segment_definition");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_rule_based_segment_definition.update: Harness-native (org_id/project_id) mode is not supported on this deprecated resource — use fme_segment_definition instead.",
              );
            }
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_rule_based_segment_definition"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_rule_based_segment_definition"));
            return { path: `/internal/api/v2/rule-based-segments/ws/${encodeURIComponent(mode.workspaceId)}/${segmentName}/environments/${environmentId}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId", segment_name: "rbSegmentName", environment_id: "environmentId" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          bodySchema: fmeRbsUpdateDefinitionSchema,
          description: "Update a rule-based segment definition in an environment (rules, exclusions, matchers)",
        },
      },
      executeActions: {
        enable: {
          method: "POST",
          path: "/internal/api/v2/rule-based-segments/{environmentId}/{rbSegmentName}",
          routeResolver: (input) => {
            if (isFmeHarnessNativeSelected(input, "fme_rule_based_segment_definition.enable")) {
              throw new Error(
                "fme_rule_based_segment_definition.enable: Harness-native (org_id/project_id) mode is not supported on this deprecated resource, and fme_segment_definition has no enable equivalent either — pass environment_id/segment_name (legacy contract) instead.",
              );
            }
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_rule_based_segment_definition"));
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_rule_based_segment_definition"));
            return { path: `/internal/api/v2/rule-based-segments/${environmentId}/${segmentName}` };
          },
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: { environment_id: "environmentId", segment_name: "rbSegmentName" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          bodySchema: { description: "No body fields required — sends an empty object to activate the segment", fields: [] },
          actionDescription: "Enable (activate) a rule-based segment in a specific environment. Creates an empty definition that can then be configured via update.",
        },
        disable: {
          method: "DELETE",
          path: "/internal/api/v2/rule-based-segments/{environmentId}/{rbSegmentName}",
          routeResolver: (input) => {
            if (isFmeHarnessNativeSelected(input, "fme_rule_based_segment_definition.disable")) {
              throw new Error(
                "fme_rule_based_segment_definition.disable: Harness-native (org_id/project_id) mode is not supported on this deprecated resource, and fme_segment_definition has no disable equivalent either — pass environment_id/segment_name (legacy contract) instead.",
              );
            }
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_rule_based_segment_definition"));
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_rule_based_segment_definition"));
            return { path: `/internal/api/v2/rule-based-segments/${environmentId}/${segmentName}` };
          },
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: { environment_id: "environmentId", segment_name: "rbSegmentName" },
          responseExtractor: passthrough,
          actionDescription: "Disable (remove) a rule-based segment from a specific environment. Workspace-level metadata is preserved.",
          bodySchema: {
            description: "No body required for this action.",
            fields: [],
          },
        },
        change_request: {
          method: "POST",
          path: "/internal/api/v2/changeRequests/ws/{wsId}/environments/{environmentId}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_rule_based_segment_definition");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_rule_based_segment_definition.change_request: Harness-native (org_id/project_id) mode is not supported on this deprecated resource, and fme_segment_definition has no change_request equivalent either — pass workspace_id (deprecated) instead.",
              );
            }
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_rule_based_segment_definition"));
            return { path: `/internal/api/v2/changeRequests/ws/${encodeURIComponent(mode.workspaceId)}/environments/${environmentId}` };
          },
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: { workspace_id: "wsId", environment_id: "environmentId" },
          bodyBuilder: (input) => ({
            ruleBasedSegment: input.ruleBasedSegment ?? input.rule_based_segment,
            operationType: input.operationType ?? input.operation_type,
            title: input.title,
            ...(input.comment ? { comment: input.comment } : {}),
            ...(input.approvers ? { approvers: input.approvers } : {}),
          }),
          responseExtractor: passthrough,
          bodySchema: fmeRbsChangeRequestSchema,
          actionDescription: "Submit a change request for a rule-based segment definition. Requires title, operationType, and ruleBasedSegment. Supports approvers for approval flow. Subject to governance rules (OPA policies).",
        },
      },
    },
    // ── FME Traffic Types ─────────────────────────────────────────────────
    {
      resourceType: "fme_traffic_type",
      displayName: "FME Traffic Type",
      description:
        "Traffic type (e.g. 'user', 'account'). Dual-mode: pass org_id+project_id (preferred) or the deprecated workspace_id. Use harness_list to discover traffic_type_id / name values for flag and segment create. Pagination uses offset/limit (max 100; harness_list size maps to limit).",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from fme_workspace). Deprecated — omit and pass org_id+project_id instead for Harness-native scoping." },
        { name: "offset", description: "Harness-native pagination offset (default 0)", type: "number" },
        { name: "limit", description: "Harness-native page size (default 100, max 100)", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_traffic_type");
            if (mode.mode === "legacy") {
              return { path: `/internal/api/v2/trafficTypes/ws/${encodeURIComponent(mode.workspaceId)}` };
            }
            return { path: "/fme/api/v4/traffic-types", product: "harness", scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { offset: "offset", size: "limit", limit: "limit" },
          responseExtractor: fmeV4PaginatedListExtract,
          description:
            "List traffic types. Pass org_id+project_id (preferred) or deprecated workspace_id. Optional offset/limit (harness_list size maps to limit).",
        },
      },
    },
    // ── FME Identities / Targets ──────────────────────────────────────────
    {
      resourceType: "fme_identity",
      displayName: "FME Identity",
      description:
        "Identity (target) in an environment. Create or update identities to manage display name aliases and custom attributes. Requires traffic_type_id and environment_id. Note: the Split Admin API does not support listing or getting individual identities — use create (batch upsert) and update (PATCH single key).",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["traffic_type_id", "environment_id", "key"],
      product: "fme",
      operations: {
        create: {
          method: "POST",
          path: "/internal/api/v2/trafficTypes/{trafficTypeId}/environments/{environmentId}/identities",
          routeResolver: (input) => {
            if (isFmeHarnessNativeSelected(input, "fme_identity.create")) {
              throw new Error(
                "fme_identity.create: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass traffic_type_id/environment_id (current contract) instead.",
              );
            }
            const trafficTypeId = encodeURIComponent(requireFmeIdentifier(input, "traffic_type_id", "fme_identity"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_identity"));
            return { path: `/internal/api/v2/trafficTypes/${trafficTypeId}/environments/${environmentId}/identities` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { traffic_type_id: "trafficTypeId", environment_id: "environmentId" },
          paramsSchema: {
            fields: [
              { name: "org_id", required: false, description: "Optional — pass together with project_id to select the (not yet implemented) Harness-native mode instead of the current contract." },
              { name: "project_id", required: false, description: "Optional — pass together with org_id to select the (not yet implemented) Harness-native mode instead of the current contract." },
            ],
          },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const body = input.body;
            if (!body || typeof body !== "object" || Array.isArray(body)) {
              throw new Error("fme_identity create requires body.items with at least one identity.");
            }
            const items = (body as Record<string, unknown>).items;
            if (!Array.isArray(items) || items.length === 0) {
              throw new Error("fme_identity create requires body.items with at least one identity.");
            }
            return items;
          },
          responseExtractor: passthrough,
          bodySchema: {
            description: "Batch create/upsert identities. Provide {items: [{key, values}]} where each item has a 'key' (string identifier) and 'values' (object of attribute name-value pairs, e.g. {name: 'Display Name', company: 'Acme'}).",
            fields: [
              { name: "items", type: "array", required: true, description: "Array of identity objects. Each must have 'key' (string) and 'values' (object mapping attribute names to values, e.g. {name: 'Display Name', company: 'Acme'})", itemType: "object" },
            ],
          },
          description: "Create or upsert identities in batch. Body: {items: [{key, values}]}. Returns created/updated objects and any failures.",
        },
        update: {
          method: "PATCH",
          path: "/internal/api/v2/trafficTypes/{trafficTypeId}/environments/{environmentId}/identities/{key}",
          routeResolver: (input) => {
            if (isFmeHarnessNativeSelected(input, "fme_identity.update")) {
              throw new Error(
                "fme_identity.update: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass traffic_type_id/environment_id (current contract) instead.",
              );
            }
            const trafficTypeId = encodeURIComponent(requireFmeIdentifier(input, "traffic_type_id", "fme_identity"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_identity"));
            const key = encodeURIComponent(requireFmeIdentifier(input, "key", "fme_identity"));
            return { path: `/internal/api/v2/trafficTypes/${trafficTypeId}/environments/${environmentId}/identities/${key}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { traffic_type_id: "trafficTypeId", environment_id: "environmentId", key: "key" },
          paramsSchema: {
            fields: [
              { name: "org_id", required: false, description: "Optional — pass together with project_id to select the (not yet implemented) Harness-native mode instead of the current contract." },
              { name: "project_id", required: false, description: "Optional — pass together with org_id to select the (not yet implemented) Harness-native mode instead of the current contract." },
            ],
          },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          bodySchema: fmeIdentityUpdateSchema,
          description: "Update an identity's display name alias and/or custom attributes. Uses PATCH — only provided fields are changed.",
        },
      },
    },
    // ── FME Standard Segments ─────────────────────────────────────────────
    {
      resourceType: "fme_standard_segment",
      displayName: "(Deprecated) FME Standard Segment",
      description:
        "Deprecated — use fme_segment instead for new integrations. Standard (static list) segment in a workspace. List all segments to see names, descriptions, and member counts, via the legacy workspace_id contract only — org_id+project_id (Harness-native) is rejected on every operation here in favor of fme_segment. For member management, use fme_segment_keys.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id", "segment_name"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "Workspace ID (get from fme_workspace). This resource only supports the legacy workspace_id contract; use fme_segment for Harness-native org_id+project_id scoping." },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_standard_segment");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_standard_segment.list: Harness-native (org_id/project_id) mode is not supported on this deprecated resource — use fme_segment instead.",
              );
            }
            return { path: `/internal/api/v2/segments/ws/${encodeURIComponent(mode.workspaceId)}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "List all standard segments in a workspace. Returns segment name, description, and creation metadata.",
        },
        get: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_standard_segment");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_standard_segment.get: Harness-native (org_id/project_id) mode is not supported on this deprecated resource — use fme_segment instead.",
              );
            }
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_standard_segment"));
            return { path: `/internal/api/v2/segments/ws/${encodeURIComponent(mode.workspaceId)}/${segmentName}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get a standard segment's metadata by name.",
        },
      },
    },
    {
      resourceType: "fme_segment",
      displayName: "FME Segment",
      description:
        "FME segment (STANDARD, LARGE, or RULE_BASED). Harness-native only (org_id+project_id). Supports list, get, create, update, and delete. list/get/update/delete require segment_type (one kind per call). Create requires name, trafficType, and segmentType. Update can change description, tags, and owners.",
      toolset: "feature-flags",
      scope: "project",
      scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
      identifierFields: ["segment_name"],
      listFilterFields: [
        { name: "segment_type", description: "Required. One kind per list call: STANDARD | LARGE | RULE_BASED.", enum: [...FME_SEGMENT_KINDS], required: true },
        { name: "status", description: "Optional list filter: ACTIVE | ARCHIVED. Omit for the default.", enum: [...FME_SEGMENT_STATUSES] },
        { name: "offset", description: "Pagination offset", type: "number" },
        { name: "limit", description: "Page size (max 100, default 100)", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment");
            applyFmeSegmentTypeQuery(input, "list");
            applyFmeOptionalStatusQuery(input, "fme_segment", "list");
            return { path: "/fme/api/v4/segments" };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { segment_type: "segment_type", status: "status", offset: "offset", limit: "limit" },
          responseExtractor: passthrough,
          description: "List segments of one kind. Requires filters.segment_type (STANDARD | LARGE | RULE_BASED). Optional filters.status (ACTIVE | ARCHIVED), offset, and limit.",
        },
        get: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment");
            applyFmeSegmentTypeQuery(input, "get");
            const segmentName = encodeURIComponent(
              requireFmeIdentifier(input, "segment_name", "fme_segment"),
            );
            return { path: `/fme/api/v4/segments/${segmentName}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { ...FME_SEGMENT_TYPE_QUERY_PARAMS },
          paramsSchema: fmeSegmentTypeParamsSchema,
          responseExtractor: passthrough,
          description: "Get a segment by name. Requires params.segment_type (STANDARD | LARGE | RULE_BASED).",
        },
        delete: {
          method: "DELETE",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment");
            applyFmeSegmentTypeQuery(input, "delete");
            const segmentName = encodeURIComponent(
              requireFmeIdentifier(input, "segment_name", "fme_segment"),
            );
            return { path: `/fme/api/v4/segments/${segmentName}` };
          },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          queryParams: { ...FME_SEGMENT_TYPE_QUERY_PARAMS },
          paramsSchema: fmeSegmentTypeParamsSchema,
          responseExtractor: passthrough,
          description:
            "Delete a segment by name. Requires params.segment_type (STANDARD | LARGE | RULE_BASED). Returns 400 hasDependents if any environment definition or flag still references it — delete definitions (after clearing keys) first.",
        },
        create: {
          method: "POST",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment");
            return { path: "/fme/api/v4/segments" };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            const trafficType = body?.trafficType as string | undefined;
            const segmentType = resolveFmeCreateSegmentType(body);
            return {
              name: body?.name,
              trafficType,
              segmentType,
              ...(body?.description !== undefined ? { description: body.description } : {}),
              ...(body?.tags !== undefined ? { tags: normalizeFmeTags(body.tags) } : {}),
              ...(body?.owners !== undefined ? { owners: body.owners } : {}),
            };
          },
          responseExtractor: passthrough,
          bodySchema: fmeSegmentCreateSchema,
          description: "Create a new segment. Body requires name + trafficType + segmentType (STANDARD | LARGE | RULE_BASED). Optional description, tags, owners.",
        },
        update: {
          method: "PATCH",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment");
            applyFmeSegmentTypeQuery(input, "update");
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_segment"));
            return {
              path: `/fme/api/v4/segments/${segmentName}`,
              headers: { "Content-Type": "application/merge-patch+json" },
            };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          queryParams: { ...FME_SEGMENT_TYPE_QUERY_PARAMS },
          paramsSchema: fmeSegmentTypeParamsSchema,
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            if (!body) return {};
            return {
              ...(body.description !== undefined ? { description: body.description } : {}),
              ...(body.tags !== undefined ? { tags: body.tags === null ? null : normalizeFmeTags(body.tags) } : {}),
              ...(body.owners !== undefined ? { owners: body.owners } : {}),
            };
          },
          responseExtractor: passthrough,
          bodySchema: fmeSegmentUpdateSchema,
          description:
            "Update a segment's description, tags, and/or owners. Requires params.segment_type (STANDARD | LARGE | RULE_BASED). Omit a field to leave it unchanged; set description/tags/owners to null (or [] for tags/owners) to clear.",
        },
      },
    },
    // ── FME Segment Definition (Harness-native) ──
    {
      resourceType: "fme_segment_definition",
      displayName: "FME Segment Definition",
      description:
        "Environment-specific segment definition. Harness-native only (org_id+project_id). list, get, create, update (description), delete, and execute list_keys/add_keys/remove_keys. Delete fails with hasDependents while keys remain.",
      toolset: "feature-flags",
      scope: "project",
      scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
      identifierFields: ["segment_name", "environment_id"],
      listFilterFields: [
        { name: "environment_id", description: "FME environment ID (get from fme_environment)", required: true },
        { name: "status", description: "Optional list filter: ACTIVE | ARCHIVED.", enum: [...FME_SEGMENT_STATUSES] },
        { name: "offset", description: "Pagination offset", type: "number" },
        { name: "limit", description: "Page size (max 100, default 100)", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment_definition");
            applyFmeOptionalStatusQuery(input, "fme_segment_definition", "list");
            return { path: "/fme/api/v4/segment-definitions" };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { environment_id: "environment_id", status: "status", offset: "offset", limit: "limit" },
          responseExtractor: passthrough,
          description: "List segment definitions in an environment, with pagination (offset/limit, max 100) and an optional status filter.",
        },
        get: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment_definition");
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_segment_definition"));
            return { path: `/fme/api/v4/segment-definitions/${segmentName}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { environment_id: "environment_id" },
          responseExtractor: passthrough,
          description: "Get a single segment definition by name in an environment.",
        },
        create: {
          method: "POST",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment_definition");
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_segment_definition"));
            return { path: `/fme/api/v4/segment-definitions/${segmentName}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          queryParams: { environment_id: "environment_id" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            return body?.description !== undefined ? { description: body.description } : {};
          },
          responseExtractor: passthrough,
          bodySchema: fmeSegmentDefinitionCreateSchema,
          description: "Create a segment definition in an environment. Omit the description (or send an empty body) to create an empty/default shell.",
        },
        update: {
          method: "PATCH",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment_definition");
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_segment_definition"));
            return { path: `/fme/api/v4/segment-definitions/${segmentName}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          queryParams: { environment_id: "environment_id" },
          headers: { "Content-Type": "application/merge-patch+json" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            if (!body || !("description" in body)) return {};
            return { description: body.description };
          },
          responseExtractor: passthrough,
          bodySchema: fmeSegmentDefinitionUpdateSchema,
          description: "Update a segment definition's description — the only mutable field. Omit description to leave it unchanged, pass null to clear it, or a string to set it.",
        },
        delete: {
          method: "DELETE",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment_definition");
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_segment_definition"));
            return { path: `/fme/api/v4/segment-definitions/${segmentName}` };
          },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          queryParams: { environment_id: "environment_id" },
          responseExtractor: passthrough,
          description:
            "Delete a segment definition from an environment. Returns 400 hasDependents while membership keys remain — remove_keys (or add_keys with replace=true and empty keys) first.",
        },
      },
      executeActions: {
        list_keys: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment_definition");
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_segment_definition"));
            requireFmeIdentifier(input, "environment_id", "fme_segment_definition");
            return { path: `/fme/api/v4/segment-definitions/${segmentName}/keys` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { environment_id: "environment_id", offset: "offset", limit: "limit" },
          responseExtractor: passthrough,
          actionDescription:
            "List membership keys for a segment definition in an environment. Requires org_id, project_id, segment_name, and environment_id. Pagination: offset and limit (default 100, max 100).",
        },
        add_keys: {
          method: "POST",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment_definition");
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_segment_definition"));
            requireFmeIdentifier(input, "environment_id", "fme_segment_definition");
            return { path: `/fme/api/v4/segment-definitions/${segmentName}/keys` };
          },
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          queryParams: { environment_id: "environment_id", replace: "replace" },
          bodyBuilder: (input) => fmeSegmentDefinitionKeysBody(input, { requireNonEmpty: false }),
          responseExtractor: passthrough,
          bodySchema: fmeSegmentDefinitionKeysAddSchema,
          actionDescription:
            "Add membership keys to a segment definition. Requires org_id, project_id, segment_name, environment_id, and body.keys. Pass replace=true to replace the full key set (empty keys allowed only then). Optional body comment/title.",
        },
        remove_keys: {
          method: "POST",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment_definition");
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_segment_definition"));
            requireFmeIdentifier(input, "environment_id", "fme_segment_definition");
            return { path: `/fme/api/v4/segment-definitions/${segmentName}/keys/remove` };
          },
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          queryParams: { environment_id: "environment_id" },
          bodyBuilder: (input) => fmeSegmentDefinitionKeysBody(input, { requireNonEmpty: true }),
          responseExtractor: passthrough,
          bodySchema: fmeSegmentDefinitionKeysRemoveSchema,
          actionDescription:
            "Remove membership keys from a segment definition. Requires org_id, project_id, segment_name, environment_id, and body.keys with at least one key. Optional body comment/title.",
        },
      },
    },
    {
      resourceType: "fme_segment_keys",
      displayName: "FME Segment Keys",
      description:
        "Membership keys (members) of a standard segment. List keys with pagination, or update to add members. Removal is not supported by this endpoint. Limit: 10,000 keys per request, 100,000 per segment total.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["environment_id", "segment_name"],
      product: "fme",
      listFilterFields: [
        { name: "environment_id", description: "Environment ID (get from fme_environment)", required: true },
        { name: "segment_name", description: "Segment name", required: true },
        { name: "offset", description: "Pagination offset", type: "number" },
        { name: "org_id", description: "Optional — not supported; use fme_segment_definition execute actions for Harness-native segment key operations." },
        { name: "project_id", description: "Optional — not supported; use fme_segment_definition execute actions for Harness-native segment key operations." },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/segments/{environmentId}/{segmentName}/keys",
          routeResolver: (input) => {
            if (isFmeHarnessNativeSelected(input, "fme_segment_keys.list")) {
              throw new Error(
                "fme_segment_keys.list: Harness-native (org_id/project_id) mode not supported — use fme_segment_definition execute list_keys instead.",
              );
            }
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_segment_keys"));
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_segment_keys"));
            return { path: `/internal/api/v2/segments/${environmentId}/${segmentName}/keys` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { environment_id: "environmentId", segment_name: "segmentName" },
          queryParams: {
            offset: "offset",
            size: "limit",
          },
          responseExtractor: passthrough,
          description: "List keys (members) of a standard segment with pagination. Returns an array of key strings.",
        },
        update: {
          method: "PUT",
          path: "/internal/api/v2/segments/{environmentId}/{segmentName}/upload",
          routeResolver: (input) => {
            if (isFmeHarnessNativeSelected(input, "fme_segment_keys.update")) {
              throw new Error(
                "fme_segment_keys.update: Harness-native (org_id/project_id) mode not supported — use fme_segment_definition execute add_keys/remove_keys instead.",
              );
            }
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_segment_keys"));
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_segment_keys"));
            return { path: `/internal/api/v2/segments/${environmentId}/${segmentName}/upload` };
          },
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: { environment_id: "environmentId", segment_name: "segmentName" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const body = input.body;
            if (!body || typeof body !== "object" || Array.isArray(body)) {
              throw new Error("fme_segment_keys update requires body.add with at least one key.");
            }
            const record = body as Record<string, unknown>;
            const keys = record.add;
            if (!Array.isArray(keys) || keys.length === 0) {
              throw new Error("fme_segment_keys update requires body.add with at least one key.");
            }
            return keys;
          },
          responseExtractor: passthrough,
          bodySchema: fmeSegmentKeysUpdateSchema,
          description: "Add keys to a standard segment. Provide 'add' array of key strings. Note: the Split Admin API only supports adding keys via this endpoint; removal requires the UI. Limit: 10,000 keys per request.",
        },
      },
    },
  ],
};
