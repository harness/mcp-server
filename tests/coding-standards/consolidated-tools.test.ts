import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONSOLIDATED_MCP_TOOLS,
  HARNESS_HANDLER_BASENAMES,
  HARNESS_HANDLER_PATHS,
  LOCAL_ONLY_HANDLER_PATHS,
  WRITE_HANDLER_PATHS,
} from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("consolidated-tools constants", () => {
  it("lists exactly 11 MCP tools with on-disk handler modules", () => {
    expect(CONSOLIDATED_MCP_TOOLS).toHaveLength(11);
    expect(HARNESS_HANDLER_PATHS).toHaveLength(11);
    for (const handlerPath of HARNESS_HANDLER_PATHS) {
      expect(existsSync(join(REPO_ROOT, handlerPath))).toBe(true);
      const basename = handlerPath.replace("src/tools/", "");
      expect(HARNESS_HANDLER_BASENAMES.has(basename)).toBe(true);
    }
  });

  it("maps each harness_<operation> tool to harness-<operation>.ts", () => {
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      const suffix = tool.replace(/^harness_/, "");
      expect(HARNESS_HANDLER_PATHS).toContain(`src/tools/harness-${suffix}.ts`);
    }
  });

  it("keeps write and local-only handler sets disjoint from API handlers", () => {
    for (const path of WRITE_HANDLER_PATHS) {
      expect(HARNESS_HANDLER_PATHS).toContain(path);
    }
    for (const path of LOCAL_ONLY_HANDLER_PATHS) {
      expect(HARNESS_HANDLER_PATHS).toContain(path);
      expect(WRITE_HANDLER_PATHS).not.toContain(path);
    }
  });
});
