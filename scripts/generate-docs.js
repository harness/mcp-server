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
// Other README sections have historical drift; expand this set as those tables are normalized.
const README_COVERAGE_TOOLSETS = new Set(["feature-flags"]);

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

  const defaultResourceTypes = reg.getAllResourceTypes();
  const defaultToolsetResources = reg.getAllToolsets().map((toolset) => ({
    name: toolset.name,
    resourceTypes: toolset.resources.map((resource) => resource.resourceType),
  }));
  const coverageToolsetResources = defaultToolsetResources.filter((toolset) => README_COVERAGE_TOOLSETS.has(toolset.name));
  const coverageResourceTypes = [...new Set(coverageToolsetResources.flatMap((toolset) => toolset.resourceTypes))].sort();
  const resourceTypes = defaultResourceTypes.length;
  const defaultToolsets = defaultToolsetResources.length;

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

  // Prompt count: count source prompt modules (excludes index bundler).
  // Counting build/prompts is vulnerable to stale tsc output because tsc does not clean deleted files.
  const promptDir = join(ROOT, "src", "prompts");
  const promptCount = readdirSync(promptDir)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .length;

  if (promptCount === 0) {
    console.error("WARNING: No prompt files found in src/prompts/ — expected at least 1");
  }

  return { resourceTypes, defaultToolsets, totalToolsets, promptCount, coverageResourceTypes, coverageToolsetResources };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateReadmeCoverage(readme, counts) {
  const errors = [];

  const missingResourceRows = counts.coverageResourceTypes.filter((resourceType) => {
    const rowPattern = new RegExp("^\\| `" + escapeRegExp(resourceType) + "`\\s*\\|", "m");
    return !rowPattern.test(readme);
  });
  if (missingResourceRows.length > 0) {
    errors.push(`README.md Resource Types tables are missing rows for: ${missingResourceRows.join(", ")}`);
  }

  for (const toolset of counts.coverageToolsetResources) {
    const rowPattern = new RegExp("^\\| `" + escapeRegExp(toolset.name) + "`\\s*\\|([^\\n]*)$", "m");
    const rowMatch = readme.match(rowPattern);
    if (!rowMatch) {
      errors.push(`README.md Toolset Filtering table is missing a row for toolset: ${toolset.name}`);
      continue;
    }

    const documentedResources = new Set(
      rowMatch[1]
        .split(",")
        .map((resourceType) => resourceType.trim())
        .filter(Boolean),
    );
    const missingResources = toolset.resourceTypes.filter((resourceType) => !documentedResources.has(resourceType));
    if (missingResources.length > 0) {
      errors.push(`README.md Toolset Filtering row for ${toolset.name} is missing: ${missingResources.join(", ")}`);
    }
  }

  return errors;
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

  const coverageErrors = validateReadmeCoverage(updated, counts);

  if (checkMode) {
    if (original !== updated || coverageErrors.length > 0) {
      if (original !== updated) {
        console.error("README.md is stale. Run `pnpm docs:generate` to refresh.");
        console.error("Differences found in counts or clone instructions.");
      }
      if (coverageErrors.length > 0) {
        console.error("README.md resource coverage is incomplete.");
      }
      for (const error of coverageErrors) {
        console.error(error);
      }
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

  if (coverageErrors.length > 0) {
    console.error("README.md resource coverage is incomplete:");
    for (const error of coverageErrors) {
      console.error(error);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("generate-docs failed:", err);
  process.exit(1);
});
