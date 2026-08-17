import type { ToolsetDefinition, BodySchema } from "../types.js";
import { passthrough, fmeListExtract, fmeGetExtract } from "../extractors.js";
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

const FME_SEGMENT_TYPES = ["standard", "rule_based", "large"] as const;

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
    { name: "trafficType", type: "string", required: false, description: "Traffic type name. Required in Harness-native (org_id+project_id) mode; ignored in legacy mode (pass traffic_type_id as a separate param there instead)" },
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
  description: "Optional comment recorded with the action.",
  fields: [
    { name: "comment", type: "string", required: false, description: "Optional comment explaining the change" },
  ],
};

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
  description: "Create a new segment. name, trafficType, and type are required; description/tags/owners are optional.",
  fields: [
    { name: "name", type: "string", required: true, description: "Segment name (must be unique within the project)" },
    { name: "type", type: "string", required: true, description: "Segment kind. Must be one of: \"standard\" | \"rule_based\" | \"large\"." },
    { name: "description", type: "string", required: false, description: "Optional description of the segment" },
    { name: "trafficType", type: "string", required: true, description: "Traffic type name" },
    { name: "tags", type: "array", required: false, description: "Each entry is {name: string}; bare strings are accepted and auto-wrapped", itemType: "object" },
    { name: "owners", type: "array", required: false, description: "Each entry is {type: \"USER\", id or email} or {type: \"GROUP\", identifier}", itemType: "object" },
  ],
};

const fmeSegmentUpdateSchema: BodySchema = {
  description: "Partial update for a Harness-native segment via JSON Merge Patch (RFC 7396). Omit a field to leave it unchanged; set description/tags/owners to null (or [] for tags/owners) to clear.",
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

function fmeSegmentKeysNativePointer(operation: string): never {
  throw new Error(
    `fme_segment_keys.${operation}: Harness-native membership uses fme_segment_definition execute actions list_keys, add_keys, and remove_keys — do not pass org_id+project_id on fme_segment_keys.`,
  );
}

function fmeSegmentDefinitionKeysBody(input: Record<string, unknown>, opts: { requireNonEmpty: boolean }): Record<string, unknown> {
  const body = input.body as Record<string, unknown> | undefined;
  const keys = body?.keys;
  if (!Array.isArray(keys) || (opts.requireNonEmpty && keys.length === 0)) {
    throw new Error(
      opts.requireNonEmpty
        ? "fme_segment_definition.remove_keys requires body.keys with at least one key."
        : "fme_segment_definition.add_keys requires body.keys (array; empty only when replace=true).",
    );
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
  description: "Update a segment definition via JSON Merge Patch (RFC 7396). description is the only mutable field: omit it to leave unchanged, pass null to clear it, or a string to set it.",
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
        "Feature Management environment. Supports list. Dual-mode scoping: pass either org_id+project_id " +
        "(Harness-native, preferred — no workspace lookup needed) or the deprecated workspace_id.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id", "environment_id"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from harness_list resource_type=fme_workspace). Deprecated — omit and pass org_id+project_id instead for Harness-native scoping." },
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
          responseExtractor: passthrough,
          description: "List FME environments for a workspace",
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
              const trafficType = (body?.trafficType ?? body?.traffic_type) as string | undefined;
              if (!trafficType) {
                throw new Error(
                  "fme_feature_flag.create: \"trafficType\" is required in body for Harness-native (org_id/project_id) mode.",
                );
              }
              return {
                name: body?.name ?? input.name,
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
          description: "Create a feature flag. Legacy mode (workspace_id): requires workspace_id + traffic_type_id (get from fme_traffic_type); body: name, optional description (no tags/owners — use harness_update after creation). Harness-native mode (org_id+project_id): body requires name + trafficType, optional description/tags/owners.",
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
            return body.comment !== undefined ? { comment: body.comment } : {};
          },
          responseExtractor: fmeActionExtract,
          actionDescription:
            "Archive a feature flag. Requires feature_flag_name, plus workspace_id (legacy) or org_id+project_id (Harness-native). Subject to OPA policy checks (409 on failure). Optional comment recorded with the change.",
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
            return body.comment !== undefined ? { comment: body.comment } : {};
          },
          responseExtractor: fmeActionExtract,
          actionDescription:
            "Unarchive a previously archived feature flag. Requires feature_flag_name, plus workspace_id (legacy) or org_id+project_id (Harness-native). Returns 409 if the flag has dependent objects. Optional comment recorded with the change.",
          bodySchema: fmeFeatureFlagArchiveSchema,
        },
      },
    },
    {
      resourceType: "fme_feature_flag_definition",
      displayName: "FME Feature Flag Definition",
      description:
        "Detailed definition of a feature flag in a specific environment, including treatments, rules, targeting, and traffic allocation. Supports create, get, and update. Create requires treatments, defaultTreatment, and defaultRule. " +
        "Dual-mode scoping: pass org_id+project_id (Harness-native) or the deprecated workspace_id (Split.io API) — both modes share the same body shape and all three operations. environment_id is passed as a path segment in legacy mode and as a query param in Harness-native mode.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id", "environment_id", "feature_flag_name"],
      product: "fme",
      operations: {
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
          description: "Get feature flag definition in a specific environment (treatments, rules, default rule, traffic allocation). Legacy mode: workspace_id, environment_id in path. Harness-native mode: org_id+project_id, environment_id as query param.",
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
          description: "Create a feature flag definition in a specific environment. Requires treatments (array of treatment objects), defaultTreatment (string matching a treatment name), and defaultRule (array of bucket objects). Optional: rules, baselineTreatment, trafficAllocation, comment, title (Harness-native only). Legacy mode: workspace_id, environment_id in path. Harness-native mode: org_id+project_id, environment_id as query param.",
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
            "Update a feature flag definition in a specific environment (treatments, rules, default rule, traffic allocation, baseline treatment). Legacy mode: PUT, workspace_id/environment_id in path (full-replace, per the Split.io API). Harness-native mode: PATCH via JSON Merge Patch (RFC 7396) — omit a field to leave it unchanged; treatments/rules/defaultRule are omit-to-keep but reject explicit null (not clearable); org_id+project_id, environment_id as query param.",
        },
      },
    },
    {
      resourceType: "fme_rollout_status",
      displayName: "FME Rollout Status",
      description:
        "Rollout status definitions for a workspace (e.g. Killed, Permanent, Ramping). Use to discover valid rollout_status_id UUIDs for filtering fme_feature_flag lists. Note: this endpoint may not be available on all account types — rollout status IDs are also returned inline with fme_feature_flag list results.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from fme_workspace). Deprecated — omit and pass org_id+project_id instead for Harness-native scoping." },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/rolloutStatuses/ws/{wsId}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_rollout_status");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_rollout_status.list: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass workspace_id (deprecated) instead.",
              );
            }
            return { path: `/internal/api/v2/rolloutStatuses/ws/${encodeURIComponent(mode.workspaceId)}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId" },
          responseExtractor: passthrough,
          description: "List rollout status definitions for a workspace (Killed, Permanent, Ramping, etc.). If this returns 404, use rolloutStatus fields from fme_feature_flag list results instead.",
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
                "fme_rule_based_segment.create: Harness-native (org_id/project_id) mode is not supported on this deprecated resource — use fme_segment instead (create is not yet implemented there either).",
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
        "Traffic type in a workspace (e.g. 'user', 'account'). List traffic types to discover traffic_type_id values needed for identity queries and flag/segment creation.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from fme_workspace). Deprecated — omit and pass org_id+project_id instead for Harness-native scoping." },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/trafficTypes/ws/{wsId}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_traffic_type");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_traffic_type.list: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass workspace_id (deprecated) instead.",
              );
            }
            return { path: `/internal/api/v2/trafficTypes/ws/${encodeURIComponent(mode.workspaceId)}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId" },
          responseExtractor: passthrough,
          description: "List traffic types for a workspace. Returns id, name, and displayAttributeId for each traffic type.",
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
        "FME (Harness-native, org_id+project_id scoped). Unified segment type (standard, rule-based, and large). Supports list, get, create, update (JSON Merge Patch on description/tags/owners), and delete. create requires body.type (\"standard\" | \"rule_based\" | \"large\").",
      toolset: "feature-flags",
      scope: "project",
      scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
      identifierFields: ["segment_name"],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment");
            return { path: "/fme/api/v4/segments" };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "List all segments (standard and rule-based) in project.",
        },
        get: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment");
            const segmentName = encodeURIComponent(
              requireFmeIdentifier(input, "segment_name", "fme_segment"),
            );
            return { path: `/fme/api/v4/segments/${segmentName}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get single segment by name.",
        },
        delete: {
          method: "DELETE",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment");
            const segmentName = encodeURIComponent(
              requireFmeIdentifier(input, "segment_name", "fme_segment"),
            );
            return { path: `/fme/api/v4/segments/${segmentName}` };
          },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete a segment by name.",
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
            const trafficType = (body?.trafficType ?? body?.traffic_type) as string | undefined;
            if (body?.type !== undefined && !FME_SEGMENT_TYPES.includes(body.type as (typeof FME_SEGMENT_TYPES)[number])) {
              throw new Error(
                `fme_segment.create: invalid type '${body.type}'. Must be one of: ${FME_SEGMENT_TYPES.join(", ")}.`,
              );
            }
            return {
              name: body?.name,
              trafficType,
              type: body?.type,
              ...(body?.description !== undefined ? { description: body.description } : {}),
              ...(body?.tags !== undefined ? { tags: normalizeFmeTags(body.tags) } : {}),
              ...(body?.owners !== undefined ? { owners: body.owners } : {}),
            };
          },
          responseExtractor: passthrough,
          bodySchema: fmeSegmentCreateSchema,
          description: "Create a new segment. Body requires name + trafficType + type (\"standard\" | \"rule_based\" | \"large\"); optional description, tags, owners.",
        },
        update: {
          method: "PATCH",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment");
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_segment"));
            return {
              path: `/fme/api/v4/segments/${segmentName}`,
              headers: { "Content-Type": "application/merge-patch+json" },
            };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
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
            "Update a segment's description, tags, and/or owners via JSON Merge Patch (RFC 7396). Harness-native only (org_id+project_id). Omit a field to leave it unchanged; set description/tags/owners to null (or [] for tags/owners) to clear.",
        },
      },
    },
    // ── FME Segment Definition (Harness-native, unified — Harness_Split/Main PR #12644) ──
    {
      resourceType: "fme_segment_definition",
      displayName: "FME Segment Definition",
      description:
        "Environment-specific definition of a segment (standard or rule-based) — description, lifecycle, and membership keys. Replaces fme_rule_based_segment_definition's role in Harness-native calls, generalized for all segment types. Harness-native only (org_id+project_id; no legacy workspace_id support). Supports list, get, create, update (description only, via JSON Merge Patch), delete, and execute list_keys/add_keys/remove_keys. There is no enable/disable/change_request action: the backend has no such endpoints for this unified resource; governance checks are surfaced inline in the create/update/delete responses instead.",
      toolset: "feature-flags",
      scope: "project",
      scopeParams: FME_HARNESS_NATIVE_SCOPE_PARAMS,
      identifierFields: ["segment_name", "environment_id"],
      listFilterFields: [
        { name: "environment_id", description: "FME environment ID (get from fme_environment)", required: true },
        { name: "status", description: "Filter by definition status", enum: ["ACTIVE", "ARCHIVED"] },
        { name: "offset", description: "Pagination offset", type: "number" },
        { name: "limit", description: "Page size (max 100, default 100)", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment_definition");
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
          description: "Update a segment definition's description via JSON Merge Patch (RFC 7396) — the only mutable field. Omit description to leave it unchanged, pass null to clear it, or a string to set it.",
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
          description: "Delete a segment definition from an environment.",
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
            "List membership keys for a segment definition in an environment (Harness-native). Requires org_id, project_id, segment_name, and environment_id. Pagination: offset and limit (default 100, max 100).",
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
            "Add membership keys to a segment definition (Harness-native). Requires org_id, project_id, segment_name, environment_id, and body.keys. Pass replace=true to replace the full key set (empty keys allowed only then). Optional body comment/title.",
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
            "Remove membership keys from a segment definition (Harness-native). Requires org_id, project_id, segment_name, environment_id, and body.keys with at least one key. Optional body comment/title.",
        },
      },
    },
    {
      resourceType: "fme_segment_keys",
      displayName: "FME Segment Keys",
      description:
        "Membership keys (members) of a standard segment. List keys with pagination, or update to add members. Removal is not supported by this endpoint. Limit: 10,000 keys per request, 100,000 per segment total. Legacy workspace-style calls use environment_id+segment_name without org_id/project_id. Harness-native membership is not on this resource — use fme_segment_definition execute actions list_keys, add_keys, and remove_keys.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["environment_id", "segment_name"],
      product: "fme",
      listFilterFields: [
        { name: "environment_id", description: "Environment ID (get from fme_environment)", required: true },
        { name: "segment_name", description: "Segment name", required: true },
        { name: "offset", description: "Pagination offset", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/segments/{environmentId}/{segmentName}/keys",
          routeResolver: (input) => {
            if (isFmeHarnessNativeSelected(input, "fme_segment_keys.list")) {
              fmeSegmentKeysNativePointer("list");
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
              fmeSegmentKeysNativePointer("update");
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
