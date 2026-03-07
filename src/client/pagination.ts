import type { HarnessClient } from "./harness-client.js";
import type { RequestOptions } from "./types.js";

interface PaginateOptions {
  client: HarnessClient;
  request: RequestOptions;
  maxItems?: number;
  pageSize?: number;
}

/**
 * Generic async paginator for Harness list endpoints.
 * Handles both page-based (NG API) and offset-based patterns.
 */
export async function paginate<T>(opts: PaginateOptions): Promise<{ items: T[]; total: number }> {
  const { client, request, maxItems: rawMax = 100, pageSize: rawSize = 20 } = opts;
  const maxItems = Math.min(Math.max(rawMax, 1), 10_000);
  const pageSize = Math.min(Math.max(rawSize, 1), 100);
  const allItems: T[] = [];
  let page = 0;
  let total = 0;

  while (allItems.length < maxItems) {
    const size = Math.min(pageSize, maxItems - allItems.length);
    const params = { ...request.params, page, size };

    const response = await client.request<{
      data?: { content?: T[]; totalElements?: number; totalItems?: number };
      content?: T[];
      totalElements?: number;
      totalItems?: number;
    }>({
      ...request,
      params: params as Record<string, string | number | boolean | undefined>,
    });

    // Handle multiple response shapes
    const content = response.data?.content ?? response.content ?? [];
    total = response.data?.totalElements ?? response.data?.totalItems ?? response.totalElements ?? response.totalItems ?? 0;

    if (content.length === 0) break;

    allItems.push(...(content as T[]));
    page++;

    if (content.length < size) break; // last page
  }

  return { items: allItems, total };
}
