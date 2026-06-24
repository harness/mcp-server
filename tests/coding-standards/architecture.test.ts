/**
 * Automated enforcement of docs/coding-standards.md architecture rules.
 *
 * These tests guard the registry-driven MCP model: fixed tool handlers,
 * pure-data toolsets, singleton HTTP client, and stderr-only logging.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ALL_TOOLSET_NAMES } from "../../src/registry/index.js";
import type { ToolsetName } from "../../src/registry/types.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const SRC = join(REPO_ROOT, "src");

/** The only MCP tools allowed in the server. */
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

/** Only these files may call server.registerTool(). */
const ALLOWED_REGISTER_TOOL_FILES = new Set([
  "src/tools/harness-list.ts",
  "src/tools/harness-get.ts",
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
  "src/tools/harness-diagnose.ts",
  "src/tools/harness-search.ts",
  "src/tools/harness-describe.ts",
  "src/tools/harness-status.ts",
  "src/tools/harness-schema.ts",
]);

/** Only these harness-*.ts handler files may exist under src/tools/. */
const ALLOWED_HARNESS_HANDLER_FILES = new Set([
  ...ALLOWED_REGISTER_TOOL_FILES,
]);

/** Toolset helper modules — not required to export a ToolsetDefinition. */
const TOOLSET_HELPER_FILES = new Set([
  "src/registry/toolsets/chaos-descriptions.ts",
  "src/registry/toolsets/scopes.ts",
]);

/** Forbidden import patterns in toolset definition files. */
const FORBIDDEN_TOOLSET_IMPORTS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /from\s+["'][^"']*harness-client/, reason: "HarnessClient import" },
  { pattern: /from\s+["']@modelcontextprotocol\/sdk/, reason: "McpServer/MCP SDK import" },
  { pattern: /from\s+["'][^"']*\/registry\/index/, reason: "Registry import" },
];

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

function extractRegisterToolNames(content: string): string[] {
  const names: string[] = [];
  const re = /registerTool\s*\(\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    names.push(match[1]!);
  }
  return names;
}

function extractToolsetNamesFromUnion(): Set<string> {
  const typesPath = join(SRC, "registry/types.ts");
  const content = readFileSync(typesPath, "utf8");
  const unionMatch = content.match(/export type ToolsetName\s*=\s*([\s\S]*?);/);
  if (!unionMatch) {
    throw new Error("Could not parse ToolsetName union in src/registry/types.ts");
  }
  const names = new Set<string>();
  const nameRe = /"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = nameRe.exec(unionMatch[1]!)) !== null) {
    names.add(match[1]!);
  }
  return names;
}

describe("Coding standards — MCP tool handlers", () => {
  it("registers exactly the 11 allowed consolidated MCP tools", () => {
    const registered = new Set<string>();

    for (const file of ALLOWED_REGISTER_TOOL_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      for (const name of extractRegisterToolNames(content)) {
        registered.add(name);
      }
    }

    expect([...registered].sort()).toEqual([...ALLOWED_MCP_TOOLS].sort());
  });

  it("only allows registerTool() in the 11 harness handler files", () => {
    const violations: string[] = [];
    const srcFiles = walkTsFiles(SRC);

    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      if (!content.includes("registerTool")) continue;

      const fileRel = rel(file);
      if (!ALLOWED_REGISTER_TOOL_FILES.has(fileRel)) {
        const tools = extractRegisterToolNames(content);
        violations.push(`${fileRel} calls registerTool for: ${tools.join(", ") || "(dynamic)"}`);
      }
    }

    expect(violations, `Unexpected registerTool() usage:\n${violations.join("\n")}`).toEqual([]);
  });

  it("does not add new harness-*.ts handler files under src/tools/", () => {
    const toolsDir = join(SRC, "tools");
    const harnessFiles = readdirSync(toolsDir)
      .filter((f) => f.startsWith("harness-") && f.endsWith(".ts"))
      .map((f) => `src/tools/${f}`);

    const unexpected = harnessFiles.filter((f) => !ALLOWED_HARNESS_HANDLER_FILES.has(f));
    expect(unexpected, `New harness handler files found: ${unexpected.join(", ")}`).toEqual([]);
  });
});

describe("Coding standards — logging and HTTP", () => {
  it("never uses console.log() in src/ (stdio JSON-RPC safety)", () => {
    const violations: string[] = [];
    const srcFiles = walkTsFiles(SRC);

    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      if (/\bconsole\.log\s*\(/.test(content)) {
        violations.push(rel(file));
      }
    }

    expect(violations, `console.log() found in:\n${violations.join("\n")}`).toEqual([]);
  });

  it("does not use raw fetch() in tool handlers or toolset definitions", () => {
    const violations: string[] = [];
    const scanDirs = [join(SRC, "tools"), join(SRC, "registry/toolsets")];
    // Global fetch API calls — not method names like `async fetch(` or interface `fetch(...)`.
    const globalFetchPattern = /\bawait fetch\s*\(|\breturn fetch\s*\(|[^.\w]fetch\s*\(\s*["'`]|^fetch\s*\(/m;

    for (const dir of scanDirs) {
      for (const file of walkTsFiles(dir)) {
        const content = readFileSync(file, "utf8");
        if (globalFetchPattern.test(content)) {
          violations.push(rel(file));
        }
      }
    }

    expect(violations, `raw fetch() found in:\n${violations.join("\n")}`).toEqual([]);
  });
});

describe("Coding standards — toolset purity", () => {
  const toolsetDir = join(SRC, "registry/toolsets");

  it("toolset files do not import HarnessClient, McpServer, or Registry", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(toolsetDir)) {
      const fileRel = rel(file);
      if (TOOLSET_HELPER_FILES.has(fileRel)) continue;

      const content = readFileSync(file, "utf8");
      for (const { pattern, reason } of FORBIDDEN_TOOLSET_IMPORTS) {
        if (pattern.test(content)) {
          violations.push(`${fileRel}: ${reason}`);
        }
      }
    }

    expect(violations, `Forbidden toolset imports:\n${violations.join("\n")}`).toEqual([]);
  });

  it("each toolset module exports a ToolsetDefinition (except documented helpers)", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(toolsetDir)) {
      const fileRel = rel(file);
      if (TOOLSET_HELPER_FILES.has(fileRel)) continue;

      const content = readFileSync(file, "utf8");
      if (!/export const \w+Toolset:\s*ToolsetDefinition/.test(content)) {
        violations.push(fileRel);
      }
    }

    expect(
      violations,
      `Toolset files missing 'export const <name>Toolset: ToolsetDefinition':\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

describe("Coding standards — registry registration", () => {
  it("ALL_TOOLSET_NAMES matches the ToolsetName union exactly", () => {
    const fromRegistry = new Set(ALL_TOOLSET_NAMES);
    const fromUnion = extractToolsetNamesFromUnion();

    const missingFromUnion = ALL_TOOLSET_NAMES.filter((n) => !fromUnion.has(n));
    const missingFromRegistry = [...fromUnion].filter((n) => !fromRegistry.has(n));

    expect(
      missingFromUnion,
      `Toolsets in ALL_TOOLSETS but missing from ToolsetName union: ${missingFromUnion.join(", ")}`,
    ).toEqual([]);

    expect(
      missingFromRegistry,
      `ToolsetName union entries not in ALL_TOOLSETS: ${missingFromRegistry.join(", ")}`,
    ).toEqual([]);
  });

  it("every ALL_TOOLSET_NAMES entry is assignable to ToolsetName", () => {
    const assign = (name: string): ToolsetName => name as ToolsetName;
    for (const name of ALL_TOOLSET_NAMES) {
      expect(() => assign(name)).not.toThrow();
    }
  });
});

/** Write tool handlers must wire confirmation via elicitation. */
const WRITE_HANDLER_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

/** Local-only tools may return soft errors without toMcpError. */
const ERROR_HANDLING_ALLOWLIST = new Set([
  "src/tools/harness-describe.ts",
]);

describe("Coding standards — HTTP client singleton", () => {
  it("instantiates HarnessClient only in src/index.ts", () => {
    const violations = walkTsFiles(SRC)
      .filter((f) => rel(f) !== "src/index.ts")
      .filter((f) => readFileSync(f, "utf8").includes("new HarnessClient("))
      .map(rel);

    expect(violations, `HarnessClient must be a singleton:\n${violations.join("\n")}`).toEqual([]);
  });
});

describe("Coding standards — write tool safety", () => {
  it("write handlers call confirmViaElicitation before mutating operations", () => {
    const violations: string[] = [];
    for (const file of WRITE_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("confirmViaElicitation(")) {
        violations.push(`${file}: missing confirmViaElicitation()`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});

describe("Coding standards — error handling", () => {
  it("tool handlers import toMcpError (except local-only allowlist)", () => {
    const violations: string[] = [];
    for (const file of ALLOWED_REGISTER_TOOL_FILES) {
      if (ERROR_HANDLING_ALLOWLIST.has(file)) continue;
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("toMcpError")) {
        violations.push(`${file}: missing toMcpError import/usage`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("tool handlers with try/catch use throw toMcpError for unexpected failures", () => {
    const violations: string[] = [];
    for (const file of ALLOWED_REGISTER_TOOL_FILES) {
      if (ERROR_HANDLING_ALLOWLIST.has(file)) continue;
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (content.includes("try {") && !content.includes("throw toMcpError")) {
        violations.push(`${file}: try/catch without throw toMcpError`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
