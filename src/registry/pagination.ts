/**
 * Header-derived pagination metadata.
 *
 * Harness v1 list endpoints return a bare JSON array and report the size of the
 * matching population only in response headers (`X-Total-Elements`, documented
 * on e.g. IDP `GET /v1/entities`). A body-only extractor therefore has to fall
 * back to `items.length`, which makes `total` the *page* size: a caller asking
 * "how many components does team PL own" sees `total: 20` for a population of
 * 507 and has no signal that more pages exist. Counts then come out as the sum
 * of however many pages the caller happened to fetch — an undercount.
 *
 * So when the response carried a total header, publish it as `total` and derive
 * `has_more` so a caller can tell a complete answer from a partial one.
 */

/** Response headers that carry the size of the whole matching population. */
const TOTAL_HEADERS = ["x-total-elements", "x-total-count", "x-total-items"] as const;
const PAGE_NUMBER_HEADERS = ["x-page-number", "x-page-index"] as const;
const PAGE_SIZE_HEADERS = ["x-page-size"] as const;

function headerNumber(headers: Record<string, string>, names: readonly string[]): number | undefined {
  for (const name of names) {
    const raw = headers[name];
    if (raw === undefined) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

/**
 * Enrich an extracted list result with the authoritative total from response
 * headers.
 *
 * Only `total` values that the extractor derived from the page itself are
 * replaced: an extractor that read a real total out of the body (`totalElements`,
 * `pagination.totalItems`, …) stays authoritative, since the header is only a
 * better source than a page-length guess.
 */
export function applyHeaderPagination(result: unknown, headers: Record<string, string>): unknown {
  if (result === null || typeof result !== "object" || Array.isArray(result)) return result;

  const record = result as Record<string, unknown>;
  const items = record.items;
  if (!Array.isArray(items)) return result;

  const total = headerNumber(headers, TOTAL_HEADERS);
  if (total === undefined) return result;

  // A body-provided total is already population-wide; a total equal to the
  // page length is the `items.length` fallback and is what we are fixing.
  const existingTotal = record.total;
  if (typeof existingTotal === "number" && existingTotal !== items.length) return result;

  const pageNumber = headerNumber(headers, PAGE_NUMBER_HEADERS);
  const pageSize = headerNumber(headers, PAGE_SIZE_HEADERS) ?? items.length;

  // Rows already consumed when this page was served. Without a page number the
  // best we can say is "this page", which still catches the common first-page
  // undercount (items.length < total ⇒ more pages exist).
  const consumed = pageNumber !== undefined ? pageNumber * pageSize + items.length : items.length;

  record.total = total;
  if (pageNumber !== undefined && record.page === undefined) record.page = pageNumber;
  if (pageSize > 0 && record.page_size === undefined) record.page_size = pageSize;
  record.has_more = consumed < total;

  return result;
}
