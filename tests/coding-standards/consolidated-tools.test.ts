/**
 * Keeps tests/coding-standards/consolidated-tools.ts aligned with src/tools/index.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOLS } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const INDEX_PATH = join(REPO_ROOT, "src/tools/index.ts");

function registerSuffixToToolName(suffix: string): string {
  const snake = suffix.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  return `harness_${snake}`;
}

describe("Coding standards — consolidated tools list", () => {
  it("matches register*Tool wiring in src/tools/index.ts", () => {
    const content = readFileSync(INDEX_PATH, "utf8");
    const registerCalls = [...content.matchAll(/\bregister(\w+)Tool\s*\(/g)].map((m) => m[1]!);
    const fromIndex = registerCalls.map(registerSuffixToToolName).sort();

    expect([...CONSOLIDATED_MCP_TOOLS].sort()).toEqual(fromIndex);
    expect(new Set(CONSOLIDATED_MCP_TOOLS).size).toBe(CONSOLIDATED_MCP_TOOLS.length);
  });
});
