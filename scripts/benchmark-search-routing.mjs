#!/usr/bin/env node

/**
 * Credential-free semantic routing benchmark.
 *
 * Usage:
 *   pnpm build
 *   node scripts/benchmark-search-routing.mjs
 *   node scripts/benchmark-search-routing.mjs --json
 *   node scripts/benchmark-search-routing.mjs --fail-on-miss
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BUILD = join(ROOT, "build");
const GOLDEN_PATH = join(ROOT, "tests", "fixtures", "search-routing-golden.json");

function parseArgs(argv) {
  const options = {
    json: false,
    failOnMiss: false,
    k: 30,
    model: process.env.HARNESS_SEARCH_MODEL ?? "Xenova/all-MiniLM-L6-v2",
  };
  for (const arg of argv) {
    if (arg === "--") {
      continue;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--fail-on-miss") {
      options.failOnMiss = true;
    } else if (arg.startsWith("--k=")) {
      const value = Number(arg.slice("--k=".length));
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --k value: ${arg}`);
      }
      options.k = value;
    } else if (arg.startsWith("--model=")) {
      const value = arg.slice("--model=".length).trim();
      if (!value) {
        throw new Error(`Invalid --model value: ${arg}`);
      }
      options.model = value;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`Search routing benchmark

Usage:
  pnpm build
  node scripts/benchmark-search-routing.mjs [--json] [--fail-on-miss] [--k=30] [--model=Xenova/all-MiniLM-L6-v2]

Options:
  --json          Print machine-readable JSON instead of a text report
  --fail-on-miss  Exit non-zero when any golden case misses an expected type
  --k=N           Number of semantic hits to inspect per query (default 30)
  --model=MODEL   HuggingFace/Transformers.js feature-extraction model to test
`);
}

function makeBenchmarkConfig() {
  return {
    HARNESS_MCP_MODE: "single-user",
    HARNESS_API_KEY: "pat.search.benchmark.secret",
    HARNESS_ACCOUNT_ID: "search",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "benchmark",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: process.env.LOG_LEVEL ?? "error",
    HARNESS_SEARCH_PROVIDER: "local",
    HARNESS_HF_CACHE_DIR: process.env.HARNESS_HF_CACHE_DIR ?? "/tmp/hf-cache",
  };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function summarizeCase(result) {
  const status = result.passed ? "PASS" : "MISS";
  const routed = result.semanticRouted ? result.routedTypes.join(",") : "fallback";
  const missing = result.missingExpectedTypes.length > 0
    ? ` missing=${result.missingExpectedTypes.join(",")}`
    : "";
  return `${status} ${result.id}: searched=${result.searchedTypes}/${result.candidateTypes} top=${result.topScore.toFixed(3)} routed=${routed}${missing}`;
}

async function loadBuildModules() {
  try {
    const [
      { Registry, ALL_TOOLSET_NAMES },
      { SearchManager },
      { extractRoutingTypes, applyRoutingSafetyFloor },
      { evaluateRouting, validateGoldenCases },
      { setLogLevel },
    ] = await Promise.all([
      import(join(BUILD, "registry", "index.js")),
      import(join(BUILD, "search", "manager.js")),
      import(join(BUILD, "tools", "harness-search.js")),
      import(join(BUILD, "search", "routing-eval.js")),
      import(join(BUILD, "utils", "logger.js")),
    ]);
    setLogLevel(process.env.LOG_LEVEL ?? "error");
    return {
      Registry,
      ALL_TOOLSET_NAMES,
      SearchManager,
      extractRoutingTypes,
      applyRoutingSafetyFloor,
      evaluateRouting,
      validateGoldenCases,
    };
  } catch (err) {
    throw new Error(`Failed to load build artifacts. Run "pnpm build" first. ${err.message}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  process.env.HARNESS_SEARCH_MODEL = options.model;
  const {
    Registry,
    ALL_TOOLSET_NAMES,
    SearchManager,
    extractRoutingTypes,
    applyRoutingSafetyFloor,
    evaluateRouting,
    validateGoldenCases,
  } = await loadBuildModules();

  const config = makeBenchmarkConfig();
  const defaultRegistry = new Registry(config);
  const defaultToolsets = new Set(defaultRegistry.getAllToolsets().map((toolset) => toolset.name));
  const additiveToolsets = ALL_TOOLSET_NAMES
    .filter((name) => !defaultToolsets.has(name))
    .map((name) => `+${name}`)
    .join(",");
  const registry = additiveToolsets
    ? new Registry({ ...config, HARNESS_TOOLSETS: additiveToolsets })
    : defaultRegistry;
  const candidateTypes = registry.getTypesForOperation("list");
  const cases = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));
  const validationErrors = validateGoldenCases(cases, candidateTypes);
  if (validationErrors.length > 0) {
    console.error("Invalid search routing golden set:");
    for (const error of validationErrors) console.error(`- ${error}`);
    process.exit(1);
  }

  const manager = new SearchManager(config);
  const rssBefore = process.memoryUsage().rss;
  const initStart = performance.now();
  await manager.initialize();
  if (!manager.getProvider().isAvailable()) {
    console.error("Local search provider is unavailable. Check @huggingface/transformers and model cache access.");
    process.exit(1);
  }
  await manager.indexStaticContent(registry);
  const initMs = performance.now() - initStart;
  const rssAfterIndex = process.memoryUsage().rss;
  const provider = manager.getProvider();

  const observations = [];
  for (const testCase of cases) {
    const started = performance.now();
    const semanticResults = await provider.search(testCase.query, {
      corpus: "knowledge",
      k: options.k,
    });
    const latencyMs = performance.now() - started;
    const predictedTypes = extractRoutingTypes(semanticResults, candidateTypes);
    const semanticRouted = predictedTypes !== null;
    const routedTypes = semanticRouted
      ? applyRoutingSafetyFloor(predictedTypes, candidateTypes)
      : candidateTypes;

    observations.push({
      id: testCase.id,
      query: testCase.query,
      mode: testCase.mode,
      expectedTypes: testCase.expectedTypes,
      acceptableTypes: testCase.acceptableTypes ?? [],
      routedTypes,
      semanticRouted,
      searchedTypes: routedTypes.length,
      candidateTypes: candidateTypes.length,
      topScore: semanticResults[0]?.score ?? 0,
      latencyMs,
    });
  }

  const evaluation = evaluateRouting(observations);
  const output = {
    model: options.model,
    provider: manager.getProvider().constructor.name,
    fixture: "tests/fixtures/search-routing-golden.json",
    candidateTypes: candidateTypes.length,
    initMs,
    rssDeltaMb: (rssAfterIndex - rssBefore) / 1024 / 1024,
    ...evaluation,
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log("Search routing benchmark");
    console.log(`Model: ${output.model}`);
    console.log(`Cases: ${evaluation.summary.totalCases}`);
    console.log(`Pass: ${evaluation.summary.passedCases}, Miss: ${evaluation.summary.failedCases}`);
    console.log(`Expected-type recall: ${formatPercent(evaluation.summary.expectedTypeRecall)}`);
    console.log(`False negatives: ${evaluation.summary.falseNegativeCount}`);
    console.log(`Avg searched types: ${formatNumber(evaluation.summary.averageSearchedTypes)} / ${candidateTypes.length}`);
    console.log(`Avg latency: ${formatNumber(evaluation.summary.averageLatencyMs)} ms`);
    console.log(`Init + static index: ${formatNumber(initMs)} ms`);
    console.log(`RSS delta: ${formatNumber(output.rssDeltaMb)} MB`);
    console.log("");
    for (const result of evaluation.cases) {
      console.log(summarizeCase(result));
    }
  }

  if (options.failOnMiss && evaluation.summary.failedCases > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
