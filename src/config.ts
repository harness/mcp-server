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
const optionalUrlFromEnv = z.preprocess(emptyStringAsUndefined, z.string().url().optional());
const urlFromEnv = (defaultValue: string) =>
  z.preprocess(emptyStringAsUndefined, z.string().url().default(defaultValue));
const DEFAULT_HARNESS_BASE_URL = "https://app.harness.io";
const DEFAULT_OAUTH_BASE_URL = "https://mcp.harness.io/cli";
const DEFAULT_OAUTH_ISSUER = "https://id.harness.io/idp/realms/HarnessIDP";
const DEFAULT_OAUTH_RESOURCE = "https://mcp.harness.io/mcp";

function assertRedisUrl(value: string | undefined): void {
  if (!value) {
    throw new Error(
      "oauth-proxy redis vault mode requires HARNESS_MCP_OAUTH_PROXY_REDIS_URL.",
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "HARNESS_MCP_OAUTH_PROXY_REDIS_URL must be a redis:// or rediss:// URL.",
    );
  }
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error(
      "HARNESS_MCP_OAUTH_PROXY_REDIS_URL must be a redis:// or rediss:// URL.",
    );
  }
}

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
    z.enum(["single-user", "multi-user", "oauth", "oauth-proxy"]).default("single-user"),
  ),
  HARNESS_API_KEY: optionalStringFromEnv,
  HARNESS_ACCOUNT_ID: optionalStringFromEnv,
  HARNESS_BASE_URL: optionalUrlFromEnv,
  HARNESS_MCP_OAUTH_ISSUER: urlFromEnv(DEFAULT_OAUTH_ISSUER),
  HARNESS_MCP_OAUTH_RESOURCE: urlFromEnv(DEFAULT_OAUTH_RESOURCE),
  HARNESS_MCP_OAUTH_JWKS_URI: optionalUrlFromEnv,
  HARNESS_MCP_OAUTH_CLIENT_ID: z.preprocess(
    emptyStringAsUndefined,
    z.string().default("mcp-client"),
  ),
  HARNESS_MCP_OAUTH_ACCOUNT_CLAIM: z.preprocess(
    emptyStringAsUndefined,
    z.string().default("account_id"),
  ),
  HARNESS_MCP_OAUTH_SCOPES: z.preprocess(
    emptyStringAsUndefined,
    z.string().default("openid profile email organization"),
  ),
  HARNESS_MCP_OAUTH_CLIENT_SECRET: optionalStringFromEnv,
  HARNESS_MCP_OAUTH_IDP_HINT: z.preprocess(
    emptyStringAsUndefined,
    z.string().default("okta"),
  ),
  HARNESS_MCP_OAUTH_EXTERNAL_SUB_CLAIM: z.preprocess(
    emptyStringAsUndefined,
    z.string().default("external_sub"),
  ),
  HARNESS_MCP_OAUTH_PROXY_GRANT: z.preprocess(
    emptyStringAsUndefined,
    z.enum(["refresh", "jwt-bearer"]).default("refresh"),
  ),
  HARNESS_MCP_OAUTH_PROXY_PUBLIC_URL: optionalUrlFromEnv,
  HARNESS_MCP_OAUTH_PROXY_VAULT_PATH: z.preprocess(
    emptyStringAsUndefined,
    z.string().default(".harness-mcp/oauth-proxy-vault.enc"),
  ),
  HARNESS_MCP_OAUTH_PROXY_VAULT_KEY: optionalStringFromEnv,
  HARNESS_MCP_OAUTH_PROXY_VAULT_MODE: z.preprocess(
    emptyStringAsUndefined,
    z.enum(["file", "redis"]).default("file"),
  ),
  HARNESS_MCP_OAUTH_PROXY_REDIS_URL: optionalStringFromEnv,
  HARNESS_MCP_OAUTH_PROXY_REDIS_KEY_PREFIX: z.preprocess(
    emptyStringAsUndefined,
    z.string().regex(/^[A-Za-z0-9:_-]+$/).default("harness-mcp:oauth"),
  ),
  HARNESS_MCP_OAUTH_PROXY_LINK_TTL_MS: z.coerce.number().int().min(30_000).default(5 * 60_000),
  HARNESS_MCP_UPSTREAM_ISSUER: optionalUrlFromEnv,
  HARNESS_MCP_UPSTREAM_AUDIENCE: optionalStringFromEnv,
  HARNESS_MCP_UPSTREAM_JWKS_URI: optionalUrlFromEnv,
  HARNESS_MCP_UPSTREAM_SCOPES: z.preprocess(
    emptyStringAsUndefined,
    z.string().default("openid profile email offline_access"),
  ),
  HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_ID: optionalStringFromEnv,
  HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_SECRET: optionalStringFromEnv,
  HARNESS_MCP_UPSTREAM_DISCOVERY_URI: optionalUrlFromEnv,
  HARNESS_MCP_BROKER_ISSUER: optionalUrlFromEnv,
  HARNESS_MCP_BROKER_CLIENT_ID: z.preprocess(
    emptyStringAsUndefined,
    z.string().default("cursor-harness-mcp"),
  ),
  HARNESS_MCP_BROKER_REDIRECT_URIS: z.preprocess(
    emptyStringAsUndefined,
    z.string().default("http://localhost:8787/callback"),
  ),
  HARNESS_MCP_BROKER_CODE_TTL_MS: z.coerce.number().int().min(30_000).max(10 * 60_000).default(60_000),
  HARNESS_MCP_BROKER_TRANSACTION_TTL_MS: z.coerce.number().int().min(60_000).max(30 * 60_000).default(10 * 60_000),
  // New names (preferred)
  HARNESS_ORG: optionalStringFromEnv,
  HARNESS_PROJECT: optionalStringFromEnv,
  // Deprecated names (backward compat)
  HARNESS_DEFAULT_ORG_ID: optionalStringFromEnv,
  HARNESS_DEFAULT_PROJECT_ID: optionalStringFromEnv,
  HARNESS_API_TIMEOUT_MS: z.coerce.number().default(30000),
  HARNESS_MAX_RETRIES: z.coerce.number().default(3),
  // Idle HTTP sessions are reaped after this many ms once no request or SSE
  // stream is active. Kept generous (30 min) so interactive clients (e.g. the
  // claude.ai connector, which does not hold a persistent SSE stream between
  // prompts) are not evicted mid-conversation, which surfaces to users as
  // repeated "Session not found" → re-authenticate prompts.
  MCP_SESSION_TTL_MS: z.coerce.number().min(1).default(30 * 60_000),
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
  // Number of proxy hops to trust for client IP resolution (Express `trust
  // proxy`). Set to the count of reverse proxies / load balancers in front of
  // the server so per-IP rate limiting keys on the real client rather than the
  // proxy socket peer (which would bucket every user together). Default 0
  // (trust nothing) preserves prior behaviour for direct binds.
  HARNESS_MCP_TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  HARNESS_FME_API_KEY: optionalStringFromEnv,
  HARNESS_FME_BASE_URL: urlFromEnv("https://api.split.io"),
  // TypeSafe API (https://typesafe.ai) — powers advisory diagnose triage
  // (spec 010). Operator-configured credential, never session-supplied: it
  // egresses failure messages/log snippets on behalf of every session, so it
  // is rejected in multi-user/oauth modes like the FME key (see transform).
  TYPESAFE_API_KEY: optionalStringFromEnv,
  TYPESAFE_BASE_URL: urlFromEnv("https://api.typesafe.ai"),
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
    z.enum(["none", "local", "remote"]).default("local"),
  ),
  HARNESS_SEARCH_SERVICE_URL: z.preprocess(
    emptyStringAsUndefined,
    z.string().url().optional(),
  ),
  // Extra headers sent with every request to the remote search service.
  // JSON object, e.g.: {"Authorization":"Bearer tok"} or {"x-api-key":"key","x-harness-token":"svc"}
  // Supports any auth scheme: Bearer tokens, API keys, internal service-to-service headers.
  HARNESS_SEARCH_SERVICE_HEADERS: optionalStringFromEnv,
  // Directory for @huggingface/transformers model cache (local search provider).
  // Use a persistent volume in production; Docker image bakes models into /app/.cache/hf.
  HARNESS_HF_CACHE_DIR: z.preprocess(
    emptyStringAsUndefined,
    z.string().default("/tmp/hf-cache"),
  ),
  // Spec 010: advisory-only failure-category triage in harness_diagnose —
  // a read-tool enrichment, not a write gate. Skips silently without
  // TYPESAFE_API_KEY.
  HARNESS_DIAGNOSE_TRIAGE: booleanFromEnv.default(true),
  HARNESS_DIAGNOSE_TRIAGE_MIN_CONFIDENCE: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().min(0).max(1).default(0.6),
  ),
  HARNESS_DIAGNOSE_TRIAGE_TIMEOUT_MS: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().int().positive().default(400),
  ),
});

export const ConfigSchema = RawConfigSchema.transform((data) => {
  const isMultiUser = data.HARNESS_MCP_MODE === "multi-user";
  const isOAuth = data.HARNESS_MCP_MODE === "oauth";
  const isOAuthProxy = data.HARNESS_MCP_MODE === "oauth-proxy";
  const isOAuthMode = isOAuth || isOAuthProxy;
  // `/cli` is the OAuth-mode API proxy only. Single-user and multi-user keep
  // app.harness.io so PAT/SAT deployments are unchanged. An explicit
  // HARNESS_BASE_URL always wins.
  const harnessBaseUrl = data.HARNESS_BASE_URL
    ?? (isOAuthMode ? DEFAULT_OAUTH_BASE_URL : DEFAULT_HARNESS_BASE_URL);

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

  if (isMultiUser && data.TYPESAFE_API_KEY) {
    throw new Error(
      "TYPESAFE_API_KEY must not be set in multi-user mode. " +
      "Failure triage egresses log snippets to the TypeSafe API and cannot be shared across session users.",
    );
  }

  if (isOAuthMode && data.HARNESS_API_KEY) {
    throw new Error(
      `HARNESS_API_KEY must not be set in ${data.HARNESS_MCP_MODE} mode. ` +
      "Each session must authenticate with a HarnessID access token.",
    );
  }

  if (isOAuthMode && data.HARNESS_FME_API_KEY) {
    throw new Error(
      `HARNESS_FME_API_KEY must not be set in ${data.HARNESS_MCP_MODE} mode. ` +
      "FME calls must use the session user's HarnessID access token.",
    );
  }

  if (isOAuthMode && data.TYPESAFE_API_KEY) {
    throw new Error(
      `TYPESAFE_API_KEY must not be set in ${data.HARNESS_MCP_MODE} mode. ` +
      "Failure triage egresses log snippets to the TypeSafe API and cannot be shared across session users.",
    );
  }

  if (!isMultiUser && !isOAuthMode && !data.HARNESS_API_KEY) {
    throw new Error("HARNESS_API_KEY is required in single-user mode.");
  }

  if (
    isOAuthMode
    && !data.HARNESS_ALLOW_HTTP
    && (
      !data.HARNESS_MCP_OAUTH_ISSUER!.startsWith("https://")
      || !data.HARNESS_MCP_OAUTH_RESOURCE!.startsWith("https://")
      || (
        data.HARNESS_MCP_OAUTH_JWKS_URI !== undefined
        && !data.HARNESS_MCP_OAUTH_JWKS_URI.startsWith("https://")
      )
    )
  ) {
    throw new Error(
      "HarnessID OAuth issuer, resource, and JWKS URLs must use HTTPS. " +
      "Set HARNESS_ALLOW_HTTP=true only for local development.",
    );
  }

  if (isOAuthMode && data.HARNESS_MCP_AUTH_TOKEN) {
    throw new Error(
      `HARNESS_MCP_AUTH_TOKEN must not be set in ${data.HARNESS_MCP_MODE} mode. ` +
      "OAuth access tokens authenticate HTTP MCP requests.",
    );
  }

  if (isOAuthProxy) {
    const missing = [
      !data.HARNESS_MCP_OAUTH_CLIENT_SECRET && "HARNESS_MCP_OAUTH_CLIENT_SECRET",
      !data.HARNESS_MCP_UPSTREAM_ISSUER && "HARNESS_MCP_UPSTREAM_ISSUER",
      !data.HARNESS_MCP_UPSTREAM_AUDIENCE && "HARNESS_MCP_UPSTREAM_AUDIENCE",
      !data.HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_ID && "HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_ID",
      !data.HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_SECRET && "HARNESS_MCP_UPSTREAM_OAUTH_CLIENT_SECRET",
      !data.HARNESS_MCP_OAUTH_PROXY_VAULT_KEY && "HARNESS_MCP_OAUTH_PROXY_VAULT_KEY",
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`oauth-proxy mode requires ${missing.join(", ")}.`);
    }
    if (
      !data.HARNESS_ALLOW_HTTP
      && (
        !data.HARNESS_MCP_UPSTREAM_ISSUER!.startsWith("https://")
        || (
          data.HARNESS_MCP_UPSTREAM_JWKS_URI !== undefined
          && !data.HARNESS_MCP_UPSTREAM_JWKS_URI.startsWith("https://")
        )
        || (
          data.HARNESS_MCP_OAUTH_PROXY_PUBLIC_URL !== undefined
          && !data.HARNESS_MCP_OAUTH_PROXY_PUBLIC_URL.startsWith("https://")
        )
        || (
          data.HARNESS_MCP_BROKER_ISSUER !== undefined
          && !data.HARNESS_MCP_BROKER_ISSUER.startsWith("https://")
        )
        || (
          data.HARNESS_MCP_UPSTREAM_DISCOVERY_URI !== undefined
          && !data.HARNESS_MCP_UPSTREAM_DISCOVERY_URI.startsWith("https://")
        )
      )
    ) {
      throw new Error(
        "Upstream issuer, JWKS, and OAuth proxy public URLs must use HTTPS. " +
        "Set HARNESS_ALLOW_HTTP=true only for local development.",
      );
    }
    if (Buffer.from(data.HARNESS_MCP_OAUTH_PROXY_VAULT_KEY!, "base64").length !== 32) {
      throw new Error(
        "HARNESS_MCP_OAUTH_PROXY_VAULT_KEY must be a base64-encoded 32-byte key.",
      );
    }
    if (data.HARNESS_MCP_OAUTH_PROXY_VAULT_MODE === "redis") {
      assertRedisUrl(data.HARNESS_MCP_OAUTH_PROXY_REDIS_URL);
    }
  }

  let accountId: string | undefined;
  if (isMultiUser || isOAuthMode) {
    accountId = data.HARNESS_ACCOUNT_ID ?? "";
  } else {
    accountId = data.HARNESS_ACCOUNT_ID ?? extractAccountIdFromToken(data.HARNESS_API_KEY!);
    if (!accountId) {
      throw new Error(
        "HARNESS_ACCOUNT_ID is required when the API key does not include an account ID segment (pat.<accountId>... or sat.<accountId>...)",
      );
    }
  }

  if (!harnessBaseUrl.startsWith("https://") && !data.HARNESS_ALLOW_HTTP) {
    throw new Error(
      `HARNESS_BASE_URL must use HTTPS (got "${harnessBaseUrl}"). ` +
      "If you need HTTP for local development, set HARNESS_ALLOW_HTTP=true.",
    );
  }

  if (data.HARNESS_FME_BASE_URL && !data.HARNESS_FME_BASE_URL.startsWith("https://") && !data.HARNESS_ALLOW_HTTP) {
    throw new Error(
      `HARNESS_FME_BASE_URL must use HTTPS (got "${data.HARNESS_FME_BASE_URL}"). ` +
      "If you need HTTP for local development, set HARNESS_ALLOW_HTTP=true.",
    );
  }

  if (data.TYPESAFE_BASE_URL && !data.TYPESAFE_BASE_URL.startsWith("https://") && !data.HARNESS_ALLOW_HTTP) {
    throw new Error(
      `TYPESAFE_BASE_URL must use HTTPS (got "${data.TYPESAFE_BASE_URL}"). ` +
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
  const oauthIssuer = data.HARNESS_MCP_OAUTH_ISSUER;
  const oauthJwksUri = isOAuthMode
    ? data.HARNESS_MCP_OAUTH_JWKS_URI
      ?? `${oauthIssuer!.replace(/\/+$/, "")}/protocol/openid-connect/certs`
    : data.HARNESS_MCP_OAUTH_JWKS_URI;
  const oauthProxyPublicUrl = data.HARNESS_MCP_OAUTH_PROXY_PUBLIC_URL
    ?? (isOAuthProxy ? new URL(data.HARNESS_MCP_OAUTH_RESOURCE).origin : undefined);
  const upstreamJwksUri = data.HARNESS_MCP_UPSTREAM_JWKS_URI
    ?? (data.HARNESS_MCP_UPSTREAM_ISSUER
      ? `${data.HARNESS_MCP_UPSTREAM_ISSUER.replace(/\/+$/, "")}/v1/keys`
      : undefined);
  const brokerIssuer = data.HARNESS_MCP_BROKER_ISSUER
    ?? oauthProxyPublicUrl;
  const upstreamDiscoveryUri = data.HARNESS_MCP_UPSTREAM_DISCOVERY_URI
    ?? (data.HARNESS_MCP_UPSTREAM_ISSUER
      ? `${data.HARNESS_MCP_UPSTREAM_ISSUER.replace(/\/+$/, "")}/.well-known/openid-configuration`
      : undefined);

  return {
    ...rest,
    HARNESS_API_KEY: data.HARNESS_API_KEY ?? "",
    HARNESS_ACCOUNT_ID: accountId,
    HARNESS_BASE_URL: harnessBaseUrl,
    HARNESS_ORG,
    HARNESS_PROJECT,
    HARNESS_AUTO_APPROVE_RISK,
    HARNESS_MCP_OAUTH_ISSUER: oauthIssuer,
    HARNESS_MCP_OAUTH_JWKS_URI: oauthJwksUri,
    HARNESS_MCP_OAUTH_PROXY_PUBLIC_URL: oauthProxyPublicUrl,
    HARNESS_MCP_BROKER_ISSUER: brokerIssuer,
    HARNESS_MCP_UPSTREAM_JWKS_URI: upstreamJwksUri,
    HARNESS_MCP_UPSTREAM_DISCOVERY_URI: upstreamDiscoveryUri,
  };
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
  const explicitFmeKey =
    config.HARNESS_MCP_MODE === "multi-user"
      || config.HARNESS_MCP_MODE === "oauth"
      || config.HARNESS_MCP_MODE === "oauth-proxy"
      ? undefined
      : config.HARNESS_FME_API_KEY?.trim();
  if (explicitFmeKey && !isPlaceholderCredential(explicitFmeKey)) {
    return explicitFmeKey;
  }

  const fallbackHarnessKey = config.HARNESS_MCP_MODE === "oauth"
    || config.HARNESS_MCP_MODE === "oauth-proxy"
    ? undefined
    : config.HARNESS_API_KEY?.trim();
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
