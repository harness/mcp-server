import type { ToolsetDefinition, BodySchema } from "../types.js";
import { passthrough, fmeListExtract, fmeGetExtract } from "../extractors.js";
import { isFmeHarnessNativeSelected, logFmeDeprecation, requireFmeIdentifier, requireHarnessNativeSegmentScope, resolveFmeDualMode } from "../scope-utils.js";

const fmeActionExtract = (raw: unknown) => {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) return raw;
  return { success: true, result: raw };
};

const fmeFeatureFlagUpdateSchema: BodySchema = {
  description: "Partial update for an FME feature flag's metadata. Provide the fields you want to change — they are converted to JSON Patch (RFC 6902) operations automatically.",
  fields: [
    { name: "description", type: "string", required: false, description: "Updated description" },
    { name: "tags", type: "array", required: false, description: "Updated tags — provide as [{name: 'tag1'}] or ['tag1', 'tag2'] (strings are auto-wrapped)", itemType: "object" },
    { name: "rolloutStatus", type: "object", required: false, description: "Rollout status — provide as {id: '<uuid>'} (use fme_rollout_status to discover valid IDs)" },
  ],
};

const fmeFeatureFlagCreateSchema: BodySchema = {
  description: "Create a new feature flag (split) in a workspace under a specific traffic type. Note: the Split API does not support tags on create — use harness_update to add tags after creation.",
  fields: [
    { name: "name", type: "string", required: true, description: "Feature flag name (must be unique within the workspace)" },
    { name: "description", type: "string", required: false, description: "Optional description of the feature flag" },
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
  description: "Create a new segment (standard or rule-based). Not yet implemented — actual Harness-native request body shape is unknown.",
  fields: [],
};

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
  description: "Harness FME — feature flags, rule-based segments, workspaces, environments, and rollout statuses via the Split.io API",
  resources: [
    // ── FME Resources (Split.io API at https://api.split.io) ───────────
    // These use account scope to avoid injecting orgIdentifier/projectIdentifier
    // which Split.io does not use. Auth is via Bearer token (HARNESS_FME_API_KEY,
    // or a non-placeholder HARNESS_API_KEY fallback for self-hosted sessions).
    {
      resourceType: "fme_workspace",
      displayName: "FME Workspace",
      description: "Feature Management workspace. Supports list with pagination (offset/size, default 20, max 1000).",
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
      description: "Feature Management environment. Supports list. Requires a workspace_id.",
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
            return { path: "/fme/internal/api/v4/environments", product: "harness" };
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
        "Feature flag via the Split.io API. List flags by workspace with filtering (name, tags, rollout_status_id) and pagination (offset/size, default 20, max 50). Supports create (requires traffic_type_id), get, delete, update, and kill/restore/archive/unarchive execute actions.",
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
            return { path: "/fme/internal/api/v4/feature-flags", product: "harness" };
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
            return { path: `/fme/internal/api/v4/feature-flags/${flagName}`, product: "harness" };
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
              throw new Error(
                "fme_feature_flag.create: Harness-native (org_id/project_id) mode is not yet implemented for this operation — pass workspace_id (deprecated) instead.",
              );
            }
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/trafficTypes/${encodeURIComponent(requireFmeIdentifier(input, "traffic_type_id", "fme_feature_flag"))}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { workspace_id: "wsId", traffic_type_id: "trafficTypeId" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            return {
              name: body?.name ?? input.name,
              ...(body?.description || input.description ? { description: body?.description ?? input.description } : {}),
            };
          },
          responseExtractor: passthrough,
          bodySchema: fmeFeatureFlagCreateSchema,
          description: "Create a feature flag in a workspace. Requires workspace_id and traffic_type_id (get from fme_traffic_type). Body requires name, optional description. Note: tags must be set via a follow-up harness_update call (Split API limitation).",
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
            return { path: `/fme/internal/api/v4/feature-flags/${flagName}`, product: "harness" };
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
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_feature_flag.update: Harness-native (org_id/project_id) mode is not yet implemented for this operation — pass workspace_id (deprecated) instead.",
              );
            }
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
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
          description: "Update a feature flag's metadata (description, tags, rolloutStatus). Uses JSON Patch (RFC 6902) format — provide fields directly and they are converted to patch operations automatically.",
          bodySchema: fmeFeatureFlagUpdateSchema,
        },
      },
      executeActions: {
        kill: {
          method: "PUT",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}/kill",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_feature_flag.kill: Harness-native (org_id/project_id) mode is not yet implemented for this operation — pass workspace_id (deprecated) instead.",
              );
            }
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_feature_flag"));
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/environments/${environmentId}/kill` };
          },
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          bodyBuilder: () => ({}),
          responseExtractor: fmeActionExtract,
          actionDescription: "Kill (turn off) a feature flag in a specific environment. Requires workspace_id, feature_flag_name, and environment_id.",
          bodySchema: {
            description: "No body required — identifiers are in path/query params.",
            fields: [],
          },
        },
        restore: {
          method: "PUT",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}/restore",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_feature_flag.restore: Harness-native (org_id/project_id) mode is not yet implemented for this operation — pass workspace_id (deprecated) instead.",
              );
            }
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_feature_flag"));
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/environments/${environmentId}/restore` };
          },
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          bodyBuilder: () => ({}),
          responseExtractor: fmeActionExtract,
          actionDescription: "Restore (re-enable) a killed feature flag in a specific environment. Requires workspace_id, feature_flag_name, and environment_id.",
          bodySchema: {
            description: "No body required — identifiers are in path/query params.",
            fields: [],
          },
        },
        archive: {
          method: "POST",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/archive",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_feature_flag.archive: Harness-native (org_id/project_id) mode is not yet implemented for this operation — pass workspace_id (deprecated) instead.",
              );
            }
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/archive` };
          },
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          bodyBuilder: () => ({}),
          responseExtractor: fmeActionExtract,
          actionDescription: "Archive a feature flag. Requires workspace_id and feature_flag_name. Subject to OPA policy checks (409 on failure).",
          bodySchema: {
            description: "No body required for this action.",
            fields: [],
          },
        },
        unarchive: {
          method: "POST",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/unarchive",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_feature_flag.unarchive: Harness-native (org_id/project_id) mode is not yet implemented for this operation — pass workspace_id (deprecated) instead.",
              );
            }
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag"));
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/unarchive` };
          },
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          bodyBuilder: () => ({}),
          responseExtractor: fmeActionExtract,
          actionDescription: "Unarchive a previously archived feature flag. Requires workspace_id and feature_flag_name. Returns 409 if the flag has dependent objects.",
          bodySchema: {
            description: "No body required for this action.",
            fields: [],
          },
        },
      },
    },
    {
      resourceType: "fme_feature_flag_definition",
      displayName: "FME Feature Flag Definition",
      description:
        "Detailed definition of a feature flag in a specific environment, including treatments, rules, targeting, and traffic allocation. Supports create, get, and update. Create requires treatments, defaultTreatment, and defaultRule.",
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
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_feature_flag_definition.get: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass workspace_id (deprecated) instead.",
              );
            }
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag_definition"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_feature_flag_definition"));
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/environments/${environmentId}` };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          responseExtractor: passthrough,
          description: "Get feature flag definition in a specific environment (treatments, rules, default rule, traffic allocation)",
        },
        create: {
          method: "POST",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag_definition");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_feature_flag_definition.create: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass workspace_id (deprecated) instead.",
              );
            }
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag_definition"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_feature_flag_definition"));
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/environments/${environmentId}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          bodySchema: fmeFeatureFlagDefinitionCreateSchema,
          description: "Create a feature flag definition in a specific environment. Requires treatments (array of treatment objects), defaultTreatment (string matching a treatment name), and defaultRule (array of bucket objects). Optional: rules, baselineTreatment, trafficAllocation, comment.",
        },
        update: {
          method: "PUT",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_feature_flag_definition");
            if (mode.mode === "harness_native") {
              throw new Error(
                "fme_feature_flag_definition.update: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass workspace_id (deprecated) instead.",
              );
            }
            const flagName = encodeURIComponent(requireFmeIdentifier(input, "feature_flag_name", "fme_feature_flag_definition"));
            const environmentId = encodeURIComponent(requireFmeIdentifier(input, "environment_id", "fme_feature_flag_definition"));
            return { path: `/internal/api/v2/splits/ws/${encodeURIComponent(mode.workspaceId)}/${flagName}/environments/${environmentId}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: {
            workspace_id: "wsId",
            feature_flag_name: "featureFlagName",
            environment_id: "environmentId",
          },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          bodySchema: fmeFeatureFlagDefinitionUpdateSchema,
          description: "Update a feature flag definition in a specific environment (treatments, rules, default rule, traffic allocation, baseline treatment)",
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
        "Deprecated — use fme_segment instead for new integrations. Rule-based segment in a workspace. Supports list, get, create (requires traffic_type_id), and delete. Create requires traffic_type_id passed via params.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id", "segment_name"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from fme_workspace). Deprecated — omit and pass org_id+project_id instead for Harness-native scoping." },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_rule_based_segment");
            if (mode.mode === "legacy") {
              return { path: `/internal/api/v2/rule-based-segments/ws/${encodeURIComponent(mode.workspaceId)}` };
            }
            return { path: "/fme/internal/api/v4/segments", product: "harness" };
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
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_rule_based_segment"));
            if (mode.mode === "legacy") {
              return { path: `/internal/api/v2/rule-based-segments/ws/${encodeURIComponent(mode.workspaceId)}/${segmentName}` };
            }
            return { path: `/fme/internal/api/v4/segments/${segmentName}`, product: "harness" };
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
                "fme_rule_based_segment.create: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass workspace_id (deprecated) instead.",
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
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_rule_based_segment"));
            if (mode.mode === "legacy") {
              return { path: `/internal/api/v2/rule-based-segments/ws/${encodeURIComponent(mode.workspaceId)}/${segmentName}` };
            }
            return { path: `/fme/internal/api/v4/segments/${segmentName}`, product: "harness" };
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
                "fme_rule_based_segment_definition.list: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass workspace_id (deprecated) instead.",
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
                "fme_rule_based_segment_definition.update: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass workspace_id (deprecated) instead.",
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
                "fme_rule_based_segment_definition.enable: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass environment_id/segment_name (current contract) instead.",
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
                "fme_rule_based_segment_definition.disable: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass environment_id/segment_name (current contract) instead.",
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
                "fme_rule_based_segment_definition.change_request: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass workspace_id (deprecated) instead.",
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
        "Deprecated — use fme_segment instead for new integrations. Standard (static list) segment in a workspace. List all segments to see names, descriptions, and member counts. For member management, use fme_segment_keys.",
      toolset: "feature-flags",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["workspace_id", "segment_name"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "Workspace ID (get from fme_workspace). Deprecated — omit and pass org_id+project_id instead for Harness-native scoping." },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            const mode = resolveFmeDualMode(input, "fme_standard_segment");
            if (mode.mode === "legacy") {
              return { path: `/internal/api/v2/segments/ws/${encodeURIComponent(mode.workspaceId)}` };
            }
            return { path: "/fme/internal/api/v4/segments", product: "harness" };
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
            const segmentName = encodeURIComponent(requireFmeIdentifier(input, "segment_name", "fme_standard_segment"));
            if (mode.mode === "legacy") {
              return { path: `/internal/api/v2/segments/ws/${encodeURIComponent(mode.workspaceId)}/${segmentName}` };
            }
            return { path: `/fme/internal/api/v4/segments/${segmentName}`, product: "harness" };
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
        "FME (Harness-native, org_id+project_id scoped). Unified segment type (standard and rule-based). Supports list, get, delete. create not yet implemented — Harness-native create request body not yet confirmed.",
      toolset: "feature-flags",
      scope: "project",
      identifierFields: ["segment_name"],
      listFilterFields: [
        {
          name: "segment_type",
          description:
            'Segment kind: "standard" or "rule_based". Only meaningful on create (not yet implemented).',
          enum: ["standard", "rule_based"],
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          routeResolver: (input) => {
            requireHarnessNativeSegmentScope(input, "fme_segment");
            return { path: "/fme/internal/api/v4/segments" };
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
            return { path: `/fme/internal/api/v4/segments/${segmentName}` };
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
            return { path: `/fme/internal/api/v4/segments/${segmentName}` };
          },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete a segment by name.",
        },
        create: {
          method: "POST",
          path: "",
          routeResolver: () => {
            throw new Error("fme_segment.create: Harness-native create not yet implemented.");
          },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          bodySchema: fmeSegmentCreateSchema,
          description: "Create a new segment. Not yet implemented — Harness-native request body shape not yet confirmed.",
        },
      },
    },
    // ── FME Segment Definition (Harness-native, unified — Harness_Split/Main PR #12644) ──
    {
      resourceType: "fme_segment_definition",
      displayName: "FME Segment Definition",
      description:
        "Environment-specific definition of a segment (standard or rule-based) — description and lifecycle. Replaces fme_rule_based_segment_definition's role in Harness-native calls, generalized for all segment types. Harness-native only (org_id+project_id; no legacy workspace_id support). Supports list, get, create, update (description only, via JSON Merge Patch), and delete. Wired against Harness_Split/Main PR #12644, which was open (not yet merged) as of this writing — paths may still change before merge. There is no enable/disable/change_request action: the backend has no such endpoints for this unified resource; governance checks are surfaced inline in the create/update/delete responses instead.",
      toolset: "feature-flags",
      scope: "project",
      scopeParams: { account: "account_id", org: "organization_identifier", project: "project_identifier" },
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
            return { path: "/fme/internal/api/v4/segment-definitions" };
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
            return { path: `/fme/internal/api/v4/segment-definitions/${segmentName}` };
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
            return { path: `/fme/internal/api/v4/segment-definitions/${segmentName}` };
          },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
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
            return { path: `/fme/internal/api/v4/segment-definitions/${segmentName}` };
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
            return { path: `/fme/internal/api/v4/segment-definitions/${segmentName}` };
          },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          queryParams: { environment_id: "environment_id" },
          responseExtractor: passthrough,
          description: "Delete a segment definition from an environment.",
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
        { name: "org_id", description: "Optional — pass together with project_id to select the (not yet implemented) Harness-native mode instead of the current contract." },
        { name: "project_id", description: "Optional — pass together with org_id to select the (not yet implemented) Harness-native mode instead of the current contract." },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/segments/{environmentId}/{segmentName}/keys",
          routeResolver: (input) => {
            if (isFmeHarnessNativeSelected(input, "fme_segment_keys.list")) {
              throw new Error(
                "fme_segment_keys.list: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass environment_id/segment_name (current contract) instead.",
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
                "fme_segment_keys.update: Harness-native (org_id/project_id) mode not yet implemented for this operation — pass environment_id/segment_name (current contract) instead.",
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
