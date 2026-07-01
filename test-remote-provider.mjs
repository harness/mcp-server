/**
 * Manual integration test for RemoteSearchProvider against the stub service.
 * Run: node test-remote-provider.mjs
 */
import { RemoteSearchProvider } from "./build/search/remote-provider.js";

const BASE_URL = "http://localhost:8082";

async function run() {
  const provider = new RemoteSearchProvider({ baseUrl: BASE_URL });
  await provider.initialize();
  console.log("available:", provider.isAvailable());

  // Index via the provider
  await provider.index({ id: "pipeline:ts-test", content: "build and test typescript app", corpus: "entities", accountId: "ts-acct", metadata: { resource_type: "pipeline" } });
  await provider.index({ id: "schema:trigger", content: "trigger yaml webhook configuration", corpus: "knowledge", metadata: { resource_type: "trigger" }, ttlMs: 0 });
  console.log("indexed 2 docs");

  // Search entities (account-scoped)
  const entityResults = await provider.search("typescript build", { corpus: "entities", accountId: "ts-acct", k: 5 });
  console.log("\nentity search results:");
  entityResults.forEach(r => console.log(` ${r.id} score=${r.score.toFixed(3)} corpus=${r.corpus}`));

  // Search knowledge (global)
  const knowledgeResults = await provider.search("trigger webhook", { corpus: "knowledge", k: 5 });
  console.log("\nknowledge search results:");
  knowledgeResults.forEach(r => console.log(` ${r.id} score=${r.score.toFixed(3)}`));

  // Search all corpora
  const allResults = await provider.search("pipeline", { corpus: "all", accountId: "ts-acct", k: 10 });
  console.log("\nall-corpus search results:");
  allResults.forEach(r => console.log(` ${r.id} score=${r.score.toFixed(3)} corpus=${r.corpus}`));

  // Isolation check — different account should not see ts-acct entities
  const isolated = await provider.search("typescript build", { corpus: "entities", accountId: "other-acct", k: 5 });
  console.log("\nisolation check (other-acct, should be empty):", isolated.length === 0 ? "PASS" : `FAIL (got ${isolated.length} results)`);
}

run().catch(console.error);
