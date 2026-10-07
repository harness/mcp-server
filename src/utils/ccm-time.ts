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
/**
 * Strict ISO 8601 datetime. Captures calendar parts so we can reject impossible
 * dates ourselves — Date.parse overflows 2026-02-31 and 24:00 into a different day.
 */
const ISO_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/i;

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

  return parseIsoDateTime(str, field, value);
}

/**
 * Parse an ISO datetime from its components. Zone-less values are UTC.
 * Out-of-range parts and impossible calendar dates throw instead of overflowing
 * into a neighboring day (Date.parse("2026-02-31T00:00:00Z") is March 3).
 */
function parseIsoDateTime(str: string, field: string, value: unknown): number {
  const m = ISO_DATETIME_RE.exec(str);
  if (!m) throw invalid(field, value);

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] !== undefined ? Number(m[6]) : 0;
  // ".1" is 100ms and ".12" is 120ms — pad to milliseconds, don't treat as an integer.
  const millis = m[7] !== undefined ? Number(m[7].padEnd(3, "0")) : 0;
  const tz = m[8];

  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    throw invalid(field, value);
  }

  const midnight = Date.UTC(year, month - 1, day);
  const check = new Date(midnight);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw invalid(field, value);
  }

  let offsetMinutes = 0;
  if (tz && tz.toUpperCase() !== "Z") {
    const tzMatch = /^([+-])(\d{2}):?(\d{2})$/.exec(tz);
    if (!tzMatch) throw invalid(field, value);
    const sign = tzMatch[1] === "+" ? 1 : -1;
    const offH = Number(tzMatch[2]);
    const offMin = Number(tzMatch[3]);
    if (offH > 23 || offMin > 59) throw invalid(field, value);
    offsetMinutes = sign * (offH * 60 + offMin);
  }

  return Date.UTC(year, month - 1, day, hour, minute, second, millis) - offsetMinutes * 60_000;
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
  assertWindowOrder(startMs, endMs);
  return { startMs, endMs };
}

/** Reject an inverted window when both bounds are present. A missing bound is allowed. */
export function assertWindowOrder(startMs: number | undefined, endMs: number | undefined): void {
  if (startMs !== undefined && endMs !== undefined && startMs > endMs) {
    throw new Error(
      `start_time must not be after end_time (got ${new Date(startMs).toISOString()} > ${new Date(endMs).toISOString()}).`,
    );
  }
}

/** UTC calendar date ("YYYY-MM-DD") for an epoch-ms timestamp. */
export function toUtcDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
