import type { ToolsetDefinition, BodySchema, FilterFieldSpec } from "../types.js";
import { passthrough, harV3ListExtract } from "../extractors.js";
import { V3_SCOPE_PARAMS, V3_PACKAGE_TYPES, V3_SORT_DESC, V3_PACKAGE_TYPES_DESC } from "./registries-v3.js";

const LIFECYCLE_SCOPES = ["account", "org", "project"] as const;
const LIFECYCLE_ACTIONS = ["DELETE", "PROTECT"];
const LIFECYCLE_EXECUTION_STATUSES = ["PENDING", "INPROGRESS", "SUCCESS", "FAILED"];
const LIFECYCLE_ITEM_STATUSES = ["PROTECTED", "WOULD_BE_DELETED", "DELETED"];

const lifecycleScopeFilter: FilterFieldSpec = {
  name: "scope",
  description: "none = current scope only (default), ancestors = plus parent scopes, descendants = plus child scopes",
  enum: ["none", "ancestors", "descendants"],
};
const packageTypesFilter: FilterFieldSpec = { name: "package_types", description: V3_PACKAGE_TYPES_DESC, enum: V3_PACKAGE_TYPES };
const registryIdsFilter: FilterFieldSpec = { name: "registry_ids", description: "Comma-separated registry UUIDs" };

const compactLifecycleRuleV3 = (item: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (item.id != null) { out.rule_id = item.id; out.id = item.id; }
  for (const key of [
    "name", "action", "enabled", "packageType", "applyTo", "criteria", "schedule",
    "lastRunAt", "nextRunAt", "hasLocalAssignment", "orgIdentifier", "projectIdentifier", "updatedAt",
  ]) {
    if (item[key] != null) out[key] = item[key];
  }
  return out;
};

const compactLifecycleExecutionV3 = (item: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (item.id != null) { out.execution_id = item.id; out.id = item.id; }
  for (const key of [
    "policyId", "policyName", "status", "triggerType", "message", "startedAt", "completedAt", "createdAt",
    "registriesAffected", "packagesAffected", "versionsDeleted", "storageReclaimed", "protected",
    "orgIdentifier", "projectIdentifier",
  ]) {
    if (item[key] != null) out[key] = item[key];
  }
  return out;
};

const dryRunBodySchema: BodySchema = {
  description: "Lifecycle rule to dry-run. Pass rule_id instead of a body if you prefer.",
  fields: [
    { name: "policyId", type: "string", required: true, description: "Lifecycle rule ID (rule_id from lifecycle_rule_v3)" },
  ],
};

const dryRunBody = (input: Record<string, unknown>): Record<string, unknown> => {
  const body = input.body as Record<string, unknown> | undefined;
  const policyId = input.rule_id ?? body?.policyId ?? body?.rule_id;
  if (typeof policyId !== "string" || policyId.trim() === "") {
    throw new Error("dry_run needs rule_id (the lifecycle rule ID from lifecycle_rule_v3 list).");
  }
  return { policyId: policyId.trim() };
};

/**
 * HAR v3 lifecycle (retention / cleanup) toolset — reads plus dry run.
 *
 * Lifecycle rules have no v1 equivalent, so like `registries-firewall` this is
 * default-enabled rather than gated behind the `registries-v3` opt-in.
 * Rules, executions and stats exist at account, org and project scope.
 *
 * Rule create/update/patch/delete and execution revert are deliberately not
 * exposed: they can delete artifacts and need explicit gating first.
 */
export const registriesLifecycleToolset: ToolsetDefinition = {
  name: "registries-lifecycle",
  displayName: "Artifact Registry Lifecycle (v3)",
  description:
    "Harness Artifact Registry v3 lifecycle (retention/cleanup) rules, executions, execution items and stats, " +
    "plus a dry run that reports which versions a rule would delete without deleting anything.",
  optIn: false,
  resources: [
    {
      resourceType: "lifecycle_rule_v3",
      displayName: "Lifecycle Rule (v3)",
      description:
        "Artifact Registry retention rule: DELETE (cleanup) or PROTECT, its criteria (KEEP_LAST_N / AGE_BASED / UNUSED_FOR), " +
        "target registries, package filters and schedule. Use execute action dry_run to preview what a rule would delete.",
      toolset: "registries-lifecycle",
      scope: "project",
      supportedScopes: LIFECYCLE_SCOPES,
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["rule_id"],
      compactItem: compactLifecycleRuleV3,
      searchAliases: ["retention policy", "cleanup policy", "artifact cleanup rule"],
      listFilterFields: [
        { name: "search_term", description: "Filter rules by name" },
        { name: "action", description: "Rule action", enum: LIFECYCLE_ACTIONS },
        packageTypesFilter,
        registryIdsFilter,
        lifecycleScopeFilter,
        { name: "sort", description: V3_SORT_DESC },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/lifecycle/rules",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
            action: "action",
            package_types: "package_types",
            registry_ids: "registry_ids",
            scope: "scope",
            sort: "sort",
            page: "page",
            size: "size",
          },
          responseExtractor: harV3ListExtract,
          description: "List lifecycle rules (v3)",
        },
        get: {
          method: "GET",
          path: "/har/api/v3/lifecycle/rules/{id}",
          pathParams: { rule_id: "id" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get a lifecycle rule by ID (v3)",
        },
      },
      executeActions: {
        dry_run: {
          method: "POST",
          path: "/har/api/v3/lifecycle/executions",
          // Records a DRY_RUN execution but never deletes anything.
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: dryRunBody,
          responseExtractor: passthrough,
          actionDescription:
            "Start a dry run of a lifecycle rule; nothing is deleted. Requires rule_id. Returns an execution (triggerType DRY_RUN). " +
            "Poll harness_get resource_type=lifecycle_execution_v3 until status is SUCCESS or FAILED, then list " +
            "lifecycle_execution_item_v3 with status=WOULD_BE_DELETED to see affected versions.",
          bodySchema: dryRunBodySchema,
        },
      },
    },
    {
      resourceType: "lifecycle_execution_v3",
      displayName: "Lifecycle Execution (v3)",
      description:
        "A scheduled or dry-run evaluation of a lifecycle rule, with counts of registries, packages and versions affected, " +
        "versions deleted (would-be-deleted for DRY_RUN), versions protected and storage reclaimed.",
      toolset: "registries-lifecycle",
      scope: "project",
      supportedScopes: LIFECYCLE_SCOPES,
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: ["execution_id"],
      compactItem: compactLifecycleExecutionV3,
      listFilterFields: [
        { name: "search_term", description: "Filter executions by rule name" },
        { name: "status", description: "Execution status", enum: LIFECYCLE_EXECUTION_STATUSES },
        packageTypesFilter,
        registryIdsFilter,
        lifecycleScopeFilter,
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/lifecycle/executions",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
            status: "status",
            package_types: "package_types",
            registry_ids: "registry_ids",
            scope: "scope",
            page: "page",
            size: "size",
          },
          responseExtractor: harV3ListExtract,
          description: "List lifecycle executions (v3)",
        },
        get: {
          method: "GET",
          path: "/har/api/v3/lifecycle/executions/{executionId}",
          pathParams: { execution_id: "executionId" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get a lifecycle execution by ID (v3)",
        },
      },
    },
    {
      resourceType: "lifecycle_execution_item_v3",
      displayName: "Lifecycle Execution Item (v3)",
      description:
        "Artifact versions evaluated by one lifecycle execution, each PROTECTED, WOULD_BE_DELETED (dry run) or DELETED, with the reason.",
      toolset: "registries-lifecycle",
      scope: "project",
      supportedScopes: LIFECYCLE_SCOPES,
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: [],
      listFilterFields: [
        { name: "execution_id", description: "Lifecycle execution ID (required)", required: true },
        { name: "status", description: "Item outcome", enum: LIFECYCLE_ITEM_STATUSES },
        { name: "search_term", description: "Filter items by package name" },
        packageTypesFilter,
        registryIdsFilter,
        lifecycleScopeFilter,
      ],
      operations: {
        list: {
          method: "GET",
          path: "/har/api/v3/lifecycle/executions/{executionId}/items",
          pathParams: { execution_id: "executionId" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            status: "status",
            search_term: "search_term",
            package_types: "package_types",
            registry_ids: "registry_ids",
            scope: "scope",
            page: "page",
            size: "size",
          },
          skipCompact: true,
          responseExtractor: harV3ListExtract,
          description: "List items evaluated by a lifecycle execution (v3)",
        },
      },
    },
    {
      resourceType: "lifecycle_stats_v3",
      displayName: "Lifecycle Stats (v3)",
      description:
        "Aggregate lifecycle metrics for a scope: total storage reclaimed (bytes), artifact versions cleaned, and executions in the last 30 days.",
      toolset: "registries-lifecycle",
      scope: "project",
      supportedScopes: LIFECYCLE_SCOPES,
      scopeParams: V3_SCOPE_PARAMS,
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: "/har/api/v3/lifecycle/stats",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
            action: "action",
            package_types: "package_types",
            registry_ids: "registry_ids",
            scope: "scope",
          },
          responseExtractor: passthrough,
          description: "Get lifecycle stats (v3). Optional: action, package_types, registry_ids, scope, search_term.",
        },
      },
    },
  ],
};
