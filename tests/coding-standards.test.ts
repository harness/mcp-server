/**
 * Automated enforcement of docs/coding-standards.md.
 *
 * These tests scan the repository for architectural anti-patterns.
 * Add a new test here whenever a repeated review finding should be blocked in CI.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const TOOLS_DIR = join(SRC, "tools");
const TOOLSETS_DIR = join(SRC, "registry", "toolsets");

/** The only MCP tools allowed in this server. */
const ALLOWED_MCP_TOOLS = new Set([
  "harness_list",
  "harness_get",
  "harness_create",
  "harness_update",
  "harness_delete",
  "harness_execute",
  "harness_diagnose",
  "harness_search",
  "harness_describe",
  "harness_status",
  "harness_schema",
]);

/** Top-level tool handler files — no new handlers beyond this set. */
const ALLOWED_TOOL_HANDLER_FILES = new Set([
  "harness-list.ts",
  "harness-get.ts",
  "harness-create.ts",
  "harness-update.ts",
  "harness-delete.ts",
  "harness-execute.ts",
  "harness-diagnose.ts",
  "harness-search.ts",
  "harness-describe.ts",
  "harness-status.ts",
  "harness-schema.ts",
]);

/** Companion toolset files that are not primary ToolsetDefinition exports. */
const TOOLSET_COMPANION_FILES = new Set(["chaos-descriptions.ts", "scopes.ts"]);

/** Forbidden import substrings in toolset files. */
const FORBIDDEN_TOOLSET_IMPORTS = [
  "client/harness-client",
  "@modelcontextprotocol/sdk",
  "registry/index",
];

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "build") continue;
      walkTsFiles(full, acc);
    } else if (entry.endsWith(".ts")) {
      acc.push(full);
    }
  }
  return acc;
}

function rel(path: string): string {
  return relative(ROOT, path);
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("coding standards — MCP tool surface", () => {
  it("registers exactly the 11 allowed consolidated tools", () => {
    const indexContent = read(join(TOOLS_DIR, "index.ts"));
    const registered: string[] = [];
    const registerRe = /register(\w+)Tool\(/g;
    let match: RegExpExecArray | null;
    while ((match = registerRe.exec(indexContent)) !== null) {
      registered.push(match[1]!);
    }
    expect(registered).toHaveLength(11);
    expect(new Set(registered).size).toBe(11);
  });

  it("only harness-*.ts top-level files call server.registerTool", () => {
    const violations: string[] = [];
    for (const file of walkTsFiles(SRC)) {
      const content = read(file);
      if (!content.includes("registerTool(")) continue;
      const basename = file.split("/").pop()!;
      const inTools = file.startsWith(TOOLS_DIR + "/");
      const isAllowedHandler = ALLOWED_TOOL_HANDLER_FILES.has(basename);
      if (!inTools || !isAllowedHandler) {
        violations.push(rel(file));
      }
    }
    expect(violations, `registerTool outside allowed handlers:\n${violations.join("\n")}`).toEqual([]);
  });

  it("registers only allowed tool names", () => {
    const violations: string[] = [];
    for (const file of walkTsFiles(TOOLS_DIR)) {
      if (!file.includes("harness-") || !file.endsWith(".ts")) continue;
      const content = read(file);
      const nameRe = /registerTool\(\s*["']([^"']+)["']/g;
      let match: RegExpExecArray | null;
      while ((match = nameRe.exec(content)) !== null) {
        const name = match[1]!;
        if (!ALLOWED_MCP_TOOLS.has(name)) {
          violations.push(`${rel(file)}: ${name}`);
        }
      }
    }
    expect(violations, `Unexpected tool names:\n${violations.join("\n")}`).toEqual([]);
  });

  it("does not add new top-level tool handler files", () => {
    const handlers = readdirSync(TOOLS_DIR)
      .filter((f) => f.startsWith("harness-") && f.endsWith(".ts"));
    const unexpected = handlers.filter((f) => !ALLOWED_TOOL_HANDLER_FILES.has(f));
    expect(unexpected, `New tool handler files: ${unexpected.join(", ")}`).toEqual([]);
  });
});

describe("coding standards — logging and HTTP", () => {
  it("has no console.log in src/", () => {
    const violations: string[] = [];
    for (const file of walkTsFiles(SRC)) {
      const content = read(file);
      if (/\bconsole\.log\s*\(/.test(content)) {
        violations.push(rel(file));
      }
    }
    expect(violations, `console.log in src/:\n${violations.join("\n")}`).toEqual([]);
  });

  it("instantiates HarnessClient only in src/index.ts", () => {
    const violations: string[] = [];
    for (const file of walkTsFiles(SRC)) {
      if (file === join(SRC, "index.ts")) continue;
      if (read(file).includes("new HarnessClient(")) {
        violations.push(rel(file));
      }
    }
    expect(violations, `new HarnessClient outside index.ts:\n${violations.join("\n")}`).toEqual([]);
  });
});

describe("coding standards — toolset purity", () => {
  it("toolset files do not import HarnessClient, McpServer, or Registry", () => {
    const violations: string[] = [];
    for (const file of walkTsFiles(TOOLSETS_DIR)) {
      const base = file.split("/").pop()!;
      if (TOOLSET_COMPANION_FILES.has(base)) continue;
      const content = read(file);
      for (const forbidden of FORBIDDEN_TOOLSET_IMPORTS) {
        if (content.includes(forbidden)) {
          violations.push(`${rel(file)} imports ${forbidden}`);
        }
      }
    }
    expect(violations, `Forbidden toolset imports:\n${violations.join("\n")}`).toEqual([]);
  });

  it("every primary toolset file exports a ToolsetDefinition", () => {
    const missing: string[] = [];
    for (const entry of readdirSync(TOOLSETS_DIR)) {
      if (!entry.endsWith(".ts") || TOOLSET_COMPANION_FILES.has(entry)) continue;
      const content = read(join(TOOLSETS_DIR, entry));
      if (!/export const \w+Toolset:\s*ToolsetDefinition/.test(content)) {
        missing.push(entry);
      }
    }
    expect(missing, `Missing ToolsetDefinition export: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("coding standards — Zod conventions in tool handlers", () => {
  const handlerFiles = [...ALLOWED_TOOL_HANDLER_FILES].map((f) => join(TOOLS_DIR, f));

  it("tool handlers import Zod from zod/v4", () => {
    const violations: string[] = [];
    for (const file of handlerFiles) {
      const content = read(file);
      if (content.includes('from "zod"') && !content.includes('from "zod/v4"')) {
        violations.push(rel(file));
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("coding standards — check-standards.js script", () => {
  it("passes scripts/check-standards.js with no violations", () => {
    const output = execSync("node scripts/check-standards.js", {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(output).toContain("Standards check passed");
  });
});
