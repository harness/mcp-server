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

export const ConfigSchema = z.object({
  HARNESS_API_KEY: z.string().min(1, "HARNESS_API_KEY is required"),
  HARNESS_ACCOUNT_ID: z.string().optional(),
  HARNESS_BASE_URL: z.string().url().default("https://app.harness.io"),
  HARNESS_DEFAULT_ORG_ID: z.string().default("default"),
  HARNESS_DEFAULT_PROJECT_ID: z.string().optional(),
  HARNESS_API_TIMEOUT_MS: z.coerce.number().default(30000),
  HARNESS_MAX_RETRIES: z.coerce.number().default(3),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  HARNESS_TOOLSETS: z.string().optional(),
  HARNESS_MAX_BODY_SIZE_MB: z.coerce.number().default(10),
  HARNESS_RATE_LIMIT_RPS: z.coerce.number().default(10),
  HARNESS_READ_ONLY: z.coerce.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema> & { HARNESS_ACCOUNT_ID: string };

export function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  const data = result.data;

  // If HARNESS_ACCOUNT_ID not provided, try to extract from the API key
  if (!data.HARNESS_ACCOUNT_ID) {
    const extracted = extractAccountIdFromToken(data.HARNESS_API_KEY);
    if (!extracted) {
      throw new Error(
        "HARNESS_ACCOUNT_ID is required when the API key is not a PAT (pat.<accountId>.<tokenId>.<secret>)",
      );
    }
    data.HARNESS_ACCOUNT_ID = extracted;
  }

  return data as Config;
}
