const IACM_PAGE_SIZE = 30;
const ANSIBLE_PAGE_SIZE = 20;

export const workspaceListExtract = (
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

export const workspaceGetExtract = (raw: unknown): unknown => raw;

export const workspaceWriteExtract = (raw: unknown): unknown => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const rec = raw as Record<string, unknown>;
  return {
    policy_evaluation: rec.policy_evaluation ?? null,
  };
};

export const variableSetListExtract = (
  raw: unknown,
): { items: unknown[]; page_count: number; has_more: boolean; pagination_note: string } => {
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
      ? (raw as { items: unknown[] }).items
      : [];
  return {
    items,
    page_count: items.length,
    has_more: false,
    pagination_note: `Returned ${items.length} variable set(s). This endpoint is not paginated — treat page_count as the full result size for the selected scope.`,
  };
};

export const variableSetExtract = (raw: unknown): unknown => raw;

export const iacmResourcesExtract = (raw: unknown): unknown => {
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

export const moduleListExtract = (
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

export const moduleExtract = (raw: unknown): unknown => raw;

export const providerListExtract = (
  raw: unknown,
): { items: unknown[]; page_count: number; has_more: boolean; pagination_note: string } => {
  const items = Array.isArray(raw) ? raw : [];
  const has_more = items.length >= IACM_PAGE_SIZE;
  return {
    items,
    page_count: items.length,
    has_more,
    pagination_note: has_more
      ? `Only ${items.length} providers returned (page is full). Call again with page+1 to fetch the next batch. Do NOT report ${items.length} as the total provider count.`
      : `All providers on this page returned (${items.length} items). has_more=false means this is the last page.`,
  };
};

export const providerExtract = (raw: unknown): unknown => raw;

export const costsListExtract = (
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

export const activityChangesExtract = (raw: unknown): unknown => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    if (!Array.isArray(r.resource_changes) && Array.isArray(r.planned_changes)) {
      return { ...r, resource_changes: r.planned_changes };
    }
  }
  return raw;
};

export const ansibleListExtract = (
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
