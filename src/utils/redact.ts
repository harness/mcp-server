const SENSITIVE_KEY_PATTERN = /^(token|secret|password|authorization|bearer|credential|webhook|private_?key|client_?secret|api[_-]?key|secret[_-]?key|access[_-]?key|ssh[_-]?key|passphrase|encrypted)$/i;

const REDACTED = "[REDACTED]";

/**
 * Recursively redact values whose keys match sensitive patterns.
 * Returns a new object — the original is never mutated.
 */
export function redactSensitiveFields(obj: unknown, depth = 0): unknown {
  if (depth > 10) return obj;

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
 * Redact sensitive fields in a JSON string. Returns the redacted string.
 * If parsing fails, returns the original string truncated.
 */
export function redactJsonString(jsonStr: string, maxLen = 1000): string {
  try {
    const parsed = JSON.parse(jsonStr);
    const redacted = redactSensitiveFields(parsed);
    const out = JSON.stringify(redacted);
    return out.length > maxLen ? out.slice(0, maxLen) + "..." : out;
  } catch {
    return jsonStr.slice(0, maxLen);
  }
}
