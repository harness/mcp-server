/**
 * Automated enforcement of docs/coding-standards.md architecture rules.
 *
 * These tests guard the registry-driven MCP model: fixed tool handlers,
 * pure-data toolsets, singleton HTTP client, and stderr-only logging.
 *
 * Run the full guardrail suite with `pnpm standards:check`, which also
 * includes registry-contract, registry-metadata, and structural-validation tests.
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

/** Legacy inline responseExtractor arrow functions — new ones must live in extractors.ts. */
const ALLOWED_INLINE_EXTRACTOR_COUNTS: Record<string, number> = {
  "src/registry/toolsets/ansible.ts": 4,
  "src/registry/toolsets/chaos.ts": 2,
  "src/registry/toolsets/ccm.ts": 1,
  "src/registry/toolsets/governance.ts": 1,
  "src/registry/toolsets/iacm.ts": 1,
  "src/registry/toolsets/idp.ts": 1,
  "src/registry/toolsets/knowledge-graph.ts": 1,
  "src/registry/toolsets/sto.ts": 3,
};

const WRITE_TOOL_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

/** Forbidden import patterns in toolset definition files. */
const FORBIDDEN_TOOLSET_IMPORTS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /from\s+["'][^"']*harness-client/, reason: "HarnessClient import" },
  { pattern: /from\s+["']@modelcontextprotocol\/sdk/, reason: "McpServer/MCP SDK import" },
  { pattern: /from\s+["'][^"']*\/registry\/index/, reason: "Registry import" },
];

/** Files allowed to call the global fetch() API (documented exceptions). */
const ALLOWED_GLOBAL_FETCH_FILES = new Set([
  "src/client/harness-client.ts",
  "src/utils/log-resolver.ts",
  "src/audit/sinks/webhook.ts",
]);

/** Only this file may instantiate HarnessClient in production src/. */
const ALLOWED_HARNESS_CLIENT_FILES = new Set(["src/index.ts"]);

/** Files that must import Zod via the v4 subpath — computed after walkTsFiles is defined. */
function zodV4RequiredFiles(): string[] {
  return [join(SRC, "config.ts"), ...walkTsFiles(join(SRC, "tools"))];
}

/** Global fetch API calls — not method names like `async fetch(` or interface `fetch(...)`. */
const GLOBAL_FETCH_PATTERN = /\bawait fetch\s*\(|\breturn fetch\s*\(|[^.\w]fetch\s*\(\s*["'`]|^fetch\s*\(/m;

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

function countInlineResponseExtractors(content: string): number {
  const matches = content.match(/responseExtractor:\s*\(/g);
  return matches?.length ?? 0;
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

  it("toolset files do not use console.* (use createLogger in handlers, not toolsets)", () => {
    const violations: string[] = [];
    const toolsetDir = join(SRC, "registry/toolsets");

    for (const file of walkTsFiles(toolsetDir)) {
      const fileRel = rel(file);
      if (TOOLSET_HELPER_FILES.has(fileRel)) continue;

      const content = readFileSync(file, "utf8");
      if (/\bconsole\.(log|error|warn|info|debug)\s*\(/.test(content)) {
        violations.push(fileRel);
      }
    }

    expect(violations, `console.* found in toolsets:\n${violations.join("\n")}`).toEqual([]);
  });

  it("does not use raw fetch() in tool handlers or toolset definitions", () => {
    const violations: string[] = [];
    const scanDirs = [join(SRC, "tools"), join(SRC, "registry/toolsets")];

    for (const dir of scanDirs) {
      for (const file of walkTsFiles(dir)) {
        const content = readFileSync(file, "utf8");
        if (GLOBAL_FETCH_PATTERN.test(content)) {
          violations.push(rel(file));
        }
      }
    }

    expect(violations, `raw fetch() found in:\n${violations.join("\n")}`).toEqual([]);
  });

  it("only uses global fetch() in documented exception files", () => {
    const violations: string[] = [];
    const srcFiles = walkTsFiles(SRC);

    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      if (!GLOBAL_FETCH_PATTERN.test(content)) continue;

      const fileRel = rel(file);
      if (!ALLOWED_GLOBAL_FETCH_FILES.has(fileRel)) {
        violations.push(fileRel);
      }
    }

    expect(
      violations,
      `Unexpected global fetch() usage (allowed: ${[...ALLOWED_GLOBAL_FETCH_FILES].join(", ")}):\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("instantiates HarnessClient only in src/index.ts", () => {
    const violations: string[] = [];
    const srcFiles = walkTsFiles(SRC);

    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      if (!/new\s+HarnessClient\s*\(/.test(content)) continue;

      const fileRel = rel(file);
      if (!ALLOWED_HARNESS_CLIENT_FILES.has(fileRel)) {
        violations.push(fileRel);
      }
    }

    expect(
      violations,
      `HarnessClient must only be constructed in src/index.ts:\n${violations.join("\n")}`,
    ).toEqual([]);
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

  it("does not add new inline responseExtractor functions in toolsets", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(toolsetDir)) {
      const fileRel = rel(file);
      if (TOOLSET_HELPER_FILES.has(fileRel)) continue;

      const count = countInlineResponseExtractors(readFileSync(file, "utf8"));
      if (count === 0) continue;

      const allowed = ALLOWED_INLINE_EXTRACTOR_COUNTS[fileRel];
      if (allowed === undefined) {
        violations.push(`${fileRel}: ${count} inline responseExtractor(s) — move to extractors.ts`);
      } else if (count > allowed) {
        violations.push(`${fileRel}: expected at most ${allowed} inline responseExtractor(s), found ${count}`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

describe("Coding standards — Zod input schemas", () => {
  const handlerFiles = [...ALLOWED_REGISTER_TOOL_FILES];

  it("tool handlers use .describe() after .optional() / .default() (Zod 4 chaining)", () => {
    const violations: string[] = [];
    // Zod 4 drops descriptions when .describe() precedes .optional() or .default() on the same chain.
    const badChainOnLine = /\.describe\([^)]*\)\s*\.(optional|default)\s*\(/;

    for (const file of handlerFiles) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      const badLines = content
        .split("\n")
        .filter((line) => badChainOnLine.test(line))
        .map((line) => line.trim());
      if (badLines.length > 0) {
        violations.push(`${file}: ${badLines.join(" | ")}`);
      }
    }

    expect(
      violations,
      `Zod describe-before-optional/default chains (descriptions stripped from MCP schema):\n${violations.join("\n")}`,
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

describe("Coding standards — tool handler contracts", () => {
  it("write tool handlers declare confirm param and use elicitation", () => {
    const violations: string[] = [];

    for (const file of WRITE_TOOL_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!/confirm:\s*z\.boolean\(/.test(content)) {
        violations.push(`${file}: missing confirm z.boolean() input param`);
      }
      if (!content.includes("confirmViaElicitation")) {
        violations.push(`${file}: missing confirmViaElicitation()`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("dispatch tool handlers use toMcpError and errorResult for failures", () => {
    const dispatchTools = [...ALLOWED_REGISTER_TOOL_FILES].filter(
      (f) => f !== "src/tools/harness-describe.ts" && f !== "src/tools/harness-schema.ts",
    );
    const violations: string[] = [];

    for (const file of dispatchTools) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("toMcpError")) {
        violations.push(`${file}: missing toMcpError()`);
      }
      if (!content.includes("errorResult")) {
        violations.push(`${file}: missing errorResult()`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

describe("Coding standards — Zod and tool annotations", () => {
  it("tool handlers and config import Zod from zod/v4 (not bare zod)", () => {
    const violations: string[] = [];
    const bareZodImport = /from\s+["']zod["']/;

    for (const file of zodV4RequiredFiles()) {
      const content = readFileSync(file, "utf8");
      if (!content.includes("from \"zod") && !content.includes("from 'zod")) continue;

      if (bareZodImport.test(content)) {
        violations.push(`${rel(file)}: use import * as z from "zod/v4"`);
      } else if (!/from\s+["']zod\/v4["']/.test(content)) {
        violations.push(`${rel(file)}: missing zod/v4 import`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not use deprecated server.tool() — only registerTool()", () => {
    const violations: string[] = [];
    const srcFiles = walkTsFiles(SRC);

    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      if (/\bserver\.tool\s*\(/.test(content)) {
        violations.push(rel(file));
      }
    }

    expect(violations, `server.tool() found in:\n${violations.join("\n")}`).toEqual([]);
  });

  it("every harness handler explicitly sets openWorldHint in annotations", () => {
    const violations: string[] = [];

    for (const file of ALLOWED_REGISTER_TOOL_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!/openWorldHint\s*:/.test(content)) {
        violations.push(`${file}: missing openWorldHint in annotations`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
