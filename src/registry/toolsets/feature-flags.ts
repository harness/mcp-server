import type { ToolsetDefinition, BodySchema } from "../types.js";
import { passthrough, fmeListExtract, fmeGetExtract } from "../extractors.js";

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

const fmeRbsUpdateDefinitionSchema: BodySchema = {
  description: "Update a rule-based segment definition in an environment",
  fields: [
    { name: "title", type: "string", required: false, description: "Segment title" },
    { name: "comment", type: "string", required: false, description: "Comment about the segment" },
    { name: "rules", type: "array", required: false, description: "Targeting rules with conditions and matchers", itemType: "object" },
    { name: "excludedKeys", type: "array", required: false, description: "User keys to exclude from the segment", itemType: "string" },
    { name: "excludedSegments", type: "array", required: false, description: "Segments to exclude (objects with name and type)", itemType: "object" },
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
    { name: "add", type: "array", required: false, description: "Keys to add to the segment (string array of identity keys)", itemType: "string" },
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
    // which Split.io does not use. Auth is via Bearer token (HARNESS_API_KEY).
    {
      resourceType: "fme_workspace",
      displayName: "FME Workspace",
      description: "Feature Management workspace. Supports list with pagination (offset/size, default 20, max 1000) and get by workspace_id.",
      toolset: "feature-flags",
      scope: "account",
      identifierFields: ["workspace_id"],
      product: "fme",
      listFilterFields: [
        { name: "offset", description: "Pagination offset for feature flag workspaces", type: "number" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/workspaces",
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
      identifierFields: ["workspace_id", "environment_id"],
      product: "fme",
      baseUrlOverride: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from harness_list resource_type=fme_workspace)", required: true },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/environments/ws/{wsId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId" },
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
      identifierFields: ["workspace_id", "feature_flag_name"],
      product: "fme",
      deepLinkTemplate: "/ng/account/{accountId}/module/fme/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/resources/targets/{trafficTypeId}/splits/{id}",
      listFilterFields: [
        { name: "workspace_id", description: "FME workspace ID (get from harness_list resource_type=fme_workspace)", required: true },
        { name: "offset", description: "Pagination offset for FME feature flags", type: "number" },
        { name: "rollout_status_id", description: "Filter by rollout status UUID (use fme_rollout_status to discover valid IDs)", type: "string" },
        { name: "name", description: "Filter flags by name (partial match)", type: "string" },
        { name: "tags", description: "Filter flags by tag", type: "string" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/splits/ws/{wsId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId" },
          queryParams: {
            offset: "offset",
            size: "limit",
            rollout_status_id: "rolloutStatus",
            name: "name",
            tags: "tag",
          },
          responseExtractor: fmeListExtract,
          description:
            "List feature flags for a workspace with filtering and pagination (offset and size params, max 50).",
        },
        get: {
          method: "GET",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          responseExtractor: fmeGetExtract,
          description: "Get a specific feature flag's metadata without requiring an environment",
        },
        create: {
          method: "POST",
          path: "/internal/api/v2/splits/ws/{wsId}/trafficTypes/{trafficTypeId}",
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
          description: "Create a feature flag in a workspace. Requires workspace_id and traffic_type_id (get from fme_workspace). Body requires name, optional description. Note: tags must be set via a follow-up harness_update call (Split API limitation).",
        },
        delete: {
          method: "DELETE",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { workspace_id: "wsId", feature_flag_name: "featureFlagName" },
          responseExtractor: passthrough,
          description: "Delete a feature flag from a workspace",
        },
        update: {
          method: "PATCH",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}",
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
      identifierFields: ["workspace_id", "environment_id", "feature_flag_name"],
      product: "fme",
      operations: {
        get: {
          method: "GET",
          path: "/internal/api/v2/splits/ws/{wsId}/{featureFlagName}/environments/{environmentId}",
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
      identifierFields: ["workspace_id"],
      product: "fme",
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/rolloutStatuses/ws/{wsId}",
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
      displayName: "FME Rule-Based Segment",
      description:
        "Rule-based segment in a workspace. Supports list, get, create (requires traffic_type_id), and delete. Create requires traffic_type_id passed via params.",
      toolset: "feature-flags",
      scope: "account",
      identifierFields: ["workspace_id", "segment_name"],
      product: "fme",
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/rule-based-segments/ws/{wsId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId" },
          responseExtractor: passthrough,
          description: "List all rule-based segments in a workspace",
        },
        get: {
          method: "GET",
          path: "/internal/api/v2/rule-based-segments/ws/{wsId}/{rbSegmentName}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId", segment_name: "rbSegmentName" },
          responseExtractor: passthrough,
          description: "Get a rule-based segment by name (workspace-level metadata)",
        },
        create: {
          method: "POST",
          path: "/internal/api/v2/rule-based-segments/ws/{wsId}/trafficTypes/{trafficTypeId}",
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
          bodySchema: fmeRbsCreateSchema,
          description: "Create a rule-based segment. Pass traffic_type_id via params. Body requires name, optional description.",
        },
        delete: {
          method: "DELETE",
          path: "/internal/api/v2/rule-based-segments/ws/{wsId}/{rbSegmentName}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { workspace_id: "wsId", segment_name: "rbSegmentName" },
          responseExtractor: passthrough,
          description: "Delete a rule-based segment from a workspace. Environment-level configs must be removed separately.",
        },
      },
    },
    {
      resourceType: "fme_rule_based_segment_definition",
      displayName: "FME Rule-Based Segment Definition",
      description:
        "Environment-specific definition of a rule-based segment, including targeting rules, exclusions, and matchers. Supports list (by environment), update, and enable/disable/change_request execute actions.",
      toolset: "feature-flags",
      scope: "account",
      identifierFields: ["workspace_id", "environment_id", "segment_name"],
      product: "fme",
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/rule-based-segments/ws/{wsId}/environments/{environmentId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId", environment_id: "environmentId" },
          responseExtractor: passthrough,
          description: "List rule-based segment definitions in a specific environment",
        },
        update: {
          method: "PUT",
          path: "/internal/api/v2/rule-based-segments/ws/{wsId}/{rbSegmentName}/environments/{environmentId}",
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
      identifierFields: ["workspace_id"],
      product: "fme",
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/trafficTypes/ws/{wsId}",
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
      identifierFields: ["traffic_type_id", "environment_id", "key"],
      product: "fme",
      operations: {
        create: {
          method: "POST",
          path: "/internal/api/v2/trafficTypes/{trafficTypeId}/environments/{environmentId}/identities",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { traffic_type_id: "trafficTypeId", environment_id: "environmentId" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | unknown[] | undefined;
            if (Array.isArray(body)) return body;
            if (body && Array.isArray(body.items)) return body.items;
            return [];
          },
          responseExtractor: passthrough,
          bodySchema: {
            description: "Batch create/upsert identities. Provide {items: [{key, values}]} where each item has a 'key' (string identifier) and 'values' (object of attribute name-value pairs, e.g. {name: 'Display Name', company: 'Acme'}).",
            fields: [
              { name: "items", type: "array", required: false, description: "Array of identity objects. Each must have 'key' (string) and 'values' (object mapping attribute names to values, e.g. {name: 'Display Name', company: 'Acme'})", itemType: "object" },
            ],
          },
          description: "Create or upsert identities in batch. Body: {items: [{key, values}]}. Returns created/updated objects and any failures.",
        },
        update: {
          method: "PATCH",
          path: "/internal/api/v2/trafficTypes/{trafficTypeId}/environments/{environmentId}/identities/{key}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { traffic_type_id: "trafficTypeId", environment_id: "environmentId", key: "key" },
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
      displayName: "FME Standard Segment",
      description:
        "Standard (static list) segment in a workspace. List all segments to see names, descriptions, and member counts. For member management, use fme_segment_keys.",
      toolset: "feature-flags",
      scope: "account",
      identifierFields: ["workspace_id", "segment_name"],
      product: "fme",
      listFilterFields: [
        { name: "workspace_id", description: "Workspace ID (get from fme_workspace)", required: true },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/internal/api/v2/segments/ws/{wsId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId" },
          responseExtractor: passthrough,
          description: "List all standard segments in a workspace. Returns segment name, description, and creation metadata.",
        },
        get: {
          method: "GET",
          path: "/internal/api/v2/segments/ws/{wsId}/{segmentName}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { workspace_id: "wsId", segment_name: "segmentName" },
          responseExtractor: passthrough,
          description: "Get a standard segment's metadata by name.",
        },
      },
    },
    {
      resourceType: "fme_segment_keys",
      displayName: "FME Segment Keys",
      description:
        "Membership keys (members) of a standard segment. List keys with pagination, or update to add/remove members. Limit: 10,000 keys per request, 100,000 per segment total.",
      toolset: "feature-flags",
      scope: "account",
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
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: { environment_id: "environmentId", segment_name: "segmentName" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown>;
            return (body.add ?? body.keys ?? []) as string[];
          },
          responseExtractor: passthrough,
          bodySchema: fmeSegmentKeysUpdateSchema,
          description: "Add keys to a standard segment. Provide 'add' array of key strings. Note: the Split Admin API only supports adding keys via this endpoint; removal requires the UI. Limit: 10,000 keys per request.",
        },
      },
    },
  ],
};
