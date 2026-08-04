#!/usr/bin/env node
/**
 * Smoke-test KB resources against HARNESS_BASE_URL (default local relicx).
 *
 *   pnpm exec node scripts/kb-local-smoke.mjs [test_environment_id]
 */
import { Registry } from "../build/registry/index.js";
import { HarnessClient } from "../build/client/harness-client.js";

const ENV_ID = process.argv[2] ?? "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const config = {
  HARNESS_API_KEY: process.env.HARNESS_API_KEY ?? "pat.kbLocalAcct123.local.secret",
  HARNESS_ACCOUNT_ID: process.env.HARNESS_ACCOUNT_ID ?? "kbLocalAcct123",
  HARNESS_BASE_URL: process.env.HARNESS_BASE_URL ?? "http://localhost:30082",
  HARNESS_ALLOW_HTTP: process.env.HARNESS_ALLOW_HTTP !== "false",
  HARNESS_ORG: "default",
  HARNESS_PROJECT: "test",
  HARNESS_TOOLSETS: "+ait",
  HARNESS_API_TIMEOUT_MS: 30000,
  HARNESS_MAX_RETRIES: 1,
  LOG_LEVEL: "error",
  HARNESS_AUTO_APPROVE_RISK: "high_write",
  HARNESS_READ_ONLY: false,
  HARNESS_SKIP_ELICITATION: true,
  HARNESS_MAX_BODY_SIZE_MB: 10,
  HARNESS_RATE_LIMIT_RPS: 10,
  HARNESS_FME_BASE_URL: "https://api.split.io",
  HARNESS_LOG_UNSAFE_BODIES: false,
  HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
  HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
};

const client = new HarnessClient(config);
const registry = new Registry(config);

const history = await registry.dispatch(client, "kb_crawl", "list", {
  test_environment_id: ENV_ID,
  size: 3,
});
console.log("kb_crawl list:", JSON.stringify(history, null, 2));

const first = history.items?.[0];
if (first && typeof first === "object" && first !== null && "crawl_run_id" in first) {
  const run = await registry.dispatch(client, "kb_crawl", "get", {
    crawl_run_id: first.crawl_run_id,
  });
  console.log("kb_crawl get:", JSON.stringify(run, null, 2));
}
