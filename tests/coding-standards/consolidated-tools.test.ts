/**
 * Guards the shared consolidated-tool constants against drift from src/tools/.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONSOLIDATED_MCP_TOOLS,
  CONSOLIDATED_TOOL_COUNT,
  HARNESS_HANDLER_FILES,
  REGISTER_TOOL_SUFFIXES,
} from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

function handlerPathToToolName(handlerPath: string): string {
  const slug = handlerPath
    .replace("src/tools/harness-", "")
    .replace(/\.ts$/, "");
  return `harness_${slug.replace(/-/g, "_")}`;
}

describe("consolidated-tools — shared constants", () => {
  it("keeps MCP tool names, handler paths, and register suffixes in lockstep", () => {
    expect(CONSOLIDATED_MCP_TOOLS).toHaveLength(CONSOLIDATED_TOOL_COUNT);
    expect(HARNESS_HANDLER_FILES).toHaveLength(CONSOLIDATED_TOOL_COUNT);
    expect(REGISTER_TOOL_SUFFIXES).toHaveLength(CONSOLIDATED_TOOL_COUNT);

    for (let index = 0; index < CONSOLIDATED_TOOL_COUNT; index += 1) {
      const tool = CONSOLIDATED_MCP_TOOLS[index];
      const handler = HARNESS_HANDLER_FILES[index];
      const suffix = REGISTER_TOOL_SUFFIXES[index];

      expect(handlerPathToToolName(handler)).toBe(tool);
      expect(existsSync(join(REPO_ROOT, handler)), `${tool} handler file must exist`).toBe(true);
      expect(`register${suffix}Tool`).toMatch(/^register[A-Z][a-zA-Z]+Tool$/);
    }
  });

  it("derives unique harness_list-style names from handler filenames", () => {
    const fromHandlers = HARNESS_HANDLER_FILES.map(handlerPathToToolName);
    expect(fromHandlers).toEqual([...CONSOLIDATED_MCP_TOOLS]);
    expect(new Set(fromHandlers).size).toBe(CONSOLIDATED_TOOL_COUNT);
  });
});
