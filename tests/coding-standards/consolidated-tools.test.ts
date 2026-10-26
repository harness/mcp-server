/**
 * consolidated-tools.ts is the doc/architecture source of truth for tool names;
 * keep it aligned with handler registerTool() names.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSOLIDATED_MCP_TOOLS } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

function extractRegisterToolNames(source: string): string[] {
  const names: string[] = [];
  const re = /registerTool\s*\(\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(re)) {
    names.push(match[1]!);
  }
  return names;
}

describe("consolidated-tools fixture", () => {
  it("lists the same tool names registered in harness handler files", () => {
    const toolsDir = join(REPO_ROOT, "src/tools");
    const handlerFiles = [
      "harness-list.ts",
      "harness-get.ts",
      "harness-create.ts",
      "harness-update.ts",
      "harness-delete.ts",
      "harness-execute.ts",
      "harness-diagnose.ts",
      "harness-search.ts",
      "harness-describe.ts",
      "harness-status.ts",
      "harness-schema.ts",
    ];

    const registered = handlerFiles.flatMap((file) =>
      extractRegisterToolNames(readFileSync(join(toolsDir, file), "utf8")),
    );

    expect([...registered].sort()).toEqual([...CONSOLIDATED_MCP_TOOLS].sort());
    expect(CONSOLIDATED_MCP_TOOLS).toHaveLength(11);
  });
});
