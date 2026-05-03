#!/usr/bin/env node

/**
 * Patches README.md with dynamic counts from the registry.
 *
 * Usage:
 *   node scripts/generate-docs.js          # patch in place
 *   node scripts/generate-docs.js --check  # exit 1 if README is stale
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const README_PATH = join(ROOT, "README.md");

async function getCounts() {
  const { Registry } = await import(join(ROOT, "build", "registry", "index.js"));

  const config = {
    HARNESS_API_KEY: "pat.docs.gen.token",
    HARNESS_ACCOUNT_ID: "docs",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "docs",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "error",
  };
  const reg = new Registry(config);

  const resourceTypes = reg.getAllResourceTypes().length;
  const defaultToolsets = reg.getAllToolsets().length;

  // Discover opt-in toolset names dynamically: add every toolset that
  // isn't already loaded. This avoids hardcoding opt-in names.
  const defaultNames = new Set(reg.getAllToolsets().map((t) => t.name));
  const { ALL_TOOLSET_NAMES } = await import(join(ROOT, "build", "registry", "index.js"));
  const optInNames = ALL_TOOLSET_NAMES
    ? ALL_TOOLSET_NAMES.filter((n) => !defaultNames.has(n))
    : [];
  const additive = optInNames.map((n) => `+${n}`).join(",");
  const configAll = additive
    ? { ...config, HARNESS_TOOLSETS: additive }
    : config;
  const regAll = additive ? new Registry(configAll) : reg;
  const totalToolsets = regAll.getAllToolsets().length;

  // Prompt count: count built prompt modules under build/prompts/ (excludes index bundler).
  // Resource/toolset counts above come from Registry (same surface as the running server).
  const promptDir = join(ROOT, "build", "prompts");
  const promptCount = readdirSync(promptDir)
    .filter((f) => f.endsWith(".js") && f !== "index.js")
    .length;

  if (promptCount === 0) {
    console.error("WARNING: No prompt files found in build/prompts/ — expected at least 1");
  }

  return { resourceTypes, defaultToolsets, totalToolsets, promptCount };
}

const REPLACEMENTS = [
  // "163 resource types" in any context
  { pattern: /\b\d+ resource types?\b/g, replacement: (c) => `${c.resourceTypes} resource types` },
  // "27 prompt templates"
  { pattern: /\b\d+ prompt templates?\b/g, replacement: (c) => `${c.promptCount} prompt templates` },
  // "30 of 31 toolsets" — specific compound pattern
  { pattern: /\b\d+ of \d+ toolsets?\b/g, replacement: (c) => `${c.defaultToolsets} of ${c.totalToolsets} toolsets` },
  // "31 toolsets" — only when NOT preceded by "of " (avoids double-replacing "N of M toolsets")
  { pattern: /(?<!of )\b\d+ toolsets?\b/g, replacement: (c) => `${c.defaultToolsets} toolsets` },
  // Architecture diagram: |  163 Resource Types|
  { pattern: /\|\s+\d+ Resource Types\|/g, replacement: (c) => `|  ${c.resourceTypes} Resource Types|` },
  // Clone instructions: cd harness-mcp-v2 -> cd mcp-server
  { pattern: /^cd harness-mcp-v2$/gm, replacement: () => "cd mcp-server" },
];

async function main() {
  const checkMode = process.argv.includes("--check");
  const counts = await getCounts();

  const original = readFileSync(README_PATH, "utf-8");
  let updated = original;

  for (const { pattern, replacement } of REPLACEMENTS) {
    updated = updated.replace(pattern, replacement(counts));
  }

  if (checkMode) {
    if (original !== updated) {
      console.error("README.md is stale. Run `pnpm docs:generate` to refresh.");
      console.error("Differences found in counts or clone instructions.");
      process.exit(1);
    }
    console.error("README.md is up to date.");
    process.exit(0);
  }

  if (original === updated) {
    console.error("README.md is already up to date.");
  } else {
    writeFileSync(README_PATH, updated);
    console.error(`README.md updated: ${counts.resourceTypes} resource types, ${counts.defaultToolsets}/${counts.totalToolsets} toolsets, ${counts.promptCount} prompts.`);
  }
}

main().catch((err) => {
  console.error("generate-docs failed:", err);
  process.exit(1);
});
