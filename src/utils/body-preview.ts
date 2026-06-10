import { Buffer } from "node:buffer";

const MAX_STRING_PREVIEW_CHARS = 500;
const MAX_BODY_PREVIEW_CHARS = 2_000;

const REDACTED_BODY_FIELDS = new Set([
  "content",
  "content_base64",
  "contentBase64",
]);

function byteCount(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function truncateString(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...(truncated ${value.length - maxChars} chars)`;
}

function redactValue(value: unknown): string {
  if (typeof value === "string") {
    return `[redacted ${byteCount(value)} bytes]`;
  }
  if (value === null) {
    return "[redacted null]";
  }
  return `[redacted ${typeof value}]`;
}

function previewReplacer(key: string, value: unknown): unknown {
  if (REDACTED_BODY_FIELDS.has(key)) {
    return redactValue(value);
  }
  if (typeof value === "string") {
    return truncateString(value, MAX_STRING_PREVIEW_CHARS);
  }
  return value;
}

export function formatBodyPreview(body: unknown): string {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (parsed !== body) {
        return formatBodyPreview(parsed);
      }
    } catch {
      // Non-JSON strings are valid bodies for YAML/text resources; preview them as-is.
    }
    return truncateString(body, MAX_STRING_PREVIEW_CHARS);
  }

  try {
    const preview = JSON.stringify(body, previewReplacer, 2);
    return truncateString(preview ?? String(body), MAX_BODY_PREVIEW_CHARS);
  } catch (err) {
    return `[body preview unavailable: ${err instanceof Error ? err.message : String(err)}]`;
  }
}
