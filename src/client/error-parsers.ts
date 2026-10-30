import { isRecord } from "../utils/type-guards.js";

/** Request context an error parser uses to decide whether it applies. */
export interface ErrorParserContext {
  path: string;
  status: number;
}

/** What a parser contributes to the final error message. */
export interface ParsedApiError {
  /** Replaces the message only when the body has no usable `message` of its own. */
  message?: string;
  /** Appended after the message as " — <detail>", before the generic detail fields. */
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

/** Caps so a large response cannot flood the MCP error. */
export const MAX_FME_ERRORS_CHARS = 2000;
export const MAX_FME_MESSAGE_CHARS = 400;

/** Truncate to `max` chars with an ellipsis, without splitting a surrogate pair. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = max;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return `${text.slice(0, end)}…`;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text || undefined;
}

/**
 * FME API 422 responses are RFC 7807 `application/problem+json`:
 * `{ title, detail, errors: [{ title, detail }] }` with no `message` field.
 * For governance failures, `errors[]` holds the policy name and deny message.
 * `body.message` is intentionally not read: the client already vets it (HTML/JS junk
 * check) and only uses this parser's message when it has no usable one.
 */
export const fmeUnprocessableEntityParser: ErrorParser = {
  name: "fme-422",
  match: ({ path, status }) => path.startsWith("/fme/") && status === 422,
  parse(body) {
    const rawMessage = nonEmptyString(body.detail) ?? nonEmptyString(body.title);
    const message = rawMessage && truncate(rawMessage, MAX_FME_MESSAGE_CHARS);

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

    const detail = truncate(lines.join("; "), MAX_FME_ERRORS_CHARS);

    if (!message && !detail) return undefined;
    return { message: message || undefined, detail: detail || undefined };
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
