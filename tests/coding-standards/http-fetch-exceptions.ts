/**
 * Production src/ files allowed to call global fetch() outside HarnessClient.
 * Keep in sync with docs/coding-standards.md §11 and architecture.test.ts guards.
 */
export const ALLOWED_GLOBAL_FETCH_FILES = [
  "src/client/harness-client.ts",
  "src/utils/log-resolver.ts",
  "src/utils/oauth-auth.ts",
  "src/utils/oauth-proxy.ts",
  "src/utils/oauth-broker.ts",
  "src/audit/sinks/webhook.ts",
  "src/search/remote-provider.ts",
  "src/client/typesafe-client.ts",
] as const;

export const ALLOWED_GLOBAL_FETCH_FILE_SET = new Set<string>(ALLOWED_GLOBAL_FETCH_FILES);
