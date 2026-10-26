/**
 * Ensures tests/coding-standards/consolidated-tools.ts stays aligned with handler modules.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CONSOLIDATED_MCP_TOOLS } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOOLS_DIR = join(REPO_ROOT, "src/tools");

function handlerPathForTool(toolName: string): string {
  const slug = toolName.replace(/^harness_/, "").replace(/_/g, "-");
  return join(TOOLS_DIR, `harness-${slug}.ts`);
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

describe("Coding standards — consolidated MCP tool list", () => {
  it("lists exactly 11 tools with a matching harness-*.ts handler file each", () => {
    expect(CONSOLIDATED_MCP_TOOLS).toHaveLength(11);

    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      const handlerPath = handlerPathForTool(tool);
      expect(existsSync(handlerPath), `missing handler for ${tool}: ${handlerPath}`).toBe(true);
    }
  });

  it("matches registerTool() names exported from each handler file", () => {
    const registered = new Set<string>();

    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      const content = readFileSync(handlerPathForTool(tool), "utf8");
      const names = extractRegisterToolNames(content);
      expect(names, `${tool} handler should register exactly one tool`).toHaveLength(1);
      expect(names[0]).toBe(tool);
      registered.add(names[0]!);
    }

    expect([...registered].sort()).toEqual([...CONSOLIDATED_MCP_TOOLS].sort());
  });

  it("registerAllTools imports every consolidated handler module", () => {
    const indexContent = readFileSync(join(TOOLS_DIR, "index.ts"), "utf8");

    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      const slug = tool.replace(/^harness_/, "").replace(/_/g, "-");
      expect(indexContent).toContain(`./harness-${slug}.js`);
    }

    const registerCalls = [...indexContent.matchAll(/\bregister(\w+)Tool\s*\(/g)].map((m) => m[1]!);
    expect(registerCalls).toHaveLength(CONSOLIDATED_MCP_TOOLS.length);
  });
});
