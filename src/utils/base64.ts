import { Buffer } from "node:buffer";

/**
 * Shared base64 helpers for toolsets that bridge base64 wire fields to/from
 * plain text or raw bytes (Harness Code file content, File Store uploads,
 * Chaos load-test scripts). Centralized so encode/decode/validation logic
 * isn't reimplemented per toolset.
 */

export function normalizeBase64(value: string): string {
  return value.replace(/\s+/g, "");
}

function isBase64Char(charCode: number): boolean {
  return (
    (charCode >= 65 && charCode <= 90) ||
    (charCode >= 97 && charCode <= 122) ||
    (charCode >= 48 && charCode <= 57) ||
    charCode === 43 ||
    charCode === 47
  );
}

/** Validates a base64 string (already whitespace-normalized): charset, length%4, and padding placement. */
export function isValidBase64(normalizedBase64: string): boolean {
  if (normalizedBase64.length === 0 || normalizedBase64.length % 4 !== 0) return false;

  let paddingStart = normalizedBase64.length;
  for (let i = 0; i < normalizedBase64.length; i += 1) {
    const charCode = normalizedBase64.charCodeAt(i);
    if (charCode === 61 /* '=' */) {
      paddingStart = i;
      break;
    }
    if (!isBase64Char(charCode)) return false;
  }

  const paddingLength = normalizedBase64.length - paddingStart;
  if (paddingLength > 2) return false;
  for (let i = paddingStart; i < normalizedBase64.length; i += 1) {
    if (normalizedBase64.charCodeAt(i) !== 61) return false;
  }
  return true;
}

export function assertValidBase64(value: string, fieldLabel: string): string {
  const normalized = normalizeBase64(value);
  if (normalized.length === 0) {
    throw new Error(`${fieldLabel} must not be empty.`);
  }
  if (!isValidBase64(normalized)) {
    throw new Error(`${fieldLabel} must be valid base64.`);
  }
  return normalized;
}

export function estimateBase64DecodedBytes(normalizedBase64: string): number {
  const paddingBytes = normalizedBase64.endsWith("==") ? 2 : normalizedBase64.endsWith("=") ? 1 : 0;
  return (normalizedBase64.length / 4) * 3 - paddingBytes;
}

export function encodeBase64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

/**
 * Decode base64 to UTF-8 text. Returns undefined when the input isn't valid
 * base64, or when the decoded bytes aren't valid UTF-8 (e.g. binary files —
 * images, archives). Uses a `fatal` TextDecoder rather than
 * `Buffer#toString("utf8")`, which never throws and would otherwise silently
 * replace invalid byte sequences with U+FFFD instead of signaling non-text data.
 */
export function decodeBase64ToUtf8(value: string): string | undefined {
  const normalized = normalizeBase64(value);
  if (!isValidBase64(normalized)) return undefined;
  try {
    const bytes = Buffer.from(normalized, "base64");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}
