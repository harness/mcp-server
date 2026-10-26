/**
 * Keeps consolidated-tools.ts aligned with src/tools/harness-*.ts handler files.
 * architecture.test.ts enforces registration; this guards the shared manifest list.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSOLIDATED_MCP_TOOLS } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOOLS_DIR = join(REPO_ROOT, "src/tools");

function handlerPathForTool(toolName: string): string {
  const slug = toolName.replace(/^harness_/, "harness-").replaceAll("_", "-");
  return join(TOOLS_DIR, `${slug}.ts`);
}

describe("Coding standards — consolidated tools manifest", () => {
  it("lists exactly one harness handler file per consolidated MCP tool", () => {
    const missing: string[] = [];

    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      const path = handlerPathForTool(tool);
      if (!existsSync(path)) {
        missing.push(`${tool} → ${path}`);
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });
});
