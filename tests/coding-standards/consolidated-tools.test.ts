/**
 * Guardrails for tests/coding-standards/consolidated-tools.ts — the single source of
 * truth for the fixed 11-tool MCP surface. Catches renames or drift before architecture
 * scans fail with opaque messages.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALLOWED_REGISTER_TOOL_FILES,
  ALLOWED_TOOLS_ROOT_FILES,
  CONSOLIDATED_MCP_TOOLS,
  CONSOLIDATED_TOOL_COUNT,
  HANDLER_FILES,
  REGISTER_TOOL_SUFFIXES,
  WRITE_HANDLER_FILES,
  harnessHandlerPath,
} from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("consolidated-tools — SSOT integrity", () => {
  it("fixes the MCP surface at eleven registry-dispatched tools", () => {
    expect(CONSOLIDATED_TOOL_COUNT).toBe(11);
    expect(CONSOLIDATED_MCP_TOOLS).toHaveLength(CONSOLIDATED_TOOL_COUNT);
    expect(new Set(CONSOLIDATED_MCP_TOOLS).size).toBe(CONSOLIDATED_TOOL_COUNT);
  });

  it("maps each tool name to an on-disk harness handler file", () => {
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      const path = join(REPO_ROOT, harnessHandlerPath(tool));
      expect(existsSync(path), `missing handler for ${tool}: ${harnessHandlerPath(tool)}`).toBe(true);
    }
    expect(ALLOWED_REGISTER_TOOL_FILES).toEqual(
      CONSOLIDATED_MCP_TOOLS.map((tool) => harnessHandlerPath(tool)),
    );
  });

  it("pairs register* suffixes with harness_* tool names in index order", () => {
    expect(REGISTER_TOOL_SUFFIXES).toHaveLength(CONSOLIDATED_TOOL_COUNT);
    for (let index = 0; index < CONSOLIDATED_MCP_TOOLS.length; index += 1) {
      const tool = CONSOLIDATED_MCP_TOOLS[index]!;
      const suffix = REGISTER_TOOL_SUFFIXES[index]!;
      expect(tool).toBe(`harness_${suffix.toLowerCase()}`);
    }
  });

  it("registers the expected MCP tool name from each handler file", () => {
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      const content = readFileSync(join(REPO_ROOT, harnessHandlerPath(tool)), "utf8");
      expect(
        content,
        `${harnessHandlerPath(tool)} must call registerTool("${tool}")`,
      ).toMatch(new RegExp(`registerTool\\s*\\(\\s*["']${tool}["']`));
    }
  });

  it("limits write/elicitation handlers to create, update, delete, and execute", () => {
    expect(WRITE_HANDLER_FILES).toHaveLength(4);
    for (const file of WRITE_HANDLER_FILES) {
      expect(HANDLER_FILES).toContain(file);
      expect(existsSync(join(REPO_ROOT, file))).toBe(true);
    }
  });

  it("lists only shared helpers alongside harness handlers in src/tools/", () => {
    const harnessBasenames = ALLOWED_REGISTER_TOOL_FILES.map((p) => p.replace("src/tools/", ""));
    for (const base of harnessBasenames) {
      expect(ALLOWED_TOOLS_ROOT_FILES.has(base), `ALLOWED_TOOLS_ROOT_FILES missing ${base}`).toBe(
        true,
      );
    }
    expect(ALLOWED_TOOLS_ROOT_FILES.has("index.ts")).toBe(true);
    expect(ALLOWED_TOOLS_ROOT_FILES.has("field-copy.ts")).toBe(true);
    expect(ALLOWED_TOOLS_ROOT_FILES.has("input-schemas.ts")).toBe(true);
    expect(ALLOWED_TOOLS_ROOT_FILES.has("output-schemas.ts")).toBe(true);
  });

  it("imports handler modules from src/tools/index.ts in consolidated-tool order", () => {
    const indexContent = readFileSync(join(REPO_ROOT, "src/tools/index.ts"), "utf8");
    const importOrder: string[] = [];
    const importRe = /from\s+["']\.\/(harness-[^"']+)["']/g;
    for (const match of indexContent.matchAll(importRe)) {
      const modulePath = match[1]!.replace(/\.js$/, "");
      importOrder.push(`src/tools/${modulePath}.ts`);
    }
    expect(importOrder).toEqual([...ALLOWED_REGISTER_TOOL_FILES]);
  });
});
