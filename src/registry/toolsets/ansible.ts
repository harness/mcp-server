import type { ToolsetDefinition, PreflightContext } from "../types.js";

// ─── Response extractors ─────────────────────────────────────────────────────

/** Must match harness_list tool default size (src/tools/harness-list.ts). */
const ANSIBLE_PAGE_SIZE = 20;

/**
 * All Ansible list endpoints return a raw JSON array.
 * `page_count` = items on THIS page only (never the real total).
 * `has_more`   = true when the page is full (another page likely exists).
 */
const ansibleListExtract = (
  raw: unknown,
  input?: Record<string, unknown>,
): { items: unknown[]; page_count: number; has_more: boolean; pagination_note: string } => {
  if (!Array.isArray(raw)) {
    throw new Error(
      `Ansible list endpoint returned unexpected payload shape: expected a JSON array, got ${raw === null ? "null" : typeof raw}. ` +
        `Payload: ${JSON.stringify(raw)}`,
    );
  }
  const items = raw;
  const requestedSize = typeof input?.["size"] === "number" ? input["size"] : ANSIBLE_PAGE_SIZE;
  const has_more = items.length >= requestedSize;
  return {
    items,
    page_count: items.length,
    has_more,
    pagination_note: has_more
      ? `Only ${items.length} items returned (page is full). Call again with page+1 to fetch the next batch. Do NOT report ${items.length} as the total count.`
      : `All items on this page returned (${items.length} items). has_more=false means this is the last page.`,
  };
};

// ─── Preflight guards ────────────────────────────────────────────────────────

const requireProjectScope = async (ctx: PreflightContext): Promise<void> => {
  const cfg = (ctx.registry as unknown as { config: { HARNESS_ORG?: string; HARNESS_PROJECT?: string } }).config ?? {};
  const orgId = ctx.input["org_id"] ?? cfg.HARNESS_ORG;
  const projectId = ctx.input["project_id"] ?? cfg.HARNESS_PROJECT;
  const missing: string[] = [];
  if (!orgId) missing.push("org_id");
  if (!projectId) missing.push("project_id");
  if (missing.length > 0) {
    throw new Error(
      `Missing required field(s) for this Ansible operation: ${missing.join(", ")}. ` +
        "Both org_id and project_id must be supplied — Ansible APIs are project-scoped.",
    );
  }
};

// ─── Toolset definition ─────────────────────────────────────────────────────

export const ansibleToolset: ToolsetDefinition = {
  name: "ansible",
  displayName: "Ansible",
  description:
    "Harness Ansible — manage Ansible inventories (static, dynamic, plugin), playbooks, " +
    "hosts, and activity history. Use ansible_inventory to manage host inventories, " +
    "ansible_playbook to manage playbooks backed by Git repositories, " +
    "ansible_host to inspect individual hosts and their last run status, " +
    "and ansible_activity to review past Ansible execution activity.",
  optIn: true,
  resources: [
    // ─── Inventory ──────────────────────────────────────────────────────────
    {
      resourceType: "ansible_inventory",
      displayName: "Ansible Inventory",
      description:
        "An Ansible inventory managed by Harness. Inventories can be static (manual), " +
        "dynamic (script-based), or plugin-based. Each inventory has an identifier, name, " +
        "type (manual|dynamic|plugin), and a data payload describing hosts and groups. " +
        "Use harness_list to list inventories and harness_get with inventory_id for full details. " +
        "See also: ansible_host for individual host status, ansible_activity for run history.",
      toolset: "ansible",
      scope: "project",
      identifierFields: ["inventory_id"],
      listFilterFields: [
        {
          name: "search_term",
          description: "Filter inventories by name (partial match).",
          type: "string",
        },
        {
          name: "page",
          description: "Page number (0-based). Default: 0.",
          type: "number",
        },
        {
          name: "size",
          description: "Number of inventories per page. Default: 20.",
          type: "number",
        },
      ],
      relatedResources: [
        {
          resourceType: "ansible_host",
          relationship: "contains",
          description: "Hosts belonging to this inventory",
        },
        {
          resourceType: "ansible_activity",
          relationship: "activity in",
          description: "Ansible runs that used this inventory",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/ansible/inventory",
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: { search_term: "searchTerm", size: "limit", page: "page" },
          pageOneIndexed: true,
          skipCompact: true,
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: ansibleListExtract,
          description: "List Ansible inventories in the project.",
        },
        get: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/ansible/inventory/{inventoryId}",
          pathParams: { org_id: "org", project_id: "project", inventory_id: "inventoryId" },
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: (raw: unknown) => raw,
          description: "Get full details for a specific Ansible inventory.",
        },
      },
    },

    // ─── Playbook ────────────────────────────────────────────────────────────
    {
      resourceType: "ansible_playbook",
      displayName: "Ansible Playbook",
      description:
        "An Ansible playbook managed by Harness, backed by a Git repository. " +
        "Each playbook has an identifier, name, repository connection details " +
        "(repository, repository_branch, repository_connector, repository_path), " +
        "and optional Ansible Galaxy support. " +
        "Use harness_list to browse playbooks and harness_get for full details. " +
        "See also: ansible_activity for run history.",
      toolset: "ansible",
      scope: "project",
      identifierFields: ["playbook_id"],
      listFilterFields: [
        {
          name: "search_term",
          description: "Filter playbooks by name (partial match).",
          type: "string",
        },
        {
          name: "page",
          description: "Page number (0-based). Default: 0.",
          type: "number",
        },
        {
          name: "size",
          description: "Number of playbooks per page. Default: 20.",
          type: "number",
        },
      ],
      relatedResources: [
        {
          resourceType: "ansible_activity",
          relationship: "activity in",
          description: "Ansible runs that executed this playbook",
        },
        {
          resourceType: "ansible_inventory",
          relationship: "runs against",
          description: "Inventories used when running this playbook",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/ansible/playbook",
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: { search_term: "searchTerm", size: "limit", page: "page" },
          pageOneIndexed: true,
          skipCompact: true,
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: ansibleListExtract,
          description: "List Ansible playbooks in the project.",
        },
        get: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/ansible/playbook/{playbookId}",
          pathParams: { org_id: "org", project_id: "project", playbook_id: "playbookId" },
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: (raw: unknown) => raw,
          description: "Get full details for a specific Ansible playbook.",
        },
      },
    },

    // ─── Host ────────────────────────────────────────────────────────────────
    {
      resourceType: "ansible_host",
      displayName: "Ansible Host",
      description:
        "An individual host managed by Harness Ansible. Each host has a host_address, " +
        "a list of inventories it belongs to, and last_activity details (status, playbooks run, timestamp). " +
        "Hosts are read-only — manage them through ansible_inventory. " +
        "Use harness_list to browse all hosts, harness_get with host_id for full details including stats.",
      toolset: "ansible",
      scope: "project",
      identifierFields: ["host_id"],
      listFilterFields: [
        {
          name: "search_term",
          description: "Filter hosts by address (partial match).",
          type: "string",
        },
        {
          name: "page",
          description: "Page number (0-based). Default: 0.",
          type: "number",
        },
        {
          name: "size",
          description: "Number of hosts per page. Default: 20.",
          type: "number",
        },
      ],
      relatedResources: [
        {
          resourceType: "ansible_inventory",
          relationship: "member of",
          description: "Inventories this host belongs to",
        },
        {
          resourceType: "ansible_activity",
          relationship: "activity for",
          description: "Ansible runs that targeted this host",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/ansible/hosts",
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: { search_term: "searchTerm", size: "limit", page: "page" },
          pageOneIndexed: true,
          skipCompact: true,
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: ansibleListExtract,
          description: "List all Ansible hosts across inventories in the project. Supports search_term to filter by host address.",
        },
        get: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/ansible/hosts/{hostId}",
          pathParams: { org_id: "org", project_id: "project", host_id: "hostId" },
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: (raw: unknown) => raw,
          description: "Get full details for a specific Ansible host including last_activity and stats.",
        },
      },
    },

    // ─── Activity ────────────────────────────────────────────────────────────
    {
      resourceType: "ansible_activity",
      displayName: "Ansible Activity",
      description:
        "A record of an Ansible execution (playbook run) in Harness. Each activity tracks " +
        "which inventories and playbooks were used, the pipeline execution that triggered it, " +
        "git context (repo, branch, commit), and metrics (total_hosts, total_tasks, duration_ms, " +
        "host_ok, host_failed, host_unreachable). " +
        "Activities are read-only records of past runs.",
      toolset: "ansible",
      scope: "project",
      identifierFields: ["activity_id"],
      listFilterFields: [
        {
          name: "page",
          description: "Page number (0-based). Default: 0.",
          type: "number",
        },
        {
          name: "size",
          description: "Number of activities per page. Default: 20.",
          type: "number",
        },
      ],
      relatedResources: [
        {
          resourceType: "ansible_inventory",
          relationship: "used inventory",
          description: "Inventory used in this activity",
        },
        {
          resourceType: "ansible_playbook",
          relationship: "ran playbook",
          description: "Playbook executed in this activity",
        },
        {
          resourceType: "ansible_host",
          relationship: "targeted hosts",
          description: "Hosts targeted in this activity",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/ansible/activities",
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: { size: "limit", page: "page" },
          pageOneIndexed: true,
          skipCompact: true,
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: ansibleListExtract,
          description: "List Ansible activity records (playbook run history) for the project.",
        },
        get: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/ansible/activities/{activityId}",
          pathParams: { org_id: "org", project_id: "project", activity_id: "activityId" },
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: (raw: unknown) => raw,
          description: "Get full details for a specific Ansible activity including metrics and git context.",
        },
      },
    },

    // ─── Host Activity ───────────────────────────────────────────────────────
    {
      resourceType: "ansible_host_activity",
      displayName: "Ansible Host Activity",
      description:
        "Activity history for a specific Ansible host — the list of playbook runs that targeted it. " +
        "Each entry includes the playbooks and inventories used, pipeline context, git info, " +
        "per-task breakdown (name, action, status, changed, duration_ms), and run-level stats " +
        "(ok, changed, failures, unreachable, skipped). " +
        "host_id is required — use harness_list with ansible_host to find it.",
      toolset: "ansible",
      scope: "project",
      identifierFields: ["host_id"],
      listFilterFields: [
        {
          name: "host_id",
          required: true,
          description: "The host UUID. Use harness_list with ansible_host to find it.",
          type: "string",
        },
        {
          name: "page",
          description: "Page number (0-based). Default: 0.",
          type: "number",
        },
        {
          name: "size",
          description: "Number of activities per page. Default: 20.",
          type: "number",
        },
      ],
      relatedResources: [
        {
          resourceType: "ansible_host",
          relationship: "activity for",
          description: "The host whose activity history this shows",
        },
        {
          resourceType: "ansible_playbook",
          relationship: "ran playbook",
          description: "Playbooks executed in these activities",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/iacm/api/orgs/{org}/projects/{project}/ansible/hosts/{hostId}/activities",
          pathParams: { org_id: "org", project_id: "project", host_id: "hostId" },
          queryParams: { size: "limit", page: "page" },
          pageOneIndexed: true,
          skipCompact: true,
          preflight: requireProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: ansibleListExtract,
          description:
            "List activity history for a specific Ansible host. " +
            "Returns per-task breakdowns including name, action, status, changed flag, and duration_ms. " +
            "Requires host_id.",
        },
      },
    },
  ],
};
