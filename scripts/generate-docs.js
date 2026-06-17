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
const README_COVERAGE_TOOLSETS = new Map([
  ["feature-flags", { sectionTitle: "Feature Flags" }],
  ["file_store", { sectionTitle: "File Store" }],
]);
const CRUD_OPERATIONS = ["list", "get", "create", "update", "delete"];
const CRUD_COLUMN_INDEX = { list: 1, get: 2, create: 3, update: 4, delete: 5 };
const EXECUTE_ACTIONS_COLUMN_INDEX = 6;

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
    sectionTitle: README_COVERAGE_TOOLSETS.get(toolset.name)?.sectionTitle,
    resources: toolset.resources.map((resource) => ({
      resourceType: resource.resourceType,
      operations: Object.keys(resource.operations),
      executeActions: Object.keys(resource.executeActions ?? {}),
    })),
  }));
  const coverageToolsetResources = defaultToolsetResources
    .filter((toolset) => README_COVERAGE_TOOLSETS.has(toolset.name))
    .map((toolset) => ({
      ...toolset,
      resourceTypes: toolset.resources.map((resource) => resource.resourceType),
    }));
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

  return { resourceTypes, defaultToolsets, totalToolsets, promptCount, coverageToolsetResources };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return undefined;
  const cells = trimmed.split("|").slice(1, -1).map((cell) => cell.trim());
  return cells.length > 0 ? cells : undefined;
}

function parseResourceRows(section) {
  const rows = new Map();
  for (const line of section.split(/\r?\n/)) {
    const cells = parseMarkdownRow(line);
    const match = cells?.[0]?.match(/^`([^`]+)`$/);
    if (match) {
      rows.set(match[1], cells);
    }
  }
  return rows;
}

function parseExecuteActions(cell) {
  if (!cell) return [];
  const backtickMatches = [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  if (backtickMatches.length > 0) return backtickMatches;
  return cell.split(",").map((action) => action.trim()).filter(Boolean);
}

function findReadmeSection(readme, sectionTitle) {
  const headingPattern = new RegExp("^### " + escapeRegExp(sectionTitle) + "[ \\t]*$", "m");
  const headingMatch = headingPattern.exec(readme);
  if (!headingMatch) return undefined;

  const contentStart = headingMatch.index + headingMatch[0].length;
  const rest = readme.slice(contentStart);
  const nextHeadingMatch = /^###\s/m.exec(rest);
  return nextHeadingMatch ? rest.slice(0, nextHeadingMatch.index) : rest;
}

function findMarkdownTableRow(readme, firstCell, expectedCellCount) {
  for (const line of readme.split(/\r?\n/)) {
    const cells = parseMarkdownRow(line);
    if (cells?.[0] === firstCell && (expectedCellCount === undefined || cells.length === expectedCellCount)) {
      return cells;
    }
  }
  return undefined;
}

function validateResourceMatrix(readme, toolset) {
  const errors = [];
  const sectionTitle = toolset.sectionTitle;
  if (!sectionTitle) return errors;

  const section = findReadmeSection(readme, sectionTitle);
  if (!section) {
    return [`README.md is missing the ${sectionTitle} resource matrix section.`];
  }

  const expectedResources = new Map(toolset.resources.map((resource) => [resource.resourceType, resource]));
  const documentedRows = parseResourceRows(section);

  const missingRows = [...expectedResources.keys()].filter((resourceType) => !documentedRows.has(resourceType));
  if (missingRows.length > 0) {
    errors.push(`README.md ${sectionTitle} table is missing resource rows for: ${missingRows.join(", ")}`);
  }

  const extraRows = [...documentedRows.keys()].filter((resourceType) => !expectedResources.has(resourceType));
  if (extraRows.length > 0) {
    errors.push(`README.md ${sectionTitle} table has stale resource rows for: ${extraRows.join(", ")}`);
  }

  for (const [resourceType, resource] of expectedResources) {
    const cells = documentedRows.get(resourceType);
    if (!cells) continue;

    for (const operation of CRUD_OPERATIONS) {
      const expected = resource.operations.includes(operation);
      const documented = cells[CRUD_COLUMN_INDEX[operation]]?.toLowerCase() === "x";
      if (expected !== documented) {
        errors.push(
          `README.md ${sectionTitle} table operation drift for ${resourceType}.${operation}: expected ${expected ? "x" : "blank"}, found ${documented ? "x" : "blank"}`,
        );
      }
    }

    const expectedActions = resource.executeActions;
    const documentedActions = parseExecuteActions(cells[EXECUTE_ACTIONS_COLUMN_INDEX] ?? "");
    const missingActions = expectedActions.filter((action) => !documentedActions.includes(action));
    const extraActions = documentedActions.filter((action) => !expectedActions.includes(action));
    if (missingActions.length > 0) {
      errors.push(`README.md ${sectionTitle} table execute actions for ${resourceType} are missing: ${missingActions.join(", ")}`);
    }
    if (extraActions.length > 0) {
      errors.push(`README.md ${sectionTitle} table execute actions for ${resourceType} are stale: ${extraActions.join(", ")}`);
    }
  }

  return errors;
}

function validateReadmeCoverage(readme, counts) {
  const errors = [];

  for (const toolset of counts.coverageToolsetResources) {
    errors.push(...validateResourceMatrix(readme, toolset));
  }

  for (const toolset of counts.coverageToolsetResources) {
    const expectedResourceTypes = new Set(toolset.resourceTypes);
    const rowCells = findMarkdownTableRow(readme, `\`${toolset.name}\``, 2);
    if (!rowCells) {
      errors.push(`README.md Toolset Filtering table is missing a row for toolset: ${toolset.name}`);
      continue;
    }

    const documentedResources = (rowCells[1] ?? "")
      .split(",")
      .map((resourceType) => resourceType.trim())
      .filter(Boolean);
    const documentedResourceTypes = new Set(documentedResources);
    const missingResources = toolset.resourceTypes.filter((resourceType) => !documentedResourceTypes.has(resourceType));
    const extraResources = documentedResources.filter((resourceType) => !expectedResourceTypes.has(resourceType));
    if (missingResources.length > 0) {
      errors.push(`README.md Toolset Filtering row for ${toolset.name} is missing: ${missingResources.join(", ")}`);
    }
    if (extraResources.length > 0) {
      errors.push(`README.md Toolset Filtering row for ${toolset.name} has stale entries: ${extraResources.join(", ")}`);
    }
  }

  return errors;
}

const REPLACEMENTS = [
  // "163 resource types" in any context
  { pattern: /\b\d+ resource types?\b/g, replacement: (c) => `${c.resourceTypes} resource types` },
  // "27 prompt templates"
  { pattern: /\b\d+ prompt templates?\b/g, replacement: (c) => `${c.promptCount} prompt templates` },
  // "31 default toolsets"
  { pattern: /\b\d+ default toolsets?\b/g, replacement: (c) => `${c.defaultToolsets} default toolsets` },
  // "30 of 31 toolsets" — specific compound pattern
  { pattern: /\b\d+ of \d+ toolsets?\b/g, replacement: (c) => `${c.defaultToolsets} of ${c.totalToolsets} toolsets` },
  // "31 toolsets" — only when NOT preceded by "of " (avoids double-replacing "N of M toolsets")
  { pattern: /(?<!of )\b\d+ toolsets?\b/g, replacement: (c) => `${c.defaultToolsets} toolsets` },
  // Architecture diagram: |  31 Toolsets      |
  { pattern: /\|\s+\d+ Toolsets\s+\|/g, replacement: (c) => `|  ${c.defaultToolsets} Toolsets      |` },
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
