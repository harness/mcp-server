/**
 * consolidated-tools.ts is the single source of truth for contributor docs;
 * this test keeps it aligned with the handlers that actually call registerTool().
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSOLIDATED_MCP_TOOLS } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOOLS_DIR = join(REPO_ROOT, "src/tools");

function extractRegisterToolNames(content: string): string[] {
  const names: string[] = [];
  const re = /registerTool\s*\(\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    names.push(match[1]!);
  }
  return names;
}

describe("consolidated-tools — handler alignment", () => {
  it("lists exactly the tool names registered by harness-*.ts handlers", () => {
    const registered = new Set<string>();

    for (const file of readdirSync(TOOLS_DIR)) {
      if (!file.startsWith("harness-") || !file.endsWith(".ts")) continue;
      const content = readFileSync(join(TOOLS_DIR, file), "utf8");
      for (const name of extractRegisterToolNames(content)) {
        registered.add(name);
      }
    }

    expect([...registered].sort()).toEqual([...CONSOLIDATED_MCP_TOOLS].sort());
  });
});
