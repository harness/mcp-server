const SENSITIVE_KEYS =
  "token|secret|password|authorization|bearer|credentials?|webhook|private_?key|client_?secret|api[_-]?key|secret[_-]?key|access[_-]?key|ssh[_-]?key|passphrase|encrypted|access_?token|refresh_?token|id_?token|session_?token|cookie";

const SENSITIVE_KEY_PATTERN = new RegExp(`^(${SENSITIVE_KEYS})$`, "i");

const REDACTED = "[REDACTED]";

/**
 * Recursively redact values whose keys match sensitive patterns.
 * Returns a new object — the original is never mutated.
 */
export function redactSensitiveFields(obj: unknown, depth = 0): unknown {
  if (depth > 10) return REDACTED;

  if (typeof obj === "string") return obj;
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveFields(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = REDACTED;
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitiveFields(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Inline pattern for key-value pairs in non-JSON text that might contain secrets.
 * Matches patterns like: "token": "...", token=..., authorization: Bearer abc.def, etc.
 * Value capture handles quoted strings (double or single) and unquoted values up to the next delimiter.
 */
const INLINE_SECRET_PATTERN = new RegExp(
  `(["']?(?:${SENSITIVE_KEYS})["']?)\\s*[:=]\\s*("[^"]*"|'[^']*'|[^,\\n}{\\]]+)`,
  "gi",
);

/**
 * Redact sensitive fields in a JSON string. Returns the redacted string.
 * If parsing fails, applies inline secret scrubbing to prevent leaks.
 */
export function redactJsonString(jsonStr: string, maxLen = 1000): string {
  try {
    const parsed = JSON.parse(jsonStr);
    const redacted = redactSensitiveFields(parsed);
    const out = JSON.stringify(redacted);
    return out.length > maxLen ? out.slice(0, maxLen) + "..." : out;
  } catch {
    const scrubbed = jsonStr.replace(INLINE_SECRET_PATTERN, `$1: ${REDACTED}`);
    return scrubbed.length > maxLen ? scrubbed.slice(0, maxLen) + "..." : scrubbed;
  }
}
