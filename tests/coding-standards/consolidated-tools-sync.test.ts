/**
 * consolidated-tools.ts is the shared constant module for standards tests.
 * These checks derive the live tool surface from src/ independently so the
 * constants cannot drift from production without failing CI.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  ALLOWED_MCP_TOOLS,
  API_DISPATCH_HANDLER_PATHS,
  HANDLER_PATHS,
  LOCAL_ONLY_HANDLER_PATHS,
  REGISTER_TOOL_SUFFIXES,
  WRITE_HANDLER_PATHS,
} from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOOLS_DIR = join(REPO_ROOT, "src/tools");
const INDEX_PATH = join(TOOLS_DIR, "index.ts");
const EXPECTED_TOOL_COUNT = 11;

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

function harnessHandlerPathForTool(tool: string): string {
  const slug = tool.slice("harness_".length).replace(/_/g, "-");
  return `src/tools/harness-${slug}.ts`;
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

function discoverHarnessHandlerFiles(): string[] {
  return readdirSync(TOOLS_DIR)
    .filter((f) => f.startsWith("harness-") && f.endsWith(".ts"))
    .map((f) => `src/tools/${f}`)
    .sort();
}

function discoverRegisteredToolNames(): string[] {
  const names = new Set<string>();
  for (const file of discoverHarnessHandlerFiles()) {
    const content = readFileSync(join(REPO_ROOT, file), "utf8");
    for (const name of extractRegisterToolNames(content)) {
      names.add(name);
    }
  }
  return [...names].sort();
}

describe("Coding standards — consolidated-tools.ts sync with src/", () => {
  it("ALLOWED_MCP_TOOLS matches registerTool() names in src/tools/harness-*.ts", () => {
    const fromSrc = discoverRegisteredToolNames();
    expect([...ALLOWED_MCP_TOOLS].sort()).toEqual(fromSrc);
    expect(ALLOWED_MCP_TOOLS).toHaveLength(EXPECTED_TOOL_COUNT);
  });

  it("HANDLER_PATHS maps every consolidated tool to an existing handler file", () => {
    expect(HANDLER_PATHS).toHaveLength(EXPECTED_TOOL_COUNT);
    for (const tool of ALLOWED_MCP_TOOLS) {
      const path = harnessHandlerPathForTool(tool);
      expect(HANDLER_PATHS, `missing handler mapping for ${tool}`).toContain(path);
      expect(existsSync(join(REPO_ROOT, path)), `missing handler file ${path}`).toBe(true);
    }
    expect([...HANDLER_PATHS].sort()).toEqual(discoverHarnessHandlerFiles());
  });

  it("REGISTER_TOOL_SUFFIXES matches register*Tool() calls in src/tools/index.ts", () => {
    const content = readFileSync(INDEX_PATH, "utf8");
    const registerCalls = [...content.matchAll(/\bregister(\w+)Tool\s*\(/g)].map((m) => m[1]!);
    expect([...registerCalls].sort()).toEqual([...REGISTER_TOOL_SUFFIXES].sort());
    expect(registerCalls).toHaveLength(EXPECTED_TOOL_COUNT);
  });

  it("API_DISPATCH_HANDLER_PATHS and LOCAL_ONLY_HANDLER_PATHS partition HANDLER_PATHS without overlap", () => {
    const api = new Set(API_DISPATCH_HANDLER_PATHS);
    const local = new Set(LOCAL_ONLY_HANDLER_PATHS);
    for (const file of HANDLER_PATHS) {
      expect(api.has(file) !== local.has(file), `${rel(join(REPO_ROOT, file))} must be API or local-only`).toBe(
        true,
      );
    }
    expect(api.size + local.size).toBe(HANDLER_PATHS.length);
    for (const file of API_DISPATCH_HANDLER_PATHS) {
      expect(HANDLER_PATHS).toContain(file);
    }
    for (const file of LOCAL_ONLY_HANDLER_PATHS) {
      expect(HANDLER_PATHS).toContain(file);
    }
  });

  it("WRITE_HANDLER_PATHS are harness handlers that register write-risk tools only", () => {
    const writeToolNames = new Set<string>();
    for (const file of WRITE_HANDLER_PATHS) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      for (const name of extractRegisterToolNames(content)) {
        writeToolNames.add(name);
      }
    }

    const expectedWrite = new Set([
      "harness_create",
      "harness_update",
      "harness_delete",
      "harness_execute",
    ]);
    expect(writeToolNames).toEqual(expectedWrite);

    for (const file of WRITE_HANDLER_PATHS) {
      expect(discoverHarnessHandlerFiles(), `${rel(join(REPO_ROOT, file))} must be a harness handler`).toContain(
        file,
      );
    }
  });

  it("every consolidated tool name uses the harness_ prefix and snake_case", () => {
    for (const tool of ALLOWED_MCP_TOOLS) {
      expect(tool).toMatch(/^harness_[a-z][a-z0-9_]*$/);
    }
  });
});
