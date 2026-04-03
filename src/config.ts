import * as z from "zod/v4";

/**
 * Extract the account ID from a Harness PAT token.
 * PAT format: pat.<accountId>.<tokenId>.<secret>
 * Returns undefined if the token doesn't match the expected format.
 */
export function extractAccountIdFromToken(apiKey: string): string | undefined {
  const parts = apiKey.split(".");
  const accountId = parts[1];
  if (parts.length >= 3 && parts[0] === "pat" && accountId && accountId.length > 0) {
    return accountId;
  }
  return undefined;
}

const RawConfigSchema = z.object({
  HARNESS_API_KEY: z.string().min(1, "HARNESS_API_KEY is required"),
  HARNESS_ACCOUNT_ID: z.string().optional(),
  HARNESS_BASE_URL: z.string().url().default("https://app.harness.io"),
  // New names (preferred)
  HARNESS_ORG: z.string().optional(),
  HARNESS_PROJECT: z.string().optional(),
  // Deprecated names (backward compat)
  HARNESS_DEFAULT_ORG_ID: z.string().optional(),
  HARNESS_DEFAULT_PROJECT_ID: z.string().optional(),
  HARNESS_API_TIMEOUT_MS: z.coerce.number().default(30000),
  HARNESS_MAX_RETRIES: z.coerce.number().default(3),
  LOG_LEVEL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.enum(["debug", "info", "warn", "error"]).default("info"),
  ),
  HARNESS_TOOLSETS: z.string().optional(),
  HARNESS_MAX_BODY_SIZE_MB: z.coerce.number().default(10),
  HARNESS_RATE_LIMIT_RPS: z.coerce.number().default(10),
  HARNESS_READ_ONLY: z.coerce.boolean().default(false),
  HARNESS_SKIP_ELICITATION: z.coerce.boolean().default(false),
  HARNESS_ALLOW_HTTP: z.coerce.boolean().default(false),
  HARNESS_FME_BASE_URL: z.string().url().default("https://api.split.io"),
});

export const ConfigSchema = RawConfigSchema.transform((data) => {
  const accountId = data.HARNESS_ACCOUNT_ID ?? extractAccountIdFromToken(data.HARNESS_API_KEY);
  if (!accountId) {
    throw new Error(
      "HARNESS_ACCOUNT_ID is required when the API key is not a PAT (pat.<accountId>.<tokenId>.<secret>)",
    );
  }

  if (!data.HARNESS_BASE_URL.startsWith("https://") && !data.HARNESS_ALLOW_HTTP) {
    throw new Error(
      `HARNESS_BASE_URL must use HTTPS (got "${data.HARNESS_BASE_URL}"). ` +
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
  const HARNESS_ORG = data.HARNESS_ORG ?? data.HARNESS_DEFAULT_ORG_ID ?? "default";
  const HARNESS_PROJECT = data.HARNESS_PROJECT ?? data.HARNESS_DEFAULT_PROJECT_ID;

  // Remove deprecated keys from output, expose only the canonical names
  const { HARNESS_DEFAULT_ORG_ID: _oldOrg, HARNESS_DEFAULT_PROJECT_ID: _oldProject, ...rest } = data;

  return { ...rest, HARNESS_ACCOUNT_ID: accountId, HARNESS_ORG, HARNESS_PROJECT };
});

export type Config = z.infer<typeof ConfigSchema>;

/** FME (Split.io) API base URL — always api.split.io, not configurable. */
const FME_BASE_URL = "https://api.split.io";

/**
 * Resolve the base URL for a given product backend.
 * - "harness" → undefined (uses the default client base URL)
 * - "fme"     → https://api.split.io
 */
export function resolveProductBaseUrl(_config: Config, product: "harness" | "fme"): string | undefined {
  if (product === "fme") return FME_BASE_URL;
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
