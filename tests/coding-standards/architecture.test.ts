/**
 * Automated enforcement of docs/coding-standards.md architecture rules.
 *
 * These tests guard the registry-driven MCP model: fixed tool handlers,
 * pure-data toolsets, singleton HTTP client, and stderr-only logging.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ALL_TOOLSET_NAMES, Registry } from "../../src/registry/index.js";
import type { ToolsetName } from "../../src/registry/types.js";
import type { Config } from "../../src/config.js";

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

describe("Coding standards — Zod input schemas", () => {
  /** Zod 4 creates new schema instances per method — .describe() must be last. */
  const DESCRIBE_BEFORE_MODIFIER = /\.describe\([^)]*\)\s*\.(optional|default|min|max)\(/;

  it("harness tool handlers place .describe() after .optional()/.default()", () => {
    const violations: string[] = [];

    for (const file of ALLOWED_REGISTER_TOOL_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (DESCRIBE_BEFORE_MODIFIER.test(content)) {
        violations.push(file);
      }
    }

    expect(
      violations,
      `.describe() must be the last Zod chain call (before optional/default). Fix:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

describe("Coding standards — HTTP client singleton", () => {
  it("instantiates HarnessClient only in src/index.ts", () => {
    const violations: string[] = [];
    const srcFiles = walkTsFiles(SRC);

    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      if (!content.includes("new HarnessClient(")) continue;

      const fileRel = rel(file);
      if (fileRel !== "src/index.ts") {
        violations.push(fileRel);
      }
    }

    expect(
      violations,
      `HarnessClient must be a singleton — only src/index.ts may construct it:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

describe("Coding standards — resource metadata", () => {
  const testConfig = {
    HARNESS_API_KEY: "pat.testacct.testid.testsecret",
    HARNESS_ACCOUNT_ID: "testacct",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "error",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
  } as Config;

  /**
   * Singleton/dashboard GET resources that use filter params instead of resource_id.
   * New entries require a comment in the PR — prefer real identifierFields when possible.
   */
  const ALLOWED_EMPTY_IDENTIFIER_GET_RESOURCES = new Set([
    "cost_account_overview",
    "cost_anomaly_summary",
    "cost_recommendation_stats",
    "eval_analytics",
    "eval_git_settings",
    "gitops_dashboard",
    "global_freeze",
    "kg_grammar",
    "scs_auto_pr_config",
    "scs_oss_risk_summary",
    "scs_project_security_overview",
    "sei_ai_adoption",
    "sei_ai_impact",
    "sei_ai_usage",
    "sei_dora_metric",
    "sei_productivity_metric",
  ]);

  it("resources with a get operation declare identifierFields (or are allowlisted singletons)", () => {
    const registry = new Registry(testConfig);
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      if (!def.operations.get) continue;
      if (def.identifierFields.length === 0 && !ALLOWED_EMPTY_IDENTIFIER_GET_RESOURCES.has(resourceType)) {
        violations.push(`${resourceType} (${def.toolset})`);
      }
    }

    expect(
      violations,
      `get-capable resources must declare identifierFields for harness_get dispatch (or be added to the allowlist with justification):\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("every resource declares scope and identifierFields", () => {
    const registry = new Registry(testConfig);
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      if (!def.scope) {
        violations.push(`${resourceType}: missing scope`);
      }
      if (!Array.isArray(def.identifierFields)) {
        violations.push(`${resourceType}: missing identifierFields array`);
      }
    }

    expect(violations, `Resource metadata violations:\n${violations.join("\n")}`).toEqual([]);
  });
});
