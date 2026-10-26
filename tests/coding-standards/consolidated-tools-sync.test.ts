/**
 * Keeps consolidated-tools.ts aligned with on-disk harness handler modules.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSOLIDATED_MCP_TOOLS } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

function handlerPathForTool(toolName: string): string {
  const slug = toolName.replace(/^harness_/, "").replace(/_/g, "-");
  return join(REPO_ROOT, "src/tools", `harness-${slug}.ts`);
}

describe("Coding standards — consolidated tools sync", () => {
  it("maps every consolidated MCP tool to a harness handler file", () => {
    const missing: string[] = [];
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      const path = handlerPathForTool(tool);
      if (!existsSync(path)) {
        missing.push(`${tool} -> ${path}`);
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });
});
