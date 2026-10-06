/**
 * Time-input parsing for CCM tools.
 *
 * LLM callers routinely pass dates as `YYYY-MM-DD` strings. Historically these
 * were coerced with `Number()`, became NaN, and were silently dropped — the
 * query then fell back to the default LAST_30_DAYS window and the agent
 * analysed the wrong days. These helpers parse dates strictly and throw a
 * descriptive error instead of falling back.
 *
 * All dates are interpreted in UTC (CCM daily buckets are UTC midnight).
 */

const DAY_MS = 86_400_000;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** ISO 8601 datetime; guards against Date.parse's lenient legacy formats (e.g. "sept 28"). */
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/i;
/** Trailing timezone designator on an ISO datetime. */
const TZ_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Epoch values below this are treated as seconds, at or above as milliseconds. */
const MS_THRESHOLD = 1e11;
/** Smallest accepted epoch-seconds value (2001-09-09); rejects things like 20260928. */
const MIN_SECONDS = 1e9;

function invalid(field: string, value: unknown): Error {
  return new Error(
    `Invalid ${field}: ${JSON.stringify(value)}. Use a date "YYYY-MM-DD" (UTC), an ISO 8601 datetime, or epoch milliseconds.`,
  );
}

/**
 * Parse a single time input into epoch milliseconds.
 *
 * - number / numeric string: epoch ms (10-digit values are treated as epoch seconds)
 * - "YYYY-MM-DD": UTC midnight for a start, and the END OF THAT DAY
 *   (23:59:59.999 UTC) for an end, so "Sep 28 to Sep 29" includes both days
 * - other ISO 8601 strings: used exactly as given
 *
 * Returns undefined for null/undefined/empty input; throws on anything unparseable.
 */
export function parseTimeInput(
  value: unknown,
  field: string,
  opts: { endOfDay?: boolean } = {},
): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;

  if (typeof value === "number" || (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim()))) {
    const n = typeof value === "number" ? value : Number(value.trim());
    if (!Number.isFinite(n) || n < MIN_SECONDS) throw invalid(field, value);
    return Math.trunc(n < MS_THRESHOLD ? n * 1000 : n);
  }

  if (typeof value !== "string") throw invalid(field, value);
  const str = value.trim();

  const m = DATE_ONLY_RE.exec(str);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const start = Date.UTC(y, mo - 1, d);
    const check = new Date(start);
    // Round-trip check rejects impossible dates such as 2026-02-31.
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
      throw invalid(field, value);
    }
    return opts.endOfDay ? start + DAY_MS - 1 : start;
  }

  if (!ISO_DATETIME_RE.test(str)) throw invalid(field, value);
  // A datetime without an offset would be read in the server's local timezone by
  // Date.parse; CCM buckets are UTC, so treat zone-less values as UTC.
  const iso = str.replace(" ", "T");
  const parsed = Date.parse(TZ_SUFFIX_RE.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(parsed)) throw invalid(field, value);
  return parsed;
}

/**
 * Read the optional custom window (`start_time` / `end_time`) from tool input.
 * Both bounds must be supplied together; start must not be after end.
 */
export function parseCustomWindow(input: Record<string, unknown>): { startMs?: number; endMs?: number } {
  const startMs = parseTimeInput(input.start_time, "start_time");
  const endMs = parseTimeInput(input.end_time, "end_time", { endOfDay: true });
  if ((startMs === undefined) !== (endMs === undefined)) {
    throw new Error(
      "start_time and end_time must be provided together (or use time_filter instead). " +
        'Example: start_time "2026-09-28", end_time "2026-09-29".',
    );
  }
  if (startMs !== undefined && endMs !== undefined && startMs > endMs) {
    throw new Error(`start_time must not be after end_time (got ${new Date(startMs).toISOString()} > ${new Date(endMs).toISOString()}).`);
  }
  return { startMs, endMs };
}

/** UTC calendar date ("YYYY-MM-DD") for an epoch-ms timestamp. */
export function toUtcDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
