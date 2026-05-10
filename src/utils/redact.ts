const SENSITIVE_KEYS =
  "webhook[_-]?url|callback[_-]?url|endpoint[_-]?url|private[_-]?key|privateKey|client[_-]?secret|clientSecret|api[_-]?key|apiKey|secret[_-]?key|secretKey|access[_-]?key|accessKey|ssh[_-]?key|sshKey|access[_-]?token|accessToken|refresh[_-]?token|refreshToken|id[_-]?token|idToken|session[_-]?token|sessionToken|authorization|bearer|credentials?|passphrase|encrypted|password|webhook|secret|cookie|token";

const SENSITIVE_KEY_PATTERN = new RegExp(`^(${SENSITIVE_KEYS})$`, "i");

const REDACTED = "[REDACTED]";

/**
 * Recursively redact values whose keys match sensitive patterns.
 * Returns a new object — the original is never mutated.
 */
export function redactSensitiveFields(obj: unknown, depth = 0): unknown {
  if (depth > 10) return REDACTED;

  if (typeof obj === "string") return scrubSensitiveText(obj);
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveFields(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = redactSensitiveFields(value, depth + 1);
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
  `(["']?(?:${SENSITIVE_KEYS})(?![A-Za-z0-9_-])["']?)[ \\t]*[:=][ \\t]*(?![|>](?:\\s|$))("[^"]*"|'[^']*'|[^,\\n}{\\]]+)`,
  "gi",
);

const YAML_BLOCK_SECRET_PATTERN = new RegExp(
  `(^[ \\t]*["']?(?:${SENSITIVE_KEYS})["']?[ \\t]*:[ \\t]*[|>][^\\n]*\\n)(?:[ \\t]+.*(?:\\n|$))+`,
  "gim",
);

function scrubSensitiveText(text: string): string {
  return text
    .replace(YAML_BLOCK_SECRET_PATTERN, `$1  ${REDACTED}\n`)
    .replace(INLINE_SECRET_PATTERN, `$1: ${REDACTED}`);
}

/**
 * Redact sensitive fields in a JSON string. Returns the redacted string.
 * If parsing fails, scrubs inline sensitive key/value pairs then truncates.
 */
export function redactJsonString(jsonStr: string, maxLen = 1000): string {
  try {
    const parsed = JSON.parse(jsonStr);
    const redacted = redactSensitiveFields(parsed);
    const out = JSON.stringify(redacted);
    return out.length > maxLen ? out.slice(0, maxLen) + "..." : out;
  } catch {
    const scrubbed = scrubSensitiveText(jsonStr);
    return scrubbed.length > maxLen ? scrubbed.slice(0, maxLen) + "..." : scrubbed;
  }
}
