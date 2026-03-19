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
  HARNESS_API_KEY: z.string().optional(),
  HARNESS_ACCOUNT_ID: z.string().optional(),
  HARNESS_BASE_URL: z.string().url().default("https://app.harness.io"),
  HARNESS_DEFAULT_ORG_ID: z.string().default("default"),
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
  HARNESS_ALLOW_HTTP: z.coerce.boolean().default(false),
  HARNESS_FME_BASE_URL: z.string().url().default("https://api.split.io"),
  HARNESS_FME_API_KEY: z.string().min(1).optional(),
  // JWT authentication (optional — enables Bearer token auth in HTTP mode)
  JWT_SECRET: z.string().min(1).optional(),
  JWT_ISSUER: z.string().optional(),
  JWT_AUDIENCE: z.string().optional(),
  JWT_ALGORITHM: z.enum(["HS256", "RS256", "ES256"]).default("HS256"),
});

export const ConfigSchema = RawConfigSchema.superRefine((data, ctx) => {
  // Validate auth mode: require either JWT_SECRET OR HARNESS_API_KEY
  const hasJwtSecret = !!data.JWT_SECRET;
  const hasApiKey = !!data.HARNESS_API_KEY;

  if (!hasJwtSecret && !hasApiKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either JWT_SECRET or HARNESS_API_KEY must be provided for authentication",
      path: ["HARNESS_API_KEY"],
    });
    return;
  }

  // HTTPS enforcement for JWT authentication (bearer tokens must be protected)
  if (hasJwtSecret && !data.HARNESS_BASE_URL.startsWith("https://") && !data.HARNESS_ALLOW_HTTP) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "JWT authentication requires HTTPS. Set HARNESS_ALLOW_HTTP=true only for local development.",
      path: ["HARNESS_BASE_URL"],
    });
    return;
  }

  // HTTPS enforcement for general use (non-JWT)
  if (!data.HARNESS_BASE_URL.startsWith("https://") && !data.HARNESS_ALLOW_HTTP) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `HARNESS_BASE_URL must use HTTPS (got "${data.HARNESS_BASE_URL}"). If you need HTTP for local development, set HARNESS_ALLOW_HTTP=true.`,
      path: ["HARNESS_BASE_URL"],
    });
    return;
  }

  // Extract account ID from PAT token or use explicit HARNESS_ACCOUNT_ID
  let accountId = data.HARNESS_ACCOUNT_ID;
  if (!accountId && hasApiKey) {
    accountId = extractAccountIdFromToken(data.HARNESS_API_KEY!);
  }

  // JWT-only mode: account ID comes from JWT claims at runtime (validated per-request)
  // API key mode: account ID required now (either from PAT or explicit env var)
  if (!accountId && !hasJwtSecret) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "HARNESS_ACCOUNT_ID is required when the API key is not a PAT (pat.<accountId>.<tokenId>.<secret>)",
      path: ["HARNESS_ACCOUNT_ID"],
    });
    return;
  }

  // For JWT-only mode without API key, set a placeholder account ID
  // (actual account ID comes from JWT claims per-request)
  if (!accountId && hasJwtSecret) {
    accountId = "jwt-mode";  // Placeholder — overridden per-request
  }
}).transform((data) => {
  // Extract account ID after validation
  let accountId = data.HARNESS_ACCOUNT_ID;
  if (!accountId && data.HARNESS_API_KEY) {
    accountId = extractAccountIdFromToken(data.HARNESS_API_KEY);
  }
  if (!accountId && data.JWT_SECRET) {
    accountId = "jwt-mode";
  }

  return { ...data, HARNESS_ACCOUNT_ID: accountId! };
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Resolve the base URL for a given product backend.
 * - "harness" → undefined (uses the default client base URL)
 * - "fme"     → config.HARNESS_FME_BASE_URL
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
