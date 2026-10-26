/**
 * Invariants for tests/coding-standards/consolidated-tools.ts — the shared pin
 * for handler paths and MCP tool names used across the guardrail suite.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  ALLOWED_MCP_TOOLS,
  HANDLER_BASENAMES,
  HANDLER_PATHS,
  API_DISPATCH_HANDLER_PATHS,
  LOCAL_ONLY_HANDLER_PATHS,
  WRITE_HANDLER_PATHS,
} from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

function handlerPathToToolName(handlerPath: string): string {
  const stem = handlerPath.replace("src/tools/harness-", "").replace(/\.ts$/, "");
  return `harness_${stem.replace(/-/g, "_")}`;
}

describe("consolidated-tools — guardrail constants", () => {
  it("maps each handler file to exactly one allowed MCP tool name", () => {
    const fromHandlers = HANDLER_PATHS.map(handlerPathToToolName).sort();
    expect(fromHandlers).toEqual([...ALLOWED_MCP_TOOLS].sort());
  });

  it("partitions handlers into API dispatch vs local-only tools", () => {
    const dispatch = new Set(API_DISPATCH_HANDLER_PATHS);
    const local = new Set(LOCAL_ONLY_HANDLER_PATHS);
    expect(dispatch.size + local.size).toBe(HANDLER_PATHS.length);

    for (const path of HANDLER_PATHS) {
      expect(dispatch.has(path) !== local.has(path)).toBe(true);
    }
  });

  it("treats write handlers as API dispatch handlers", () => {
    const dispatch = new Set(API_DISPATCH_HANDLER_PATHS);
    for (const path of WRITE_HANDLER_PATHS) {
      expect(dispatch.has(path)).toBe(true);
    }
  });

  it("lists handler basenames that match on-disk src/tools files", () => {
    expect(HANDLER_BASENAMES.map((f) => `src/tools/${f}`)).toEqual([...HANDLER_PATHS]);
    for (const path of HANDLER_PATHS) {
      expect(existsSync(join(REPO_ROOT, path))).toBe(true);
    }
  });
});
