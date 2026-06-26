/**
 * Semantic search smoke test — run against a live MCP server to verify
 * routing effectiveness and corpus correctness after changes.
 *
 * Usage:
 *   HARNESS_API_KEY=<pat> HARNESS_ACCOUNT_ID=<id> node scripts/smoke-test-search.mjs
 *
 * What it checks:
 *   - Semantic routing fires (types_skipped > 0) for well-typed queries
 *   - knowledge corpus results appear at tier-0
 *   - Ambiguous queries fall back to full scatter-gather gracefully
 *   - No crashes or errors
 *
 * Expected baseline (captured 2026-06-26, all-MiniLM-L6-v2, knowledge corpus):
 *   "kubernetes connector"    → routed, ~6 types searched, ~109 skipped
 *   "create a CD pipeline"    → routed, ~4 types searched, ~123 skipped
 *   "feature flag rollout"    → routed, ~6 types searched, ~121 skipped
 *   "github secret"           → NOT routed (ambiguous), all 163 types searched
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, "../build/index.js");

const QUERIES = [
  {
    query: "kubernetes connector",
    expectRouted: true,
    minSkipped: 50,
    desc: "well-typed query should route to connector types",
  },
  {
    query: "create a CD pipeline",
    expectRouted: true,
    minSkipped: 50,
    desc: "pipeline query should route to pipeline types",
  },
  {
    query: "feature flag rollout",
    expectRouted: true,
    minSkipped: 50,
    desc: "FME query should route to feature flag types",
  },
  {
    query: "github secret",
    expectRouted: false,
    minSkipped: 0,
    desc: "ambiguous query should fall back to full scatter-gather",
  },
];

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const INFO = "\x1b[36mℹ\x1b[0m";

async function run() {
  const apiKey = process.env.HARNESS_API_KEY;
  const accountId = process.env.HARNESS_ACCOUNT_ID;
  if (!apiKey || !accountId) {
    console.error("HARNESS_API_KEY and HARNESS_ACCOUNT_ID must be set");
    process.exit(1);
  }

  console.log(`${INFO} Starting MCP server...`);
  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_PATH],
    env: {
      ...process.env,
      HARNESS_API_KEY: apiKey,
      HARNESS_ACCOUNT_ID: accountId,
      HARNESS_SEARCH_PROVIDER: "local",
      LOG_LEVEL: "warn",
    },
  });

  const client = new Client({ name: "smoke-test-search", version: "1.0.0" });
  await client.connect(transport);
  console.log(`${INFO} Connected. Waiting 8s for model to initialize and static content to index...`);
  await new Promise(r => setTimeout(r, 8000));

  let passed = 0;
  let failed = 0;

  for (const { query, expectRouted, minSkipped, desc } of QUERIES) {
    process.stdout.write(`  "${query}" — `);
    try {
      const result = await client.callTool({
        name: "harness_search",
        arguments: { query, max_per_type: 3 },
      });

      const text = result.content?.[0]?.text ?? "{}";
      const data = JSON.parse(text);

      const routed = data.semantic_routed === true;
      const skipped = data.types_skipped ?? 0;
      const tier0Count = (data.results ?? []).filter(r => r.tier === 0).length;
      const knowledgeCorpus = (data.results ?? [])
        .filter(r => r.tier === 0)
        .flatMap(r => r.items)
        .some(i => i._corpus === "knowledge");

      const routingOk = expectRouted ? routed && skipped >= minSkipped : !routed;
      const corpusOk = tier0Count > 0 ? knowledgeCorpus : true;

      if (routingOk && corpusOk) {
        console.log(`${PASS} searched=${data.searched_types}, skipped=${skipped}, tier0=${tier0Count}, routed=${routed}`);
        passed++;
      } else {
        console.log(`${FAIL} searched=${data.searched_types}, skipped=${skipped}, tier0=${tier0Count}, routed=${routed}`);
        if (!routingOk) console.log(`    expected routed=${expectRouted}, skipped>=${minSkipped}`);
        if (!corpusOk) console.log(`    expected tier-0 results from knowledge corpus`);
        failed++;
      }
      console.log(`    ${desc}`);
    } catch (err) {
      console.log(`${FAIL} ERROR: ${err.message}`);
      failed++;
    }
  }

  await client.close();

  console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
