import type { ToolsetDefinition, PreflightContext } from "../types.js";

// ─── Response extractors ─────────────────────────────────────────────────────

/** IaCM page size is fixed at 30 by the API. */
const IACM_PAGE_SIZE = 30;

/**
 * IACM workspace list: API returns a raw JSON array of workspace objects.
 * `page_count`  = items on THIS page only (never the real total).
 * `has_more`    = true when the page is full (another page likely exists).
 */
const workspaceListExtract = (
  raw: unknown,
): { items: unknown[]; page_count: number; has_more: boolean; pagination_note: string } => {
  const items = Array.isArray(raw) ? raw : [];
  const has_more = items.length >= IACM_PAGE_SIZE;
  return {
    items,
    page_count: items.length,
    has_more,
    pagination_note: has_more
      ? `Only ${items.length} workspaces returned (page is full). Call again with page+1 to fetch the next batch. Do NOT report ${items.length} as the total count of workspaces.`
      : `All workspaces on this page returned (${items.length} items). has_more=false means this is the last page.`,
  };
};

/**
 * IACM workspace get: API returns a single workspace object directly.
 */
const workspaceGetExtract = (raw: unknown): unknown => raw;

/**
 * IaCM workspace provisioner summary: expose the API's ratios together with
 * derived integer counts so agents can answer "how many Terraform workspaces?"
 * without listing every workspace or constructing an HQL query.
 */
const workspaceProvisionerSummaryExtract = (raw: unknown): unknown => {
  const response = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const total = typeof response.total === "number" && Number.isFinite(response.total)
    ? response.total
    : undefined;
  const provisionerRatios =
    response.provisioner && typeof response.provisioner === "object" && !Array.isArray(response.provisioner)
      ? response.provisioner as Record<string, unknown>
      : {};

  const provisioners = Object.entries(provisionerRatios)
    .filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    )
    .map(([provisioner, ratio]) => ({
      provisioner,
      ratio,
      ...(total !== undefined && ratio >= 0 && ratio <= 1 && total >= 0
        ? { workspace_count: Math.round(ratio * total) }
        : {}),
    }));

  return {
    ...(total !== undefined ? { total_workspaces: total } : {}),
    provisioners,
  };
};

/**
 * IACM resources list: API returns a ResourcesResponse with resources, outputs,
 * dataSources, and pagination metadata. Pass the full structure through so the
 * LLM sees outputs (Terraform outputs with descriptions) and data sources as well.
 * `total_items` is the REAL total from the API (not just this page's count).
 */
const iacmResourcesExtract = (raw: unknown): unknown => {
  const r = raw as {
    resources?: unknown[];
    outputs?: unknown[];
    data_sources?: unknown[];
    resourceCount?: number;
    outputCount?: number;
    dataSourceCount?: number;
    hasMore?: boolean;
    pageNumber?: number;
    totalItems?: number;
  };
  const resources = r.resources ?? [];
  const has_more = r.hasMore ?? false;
  const page_count = resources.length;
  return {
    items: resources,
    resources,
    outputs: r.outputs ?? [],
    data_sources: r.data_sources ?? [],
    page_count,
    output_count: r.outputCount ?? (r.outputs?.length ?? 0),
    data_source_count: r.dataSourceCount ?? (r.data_sources?.length ?? 0),
    has_more,
    page_number: r.pageNumber ?? 1,
    total_items: r.totalItems ?? -1,
    pagination_note: has_more
      ? `Only ${page_count} resources on this page. has_more=true — call again with page+1 to fetch the next batch. total_items=${r.totalItems ?? "unknown"} is the real total from the API.`
      : `All resources on this page (${page_count} items). has_more=false means this is the last page.`,
  };
};

/**
 * IACM module list: API returns a raw JSON array of module objects.
 * `page_count`  = items on THIS page only.
 * `has_more`    = true when page is full (another page likely exists).
 */
const moduleListExtract = (
  raw: unknown,
): { items: unknown[]; page_count: number; has_more: boolean; pagination_note: string } => {
  const items = Array.isArray(raw) ? raw : [];
  const has_more = items.length >= IACM_PAGE_SIZE;
  return {
    items,
    page_count: items.length,
    has_more,
    pagination_note: has_more
      ? `Only ${items.length} modules returned (page is full). Call again with page+1 to fetch the next batch. Do NOT report ${items.length} as the total module count.`
      : `All modules on this page returned (${items.length} items). has_more=false means this is the last page.`,
  };
};

/**
 * IACM workspace costs: API returns a raw JSON array of cost entries.
 * Costs are typically a small finite list so has_more acts as a safety signal only.
 */
const costsListExtract = (
  raw: unknown,
): { items: unknown[]; page_count: number; has_more: boolean; pagination_note: string } => {
  const items = Array.isArray(raw) ? raw : [];
  const has_more = items.length >= IACM_PAGE_SIZE;
  return {
    items,
    page_count: items.length,
    has_more,
    pagination_note: has_more
      ? `Only ${items.length} cost entries returned (page is full). Call again with page+1 for more entries. Do NOT report ${items.length} as the total.`
      : `All cost entries on this page returned (${items.length} items). has_more=false means this is the last page.`,
  };
};

/**
 * IaCM execution resource changes: keep the documented response intact while
 * preserving the older resource_changes alias for agents that look for it.
 */
const activityChangesExtract = (raw: unknown): unknown => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    if (!Array.isArray(r.resource_changes) && Array.isArray(r.planned_changes)) {
      return { ...r, resource_changes: r.planned_changes };
    }
  }
  return raw;
};

// ─── Preflight guards ────────────────────────────────────────────────────────

/**
 * Throws a clear error when the caller omits org_id or project_id.
 * IaCM APIs embed both in the URL path, so omitting either produces a 404
 * or silently hits the wrong scope.
 */
const requireProjectScope = async (ctx: PreflightContext): Promise<void> => {
  // Fall back to registry config defaults (HARNESS_ORG / HARNESS_PROJECT) before erroring,
  // mirroring the same defaulting the registry applies to path params after preflight.
  const orgId = ctx.input["org_id"] ?? ctx.registry.orgId;
  const projectId = ctx.input["project_id"] ?? ctx.registry.projectId;
  const missing: string[] = [];
  if (!orgId) missing.push("org_id");
  if (!projectId) missing.push("project_id");
  if (missing.length > 0) {
    throw new Error(
      `Missing required field(s) for this IaCM operation: ${missing.join(", ")}. ` +
        "Both org_id and project_id must be supplied explicitly — IaCM APIs are project-scoped " +
        "and will fail silently without them.",
    );
  }
};

// ─── Toolset definition ─────────────────────────────────────────────────────

export const iacmToolset: ToolsetDefinition = {
  name: "iacm",
  displayName: "Infrastructure as Code Management (IaCM)",
  description:
    "Harness IaCM (Infrastructure as Code Management) — manage Terraform workspaces, " +
    "inspect provisioned resources and Terraform outputs, browse the module registry, " +
    "review workspace cost history, and diff resource changes from past plan/apply/destroy activities. " +
    "Use iacm_workspace to list and get workspaces, iacm_workspace_provisioner_summary for counts by provisioner, " +
    "iacm_resource for Terraform resources and outputs, " +
    "iacm_module for the module registry, iacm_workspace_costs for cost breakdown, " +
    "and iacm_activity_resource_change for activity diffs.",
  optIn: false,
  resources: [
    // ─── Workspace ─────────────────────────────────────────────────────────
    {
      resourceType: "iacm_workspace",
      displayName: "IaCM Workspace",
      description:
        "A Harness IaCM workspace representing a Terraform managed environment. " +
        "Each workspace has an identifier, name, status (e.g. active, apply_needed, drifted, failed), " +
        "last run info, variables, and a cost summary. " +
        "PAGINATION: Results are capped at 30 per page (1-based, start with page=1). " +
        "The response includes has_more (true = more pages exist) and page_count (items on THIS page only). " +
        "IMPORTANT: page_count is NOT the total number of workspaces. " +
        "To find the true total or list all workspaces, keep calling with page+1 until has_more=false, then sum the page_counts. " +
        "Use harness_get with workspace_id to fetch full details of a single workspace. " +
        "See also: iacm_resource for Terraform resources, iacm_workspace_costs for cost breakdown.",
      toolset: "iacm",
      scope: "project",
      identifierFields: ["workspace_id"],
      listFilterFields: [
        {
          name: "status",
          description:
            "Filter workspaces by status. Valid values: active, inactive, apply_needed, " +
            "drifted, failed, provisioning, destroying.",
          type: "string",
          enum: [
            "active",
            "inactive",
            "apply_needed",
            "drifted",
            "failed",
            "provisioning",
            "destroying",
          ],
        },
        {
          name: "page",
          description: "Page number (1-based). Default: 1.",
          type: "number",
        },
        {
          name: "size",
          description: "Number of workspaces per page. Default: 30 (max).",
          type: "number",
        },
      ],
      relatedResources: [
        {
          resourceType: "iacm_resource",
          relationship: "contains",
          description: "Terraform resources provisioned within this workspace",
        },
        {
          resourceType: "iacm_workspace_costs",
          relationship: "cost history",
          description: "Per-execution cost breakdown for this workspace",
        },
        {
          resourceType: "iacm_activity_resource_change",
          relationship: "activity diffs",
          description: "Resource changes from plan/apply/destroy runs in this workspace",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/workspaces",
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: {
            status: "status",
            page: "page",
            size: "size",
          },
          pageOneIndexed: true,
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: workspaceListExtract,
          description:
            "List IaCM workspaces — returns at most 30 per page (page >= 1, first page is page=1). " +
            "Response fields: items (workspace objects), page_count (items on THIS page), " +
            "has_more (true = more pages exist), pagination_note (plain-English guidance). " +
            "CRITICAL: page_count is the count for this page only — NEVER report it as the total workspace count. " +
            "If has_more=true, call again with page+1 to get the next batch. " +
            "To answer 'how many workspaces are there?', paginate all pages and sum page_counts, or state the minimum seen so far with a note that more may exist.",
        },
        get: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/workspaces/{workspaceId}",
          pathParams: {
            org_id: "org",
            project_id: "project",
            workspace_id: "workspaceId",
          },
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: workspaceGetExtract,
          description:
            "Get full metadata for a specific IaCM workspace by its identifier. " +
            "Returns id, identifier, name, status, last_run, variables, cost_summary, and project_id.",
        },
      },
    },

    // ─── Workspace Provisioner Summary ─────────────────────────────────────
    {
      resourceType: "iacm_workspace_provisioner_summary",
      displayName: "IaCM Workspace Provisioner Summary",
      description:
        "Workspace counts and ratios grouped by IaCM provisioner (for example Terraform or OpenTofu). " +
        "Use harness_get on this resource for questions such as 'how many workspaces use Terraform?'. " +
        "Returns total_workspaces and provisioners entries containing provisioner, ratio, and workspace_count. " +
        "This avoids unsupported provisioner filters on iacm_workspace and does not require Knowledge Graph/HQL.",
      searchAliases: [
        "terraform workspace count",
        "workspaces by provisioner",
        "workspace provisioner count",
        "number of terraform workspaces",
      ],
      toolset: "iacm",
      scope: "project",
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/workspaces/provisioners-ratio",
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: {
            start_time: "start_time",
            end_time: "end_time",
          },
          paramsSchema: {
            fields: [
              {
                name: "start_time",
                required: false,
                description: "Optional start time filter as a Unix timestamp.",
              },
              {
                name: "end_time",
                required: false,
                description: "Optional end time filter as a Unix timestamp.",
              },
            ],
          },
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: workspaceProvisionerSummaryExtract,
          description:
            "Get IaCM workspace totals grouped by provisioner. " +
            "Use provisioners[].workspace_count for the number using a named provisioner.",
        },
      },
    },

    // ─── Terraform Resources / Outputs / DataSources ───────────────────────
    {
      resourceType: "iacm_resource",
      displayName: "IaCM Terraform Resource",
      description:
        "Terraform resources, outputs, and data sources provisioned within an IaCM workspace. " +
        "The list response contains three sections: resources (name, type, provider, drift_status, cost), " +
        "outputs (Terraform outputs with name, value, sensitive flag, description), and data_sources. " +
        "PAGINATION: Results are capped at 30 per page. " +
        "Response includes has_more, page_count (THIS page only), and total_items (real API total when available). " +
        "IMPORTANT: page_count is NOT the total resource count. Use total_items when present; " +
        "otherwise paginate until has_more=false and sum page_counts. " +
        "workspace_id is required — use harness_list with iacm_workspace to find workspace identifiers.",
      toolset: "iacm",
      scope: "project",
      identifierFields: ["workspace_id"],
      listFilterFields: [
        {
          name: "workspace_id",
          required: true,
          description:
            "The workspace identifier (use harness_list with iacm_workspace to find it). " +
            "Resources, outputs, and data sources are always scoped to a single workspace.",
          type: "string",
        },
        {
          name: "page",
          description: "Page number (1-based). Default: 1.",
          type: "number",
        },
        {
          name: "size",
          description: "Number of resources per page. Default: 30 (max).",
          type: "number",
        },
      ],
      relatedResources: [
        {
          resourceType: "iacm_workspace",
          relationship: "belongs to",
          description: "The workspace that manages these Terraform resources",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/workspaces/{workspaceId}/resources",
          pathParams: {
            org_id: "org",
            project_id: "project",
            workspace_id: "workspaceId",
          },
          queryParams: {
            page: "page",
            size: "size",
          },
          pageOneIndexed: true,
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: iacmResourcesExtract,
          description:
            "List Terraform resources, outputs, and data sources for a workspace (30 per page; page >= 1). " +
            "Response fields: resources, outputs, data_sources, page_count (THIS page), " +
            "total_items (real API total if available, -1 if unknown), has_more, pagination_note. " +
            "CRITICAL: page_count is the count for this page only — NEVER report it as the total resource count. " +
            "Use total_items when it is >= 0 as the authoritative total. " +
            "If has_more=true, call again with page+1. " +
            "To answer 'how many resources?', prefer total_items; if -1, paginate all pages and sum page_counts.",
        },
      },
    },

    // ─── Module Registry ───────────────────────────────────────────────────
    {
      resourceType: "iacm_module",
      displayName: "IaCM Module Registry",
      description:
        "Terraform modules registered in the Harness IaCM module registry. " +
        "Modules have a name, version, provider, source_repo, tags, and invocation_count. " +
        "PAGINATION: Results are capped at 30 per page (1-based). " +
        "Response includes has_more (true = more pages exist) and page_count (items on THIS page only). " +
        "IMPORTANT: page_count is NOT the total module count. " +
        "To find the true total, paginate until has_more=false and sum the page_counts. " +
        "Use harness_get with the numeric id field (from list) to fetch full module details.",
      toolset: "iacm",
      scope: "account",
      identifierFields: ["id"],
      listFilterFields: [
        {
          name: "tag",
          description: "Filter modules by tag.",
          type: "string",
        },
        {
          name: "version",
          description: "Filter modules by version string.",
          type: "string",
        },
        {
          name: "provider",
          description: "Filter modules by Terraform provider (e.g. aws, azurerm).",
          type: "string",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/iacm/api/modules",
          queryParams: {
            tag: "tag",
            version: "version",
            provider: "provider",
            page: "page",
            size: "size",
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: moduleListExtract,
          description:
            "List Terraform modules in the IaCM module registry (30 per page; page >= 1). " +
            "Response fields: items (module objects), page_count (THIS page only), has_more, pagination_note. " +
            "CRITICAL: page_count is the count for this page only — NEVER report it as the total module count. " +
            "If has_more=true, call again with page+1. " +
            "To answer 'how many modules?', paginate all pages and sum page_counts.",
        },
        get: {
          method: "GET",
          path: "/iacm/api/modules/{moduleId}",
          pathParams: { id: "moduleId" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: (raw: unknown) => raw,
          description:
            "Get full details for a specific IaCM module. " +
            "IMPORTANT: id must be the numeric id from the list response (e.g. '4640'), " +
            "NOT the module name (e.g. 'buha-module-v2'). " +
            "Always call harness_list on iacm_module first to get the numeric id, then call harness_get.",
        },
      },
    },

    // ─── Workspace Costs ───────────────────────────────────────────────────
    {
      resourceType: "iacm_workspace_costs",
      displayName: "IaCM Workspace Costs",
      description:
        "Per-execution cost history for an IaCM workspace. Each entry has cost amount, currency, " +
        "pipeline info (pipeline_execution_id, pipeline_stage_id), and a timestamp. " +
        "workspace_id is required. " +
        "Useful for understanding the financial impact of Terraform-managed infrastructure over time. " +
        "See also: iacm_workspace for workspace metadata, iacm_resource for resource-level cost_data.",
      toolset: "iacm",
      scope: "project",
      identifierFields: ["workspace_id"],
      listFilterFields: [
        {
          name: "workspace_id",
          required: true,
          description: "The workspace identifier. Use harness_list with iacm_workspace to find it.",
          type: "string",
        },
      ],
      relatedResources: [
        {
          resourceType: "iacm_workspace",
          relationship: "costs for",
          description: "The workspace whose cost history this shows",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/costs/{workspaceId}",
          pathParams: {
            org_id: "org",
            project_id: "project",
            workspace_id: "workspaceId",
          },
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: costsListExtract,
          description:
            "Get cost breakdown for a specific IaCM workspace (30 per page; page >= 1). " +
            "Response fields: items (cost entries), page_count (THIS page only), has_more, pagination_note. " +
            "Each cost entry contains per-execution cost, currency, pipeline info, and timestamps. " +
            "CRITICAL: page_count is the count for this page only — NEVER report it as the total cost-entry count. " +
            "If has_more=true, call again with page+1 for more entries.",
        },
      },
    },

    // ─── Activity Resource Changes ─────────────────────────────────────────
    {
      resourceType: "iacm_activity_resource_change",
      displayName: "IaCM Activity Resource Change",
      description:
        "Resource attribute diffs from a specific IaCM activity (plan, apply, or destroy execution). " +
        "Each entry has resource_name, resource_type, provider, action (add/change/destroy/no-op), " +
        "and changed_attributes with before/after values. " +
        "Response also includes summary counts: total_added, total_changed, total_destroyed, total_unchanged. " +
        "Both activity_id and workspace_id are required. " +
        "Activity IDs appear in the workspace execution history in the Harness UI.",
      toolset: "iacm",
      scope: "project",
      identifierFields: ["activity_id", "workspace_id"],
      listFilterFields: [
        {
          name: "activity_id",
          required: true,
          description:
            "The UUID of the IaCM activity (e.g. 'd2487e0d-a0a4-40ee-b502-7e6e8fb3fd0a'). " +
            "Found in workspace execution history in the Harness UI.",
          type: "string",
        },
        {
          name: "workspace_id",
          required: true,
          description: "The workspace identifier the activity belongs to.",
          type: "string",
        },
      ],
      relatedResources: [
        {
          resourceType: "iacm_workspace",
          relationship: "activity in",
          description: "The workspace this activity ran in",
        },
        {
          resourceType: "iacm_resource",
          relationship: "changed resources",
          description: "The Terraform resources that were modified in this activity",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/activities/{activityId}/resource-changes",
          pathParams: {
            org_id: "org",
            project_id: "project",
            activity_id: "activityId",
          },
          queryParams: {
            workspace_id: "workspace",
          },
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: activityChangesExtract,
          description:
            "List resource changes for a specific IaCM activity (plan, apply, or destroy). " +
            "Returns per-resource before/after attribute diffs, action (add/change/destroy/no-op), " +
            "and summary counts (total_added, total_changed, total_destroyed, total_unchanged). " +
            "Requires activity_id (path) and workspace_id (query param).",
        },
      },
    },
  ],
};
