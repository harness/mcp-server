/**
 * consolidated-tools.ts is the shared constant module for standards tests.
 * These checks derive the live tool surface from src/ independently so the
 * constants cannot drift from production without failing CI.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  CONSOLIDATED_MCP_TOOLS,
  CONSOLIDATED_MCP_TOOL_COUNT,
  CONSOLIDATED_TOOL_HANDLER_FILES,
  REGISTER_TOOL_SUFFIXES,
  WRITE_TOOL_FILES,
} from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOOLS_DIR = join(REPO_ROOT, "src/tools");
const INDEX_PATH = join(TOOLS_DIR, "index.ts");

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
  it("CONSOLIDATED_MCP_TOOLS matches registerTool() names in src/tools/harness-*.ts", () => {
    const fromSrc = discoverRegisteredToolNames();
    expect([...CONSOLIDATED_MCP_TOOLS].sort()).toEqual(fromSrc);
    expect(CONSOLIDATED_MCP_TOOLS).toHaveLength(CONSOLIDATED_MCP_TOOL_COUNT);
  });

  it("CONSOLIDATED_TOOL_HANDLER_FILES maps every consolidated tool to an existing handler file", () => {
    const paths = CONSOLIDATED_MCP_TOOLS.map((tool) => CONSOLIDATED_TOOL_HANDLER_FILES[tool]);
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size, "duplicate handler paths for distinct tools").toBe(
      CONSOLIDATED_MCP_TOOL_COUNT,
    );

    for (const path of paths) {
      expect(existsSync(join(REPO_ROOT, path)), `missing handler file ${path}`).toBe(true);
    }

    expect([...paths].sort()).toEqual(discoverHarnessHandlerFiles());
  });

  it("REGISTER_TOOL_SUFFIXES matches register*Tool() calls in src/tools/index.ts", () => {
    const content = readFileSync(INDEX_PATH, "utf8");
    const registerCalls = [...content.matchAll(/\bregister(\w+)Tool\s*\(/g)].map((m) => m[1]!);
    expect([...registerCalls].sort()).toEqual([...REGISTER_TOOL_SUFFIXES].sort());
    expect(registerCalls).toHaveLength(CONSOLIDATED_MCP_TOOL_COUNT);
  });

  it("WRITE_TOOL_FILES are harness handlers that register write-risk tools only", () => {
    const writeToolNames = new Set<string>();
    for (const file of WRITE_TOOL_FILES) {
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

    for (const file of WRITE_TOOL_FILES) {
      expect(discoverHarnessHandlerFiles(), `${rel(join(REPO_ROOT, file))} must be a harness handler`).toContain(
        file,
      );
    }
  });

  it("every consolidated tool name uses the harness_ prefix and snake_case", () => {
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      expect(tool).toMatch(/^harness_[a-z][a-z0-9_]*$/);
    }
  });
});
