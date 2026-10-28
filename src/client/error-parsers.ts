import { isRecord } from "../utils/type-guards.js";

/** Request context an error parser uses to decide whether it applies. */
export interface ErrorParserContext {
  path: string;
  status: number;
}

/** What a parser contributes to the final error message. */
export interface ParsedApiError {
  /** Replaces the generic message when set. */
  message?: string;
  /** Appended after the message as " — <detail>". */
  detail?: string;
}

/**
 * API-specific error parser. The first registered parser whose `match` returns true
 * and whose `parse` returns a result wins. If none does, the generic parsing in
 * harness-client.ts runs unchanged.
 */
export interface ErrorParser {
  name: string;
  match(ctx: ErrorParserContext): boolean;
  parse(body: Record<string, unknown>, ctx: ErrorParserContext): ParsedApiError | undefined;
}

/** Cap for the per-policy text so a large response cannot flood the MCP error. */
export const MAX_FME_ERRORS_CHARS = 2000;

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text || undefined;
}

/**
 * FME API 422 responses are RFC 7807 `application/problem+json`:
 * `{ title, detail, errors: [{ title, detail }] }` with no `message` field.
 * For governance failures, `errors[]` holds the policy name and deny message.
 */
export const fmeUnprocessableEntityParser: ErrorParser = {
  name: "fme-422",
  match: ({ path, status }) => path.startsWith("/fme/") && status === 422,
  parse(body) {
    const message = nonEmptyString(body.message) ?? nonEmptyString(body.detail) ?? nonEmptyString(body.title);

    const lines: string[] = [];
    for (const entry of Array.isArray(body.errors) ? body.errors : []) {
      if (typeof entry === "string") {
        const text = nonEmptyString(entry);
        if (text) lines.push(text);
      } else if (isRecord(entry)) {
        const title = nonEmptyString(entry.title);
        const text = nonEmptyString(entry.detail) ?? nonEmptyString(entry.message);
        const line = title && text && title !== text ? `${title}: ${text}` : title ?? text;
        if (line) lines.push(line);
      }
    }

    let detail = lines.join("; ");
    if (detail.length > MAX_FME_ERRORS_CHARS) detail = `${detail.slice(0, MAX_FME_ERRORS_CHARS)}…`;

    if (!message && !detail) return undefined;
    return { message, detail: detail || undefined };
  },
};

/** Registered parsers, checked in order. Add new API-specific parsers here. */
export const ERROR_PARSERS: readonly ErrorParser[] = [fmeUnprocessableEntityParser];

/** Run the first matching parser that produces a result; undefined means "use generic parsing". */
export function runErrorParsers(
  body: Record<string, unknown>,
  ctx: ErrorParserContext,
  parsers: readonly ErrorParser[] = ERROR_PARSERS,
): ParsedApiError | undefined {
  for (const parser of parsers) {
    if (!parser.match(ctx)) continue;
    const result = parser.parse(body, ctx);
    if (result) return result;
  }
  return undefined;
}
