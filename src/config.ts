import * as z from "zod/v4";
import { normalizeHttpAllowedHost } from "./utils/http-hosts.js";

/**
 * Coerce a string env var to a boolean.
 * "true" / "1" / "yes" → true; everything else (including "false") → false.
 * This avoids the JS `Boolean("false") === true` footgun with z.coerce.boolean().
 */
const booleanFromEnv = z
  .union([z.boolean(), z.string(), z.undefined()])
  .transform((val) => typeof val === "string" && ["true", "1", "yes"].includes(val.toLowerCase()));

const emptyStringAsUndefined = (val: unknown): unknown => val === "" ? undefined : val;
const optionalStringFromEnv = z.preprocess(emptyStringAsUndefined, z.string().optional());
const urlFromEnv = (defaultValue: string) =>
  z.preprocess(emptyStringAsUndefined, z.string().url().default(defaultValue));

function validateAllowedHosts(rawHosts: string | undefined): string | undefined {
  if (rawHosts === undefined) return undefined;

  const hosts: string[] = [];
  const invalidHosts: string[] = [];
  for (const value of rawHosts.split(",")) {
    const hostname = normalizeHttpAllowedHost(value);
    if (!hostname) {
      invalidHosts.push(value.trim());
    } else if (!hosts.includes(hostname)) {
      hosts.push(hostname);
    }
  }

  if (invalidHosts.length > 0) {
    const quotedHosts = invalidHosts.map((host) => `"${host}"`).join(", ");
    throw new Error(`Invalid HARNESS_MCP_ALLOWED_HOSTS entries: ${quotedHosts}`);
  }

  return hosts.join(",");
}

const ACCOUNT_SCOPED_API_KEY_PREFIXES = new Set(["pat", "sat"]);

/**
 * Extract the account ID from a Harness account-scoped API key.
 * Supported formats:
 * - pat.<accountId>.<tokenId>.<secret>
 * - sat.<accountId>.<tokenId>.<secret>
 * Returns undefined if the token doesn't match a supported format.
 */
export function extractAccountIdFromToken(apiKey: string): string | undefined {
  const parts = apiKey.split(".");
  const prefix = parts[0]?.toLowerCase();
  const accountId = parts[1];
  if (
    parts.length >= 3 &&
    prefix &&
    ACCOUNT_SCOPED_API_KEY_PREFIXES.has(prefix) &&
    accountId &&
    accountId.length > 0
  ) {
    return accountId;
  }
  return undefined;
}

const RawConfigSchema = z.object({
  HARNESS_MCP_MODE: z.preprocess(
    emptyStringAsUndefined,
    z.enum(["single-user", "multi-user"]).default("single-user"),
  ),
  HARNESS_API_KEY: optionalStringFromEnv,
  HARNESS_ACCOUNT_ID: optionalStringFromEnv,
  HARNESS_BASE_URL: urlFromEnv("https://app.harness.io"),
  // New names (preferred)
  HARNESS_ORG: optionalStringFromEnv,
  HARNESS_PROJECT: optionalStringFromEnv,
  // Deprecated names (backward compat)
  HARNESS_DEFAULT_ORG_ID: optionalStringFromEnv,
  HARNESS_DEFAULT_PROJECT_ID: optionalStringFromEnv,
  HARNESS_API_TIMEOUT_MS: z.coerce.number().default(30000),
  HARNESS_MAX_RETRIES: z.coerce.number().default(3),
  MCP_SESSION_TTL_MS: z.coerce.number().min(1).default(5 * 60_000),
  LOG_LEVEL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.enum(["debug", "info", "warn", "error"]).default("info"),
  ),
  HARNESS_TOOLSETS: optionalStringFromEnv,
  HARNESS_MAX_BODY_SIZE_MB: z.coerce.number().default(10),
  HARNESS_RATE_LIMIT_RPS: z.coerce.number().default(10),
  HARNESS_READ_ONLY: booleanFromEnv.default(false),
  HARNESS_SKIP_ELICITATION: booleanFromEnv.default(false),
  HARNESS_AUTO_APPROVE_RISK: z.preprocess(
    emptyStringAsUndefined,
    z.enum(["none", "low_write", "medium_write", "high_write", "all"]).optional(),
  ),
  HARNESS_ALLOW_HTTP: booleanFromEnv.default(false),
  HARNESS_MCP_ALLOWED_HOSTS: optionalStringFromEnv.transform(validateAllowedHosts),
  HARNESS_MCP_AUTH_TOKEN: optionalStringFromEnv,
  HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: booleanFromEnv.default(false),
  HARNESS_FME_API_KEY: optionalStringFromEnv,
  HARNESS_FME_BASE_URL: urlFromEnv("https://api.split.io"),
  HARNESS_LOG_UNSAFE_BODIES: booleanFromEnv.default(false),
  HARNESS_PIPELINE_VERSION: z.enum(["0", "1"]).optional(),
  HARNESS_AUDIT_FILE: optionalStringFromEnv,
  HARNESS_AUDIT_WEBHOOK_URL: z.preprocess(emptyStringAsUndefined, z.string().url().optional()),
  HARNESS_AUDIT_WEBHOOK_TOKEN: optionalStringFromEnv,
  HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: z.preprocess(emptyStringAsUndefined, z.coerce.number().min(1).default(10)),
  HARNESS_AUDIT_WEBHOOK_FLUSH_MS: z.preprocess(emptyStringAsUndefined, z.coerce.number().min(1).default(5000)),
  // Maximum number of concurrent log-blob downloads issued by harness_diagnose
  // when fetching logs for failed steps. Default 3 keeps peak memory bounded
  // while still parallelising the common case (1–3 failed steps). Increase
  // only if diagnose latency is dominated by log-fetch wall-clock and the
  // pod has memory headroom (AIDEVOPS-2200).
  HARNESS_DIAGNOSE_LOG_FETCH_CONCURRENCY: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().min(1).max(20).default(3),
  ),
  HARNESS_SEARCH_PROVIDER: z.preprocess(
    emptyStringAsUndefined,
    z.enum(["none", "local"]).default("local"),
  ),
  HARNESS_SEARCH_SERVICE_URL: optionalStringFromEnv,
  // Directory for @huggingface/transformers model cache (local search provider).
  // Use a persistent volume in production; Docker image bakes models into /app/.cache/hf.
  HARNESS_HF_CACHE_DIR: z.preprocess(
    emptyStringAsUndefined,
    z.string().default("/tmp/hf-cache"),
  ),
});

export const ConfigSchema = RawConfigSchema.transform((data) => {
  const isMultiUser = data.HARNESS_MCP_MODE === "multi-user";

  if (isMultiUser && data.HARNESS_API_KEY) {
    throw new Error(
      "HARNESS_API_KEY must not be set in multi-user mode. " +
      "Each session must provide its own API key via the x-harness-api-key header.",
    );
  }

  if (isMultiUser && data.HARNESS_FME_API_KEY) {
    throw new Error(
      "HARNESS_FME_API_KEY must not be set in multi-user mode. " +
      "FME calls must use the session user's x-harness-api-key credential.",
    );
  }

  if (!isMultiUser && !data.HARNESS_API_KEY) {
    throw new Error(
      "HARNESS_API_KEY is required in single-user mode.",
    );
  }

  let accountId: string | undefined;
  if (isMultiUser) {
    accountId = data.HARNESS_ACCOUNT_ID ?? "";
  } else {
    accountId = data.HARNESS_ACCOUNT_ID ?? extractAccountIdFromToken(data.HARNESS_API_KEY!);
    if (!accountId) {
      throw new Error(
        "HARNESS_ACCOUNT_ID is required when the API key does not include an account ID segment (pat.<accountId>... or sat.<accountId>...)",
      );
    }
  }

  if (!data.HARNESS_BASE_URL.startsWith("https://") && !data.HARNESS_ALLOW_HTTP) {
    throw new Error(
      `HARNESS_BASE_URL must use HTTPS (got "${data.HARNESS_BASE_URL}"). ` +
      "If you need HTTP for local development, set HARNESS_ALLOW_HTTP=true.",
    );
  }

  if (data.HARNESS_FME_BASE_URL && !data.HARNESS_FME_BASE_URL.startsWith("https://") && !data.HARNESS_ALLOW_HTTP) {
    throw new Error(
      `HARNESS_FME_BASE_URL must use HTTPS (got "${data.HARNESS_FME_BASE_URL}"). ` +
      "If you need HTTP for local development, set HARNESS_ALLOW_HTTP=true.",
    );
  }

  if (data.HARNESS_AUDIT_WEBHOOK_URL && !data.HARNESS_AUDIT_WEBHOOK_URL.startsWith("https://") && !data.HARNESS_ALLOW_HTTP) {
    throw new Error(
      `HARNESS_AUDIT_WEBHOOK_URL must use HTTPS (got "${data.HARNESS_AUDIT_WEBHOOK_URL}"). ` +
      "If you need HTTP for local development, set HARNESS_ALLOW_HTTP=true.",
    );
  }

  // Resolve org/project: prefer new names, fall back to deprecated names
  if (!data.HARNESS_ORG && data.HARNESS_DEFAULT_ORG_ID) {
    console.error('[DEPRECATION] HARNESS_DEFAULT_ORG_ID is deprecated. Use HARNESS_ORG instead.');
  }
  if (!data.HARNESS_PROJECT && data.HARNESS_DEFAULT_PROJECT_ID) {
    console.error('[DEPRECATION] HARNESS_DEFAULT_PROJECT_ID is deprecated. Use HARNESS_PROJECT instead.');
  }
  const HARNESS_ORG = data.HARNESS_ORG ?? data.HARNESS_DEFAULT_ORG_ID;
  const HARNESS_PROJECT = data.HARNESS_PROJECT ?? data.HARNESS_DEFAULT_PROJECT_ID;

  // Resolve auto-approve risk: prefer new name, fall back to deprecated SKIP_ELICITATION
  let HARNESS_AUTO_APPROVE_RISK = data.HARNESS_AUTO_APPROVE_RISK ?? "none";
  if (!data.HARNESS_AUTO_APPROVE_RISK && data.HARNESS_SKIP_ELICITATION) {
    console.error(
      '[DEPRECATION] HARNESS_SKIP_ELICITATION is deprecated. Use HARNESS_AUTO_APPROVE_RISK instead.\n' +
      '  HARNESS_SKIP_ELICITATION=true is equivalent to HARNESS_AUTO_APPROVE_RISK=all.',
    );
    HARNESS_AUTO_APPROVE_RISK = "all";
  }

  // Remove deprecated keys from output, expose only the canonical names
  const { HARNESS_DEFAULT_ORG_ID: _oldOrg, HARNESS_DEFAULT_PROJECT_ID: _oldProject, ...rest } = data;

  return { ...rest, HARNESS_API_KEY: data.HARNESS_API_KEY ?? "", HARNESS_ACCOUNT_ID: accountId, HARNESS_ORG, HARNESS_PROJECT, HARNESS_AUTO_APPROVE_RISK };
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Some integrations use literal placeholder credentials (for example "dummy").
 * Those placeholders are not valid external Split/FME API credentials.
 */
export function isPlaceholderCredential(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return true;
  return normalized === "dummy" || normalized.endsWith(".dummy");
}

/**
 * Resolve the token used for Split/FME product APIs.
 * FME talks directly to api.split.io, so a Harness platform auth placeholder
 * cannot be reused there.
 */
export function resolveFmeApiKey(
  config: Pick<Config, "HARNESS_MCP_MODE" | "HARNESS_FME_API_KEY" | "HARNESS_API_KEY">,
): string | undefined {
  const explicitFmeKey = config.HARNESS_MCP_MODE === "multi-user"
    ? undefined
    : config.HARNESS_FME_API_KEY?.trim();
  if (explicitFmeKey && !isPlaceholderCredential(explicitFmeKey)) {
    return explicitFmeKey;
  }

  const fallbackHarnessKey = config.HARNESS_API_KEY?.trim();
  if (fallbackHarnessKey && !isPlaceholderCredential(fallbackHarnessKey)) {
    return fallbackHarnessKey;
  }

  return undefined;
}

/**
 * Resolve the base URL for a given product backend.
 * - "harness" → undefined (uses the default client base URL)
 * - "fme"     → HARNESS_FME_BASE_URL from config (defaults to https://api.split.io)
 */
export function resolveProductBaseUrl(config: Config, product: "harness" | "fme"): string | undefined {
  if (product === "fme") return config.HARNESS_FME_BASE_URL;
  return undefined;
}

export function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  return result.data;
}
