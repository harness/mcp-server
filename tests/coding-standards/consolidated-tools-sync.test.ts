/**
 * Keep consolidated-tools.ts aligned with src/tools/index.ts and handler filenames.
 * Catches renames or reordering that leave the shared constants out of sync.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import {
  CONSOLIDATED_MCP_TOOLS,
  CONSOLIDATED_TOOL_HANDLER_FILES,
  REGISTER_TOOL_SUFFIXES,
  WRITE_TOOL_FILES,
  type ConsolidatedMcpTool,
} from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOOLS_INDEX = join(REPO_ROOT, "src/tools/index.ts");

function toolNameFromSuffix(suffix: string): ConsolidatedMcpTool {
  return `harness_${suffix.toLowerCase()}` as ConsolidatedMcpTool;
}

function expectedHandlerBasename(tool: ConsolidatedMcpTool): string {
  const stem = tool.replace(/^harness_/, "").replaceAll("_", "-");
  return `harness-${stem}.ts`;
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

describe("Coding standards — consolidated tools sync", () => {
  it("maps each MCP tool to an existing harness-*.ts handler file", () => {
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      const handlerPath = join(REPO_ROOT, CONSOLIDATED_TOOL_HANDLER_FILES[tool]);
      expect(existsSync(handlerPath), `${tool} → missing ${CONSOLIDATED_TOOL_HANDLER_FILES[tool]}`).toBe(
        true,
      );
      expect(basename(handlerPath)).toBe(expectedHandlerBasename(tool));
    }
  });

  it("keeps REGISTER_TOOL_SUFFIXES aligned with CONSOLIDATED_MCP_TOOLS naming", () => {
    expect(REGISTER_TOOL_SUFFIXES.length).toBe(CONSOLIDATED_MCP_TOOLS.length);
    const fromSuffixes = REGISTER_TOOL_SUFFIXES.map(toolNameFromSuffix);
    expect(fromSuffixes).toEqual([...CONSOLIDATED_MCP_TOOLS]);
  });

  it("registerAllTools import order matches REGISTER_TOOL_SUFFIXES", () => {
    const index = readFileSync(TOOLS_INDEX, "utf8");
    const registerCalls = [...index.matchAll(/\bregister(\w+)Tool\s*\(/g)].map((m) => m[1]!);
    expect(registerCalls).toEqual([...REGISTER_TOOL_SUFFIXES]);
  });

  it("each handler file registers exactly its consolidated tool name", () => {
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      const content = readFileSync(join(REPO_ROOT, CONSOLIDATED_TOOL_HANDLER_FILES[tool]), "utf8");
      const registered = extractRegisterToolNames(content);
      expect(registered, `${tool} handler registerTool names`).toEqual([tool]);
    }
  });

  it("WRITE_TOOL_FILES are a subset of consolidated handlers", () => {
    const handlers = new Set(Object.values(CONSOLIDATED_TOOL_HANDLER_FILES));
    for (const file of WRITE_TOOL_FILES) {
      expect(handlers.has(file), `${file} must be a consolidated handler`).toBe(true);
    }
    expect(WRITE_TOOL_FILES).toHaveLength(4);
  });
});
