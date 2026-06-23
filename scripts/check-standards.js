/**
 * Architecture standards compliance check for the registry-driven MCP server.
 *
 * Enforces the rules documented in docs/coding-standards.md. Exits non-zero on
 * violations that would break the consolidated-tool / pure-data toolset model.
 *
 * Usage: node scripts/check-standards.js
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

/** Consolidated MCP tool handlers — no additional server.registerTool() files. */
const ALLOWED_TOOL_HANDLERS = new Set([
  "harness-create.ts",
  "harness-delete.ts",
  "harness-describe.ts",
  "harness-diagnose.ts",
  "harness-execute.ts",
  "harness-get.ts",
  "harness-list.ts",
  "harness-schema.ts",
  "harness-search.ts",
  "harness-status.ts",
  "harness-update.ts",
]);

/** Support modules allowed under src/tools/ (not MCP tool handlers). */
const ALLOWED_TOOL_SUPPORT = new Set([
  "index.ts",
  "input-schemas.ts",
  "output-schemas.ts",
]);

/** Paths where direct fetch() is permitted (non-Harness or presigned URLs). */
const FETCH_ALLOWLIST = new Set([
  "src/client/harness-client.ts",
  "src/utils/log-resolver.ts",
  "src/audit/sinks/webhook.ts",
]);

/** Toolset helper modules (not registered in ALL_TOOLSETS). */
const TOOLSET_HELPER_FILES = new Set(["chaos-descriptions.ts", "scopes.ts"]);

const errors = [];
const warnings = [];

function rel(filePath) {
  return relative(ROOT, filePath).replace(/\\/g, "/");
}

function walk(dir, predicate = () => true) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!predicate(full)) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...walk(full, predicate));
    } else if (st.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function read(path) {
  return readFileSync(path, "utf8");
}

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function checkNoConsoleLog() {
  for (const file of walk(SRC, (p) => p.endsWith(".ts"))) {
    const content = read(file);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/\bconsole\.log\s*\(/.test(lines[i])) {
        addError(`${rel(file)}:${i + 1} — console.log() corrupts stdio JSON-RPC; use createLogger() on stderr`);
      }
    }
  }
}

function checkRegisterToolLocations() {
  for (const file of walk(SRC, (p) => p.endsWith(".ts"))) {
    const content = read(file);
    if (!content.includes("registerTool(") && !content.includes("server.tool(")) continue;

    const r = rel(file);
    const isAllowedHandler = r.startsWith("src/tools/harness-") && ALLOWED_TOOL_HANDLERS.has(r.slice("src/tools/".length));

    if (content.includes("server.tool(")) {
      addError(`${r} — server.tool() is forbidden; use server.registerTool() in consolidated handlers only`);
    }
    if (content.includes("registerTool(") && !isAllowedHandler) {
      addError(`${r} — registerTool() only allowed in src/tools/harness-*.ts consolidated handlers`);
    }
  }
}

function checkToolsDirectory() {
  const toolsDir = join(SRC, "tools");
  for (const entry of readdirSync(toolsDir)) {
    const full = join(toolsDir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!["diagnose", "entity-schema"].includes(entry)) {
        addError(`src/tools/${entry}/ — unexpected subdirectory; only diagnose/ and entity-schema/ are allowed`);
      }
      continue;
    }
    if (!ALLOWED_TOOL_HANDLERS.has(entry) && !ALLOWED_TOOL_SUPPORT.has(entry)) {
      addError(`src/tools/${entry} — unexpected file; add capabilities via registry toolsets, not new tool files`);
    }
  }
}

function checkFetchAllowlist() {
  for (const file of walk(SRC, (p) => p.endsWith(".ts"))) {
    const content = read(file);
    if (!/\bfetch\s*\(/.test(content)) continue;
    const r = rel(file);
    if (!FETCH_ALLOWLIST.has(r)) {
      addError(`${r} — direct fetch() bypasses HarnessClient auth/retry/rate-limiting`);
    }
  }
}

function checkHarnessClientSingleton() {
  for (const file of walk(SRC, (p) => p.endsWith(".ts"))) {
    const content = read(file);
    if (!/new\s+HarnessClient\s*\(/.test(content)) continue;
    const r = rel(file);
    if (r !== "src/index.ts") {
      addError(`${r} — HarnessClient must be instantiated only in src/index.ts`);
    }
  }
}

function checkToolsetForbiddenImports() {
  const toolsetsDir = join(SRC, "registry", "toolsets");
  for (const file of walk(toolsetsDir, (p) => p.endsWith(".ts"))) {
    const base = file.slice(file.lastIndexOf("/") + 1);
    if (TOOLSET_HELPER_FILES.has(base)) continue;

    const content = read(file);
    const r = rel(file);
    const forbidden = [
      { pattern: /from\s+["'][^"']*harness-client/, label: "HarnessClient" },
      { pattern: /from\s+["']@modelcontextprotocol\/sdk/, label: "McpServer" },
      { pattern: /from\s+["'][^"']*registry\/index/, label: "Registry" },
    ];
    for (const { pattern, label } of forbidden) {
      if (pattern.test(content)) {
        addError(`${r} — toolsets must not import ${label}; keep toolset files pure data`);
      }
    }
  }
}

function extractToolsetNamesFromFiles() {
  const toolsetsDir = join(SRC, "registry", "toolsets");
  const names = new Map();
  for (const file of walk(toolsetsDir, (p) => p.endsWith(".ts"))) {
    const base = file.slice(file.lastIndexOf("/") + 1);
    if (TOOLSET_HELPER_FILES.has(base)) continue;
    const content = read(file);
    const match = content.match(/export\s+const\s+\w+Toolset[\s\S]*?name:\s*"([^"]+)"/);
    if (!match) {
      addError(`${rel(file)} — could not find ToolsetDefinition name field`);
      continue;
    }
    names.set(match[1], rel(file));
  }
  return names;
}

function extractToolsetNameUnion() {
  const typesPath = join(SRC, "registry", "types.ts");
  const content = read(typesPath);
  const block = content.match(/export type ToolsetName\s*=[\s\S]*?;/);
  if (!block) {
    addError("src/registry/types.ts — could not parse ToolsetName union");
    return new Set();
  }
  const names = new Set();
  for (const m of block[0].matchAll(/"([^"]+)"/g)) {
    names.add(m[1]);
  }
  return names;
}

function checkToolsetRegistrySync() {
  const toolsetNames = extractToolsetNamesFromFiles();
  const unionNames = extractToolsetNameUnion();

  for (const [name, file] of toolsetNames) {
    if (!unionNames.has(name)) {
      addError(
        `${file} — toolset name "${name}" missing from ToolsetName union in src/registry/types.ts`,
      );
    }
  }

  for (const name of unionNames) {
    if (!toolsetNames.has(name)) {
      addWarning(`ToolsetName "${name}" in types.ts has no matching toolset file export`);
    }
  }

  const indexContent = read(join(SRC, "registry", "index.ts"));
  for (const [name] of toolsetNames) {
    const camel = name.replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase());
    const exportName = `${camel}Toolset`;
    if (!indexContent.includes(exportName)) {
      addError(`Toolset "${name}" — ${exportName} not found in ALL_TOOLSETS (src/registry/index.ts)`);
    }
  }
}

function main() {
  checkNoConsoleLog();
  checkRegisterToolLocations();
  checkToolsDirectory();
  checkFetchAllowlist();
  checkHarnessClientSingleton();
  checkToolsetForbiddenImports();
  checkToolsetRegistrySync();

  if (warnings.length > 0) {
    console.warn("Standards warnings:");
    for (const w of warnings) console.warn(`  [warn] ${w}`);
  }

  if (errors.length > 0) {
    console.error("Standards check failed:");
    for (const e of errors) console.error(`  [error] ${e}`);
    process.exit(1);
  }

  console.log(
    `Standards check passed (${ALLOWED_TOOL_HANDLERS.size} consolidated tool handlers, ` +
      `${extractToolsetNamesFromFiles().size} toolsets).`,
  );
}

main();
