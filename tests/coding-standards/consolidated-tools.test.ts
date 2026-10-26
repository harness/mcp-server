import { describe, expect, it } from "vitest";
import {
  ALLOWED_REGISTER_TOOL_FILES,
  API_HANDLERS,
  CONSOLIDATED_MCP_TOOLS,
  HARNESS_HANDLER_FILES,
  LOCAL_ONLY_HANDLERS,
  REGISTER_TOOL_FN_NAMES,
  WRITE_TOOL_FILES,
} from "./consolidated-tools.js";

describe("consolidated-tools — structural invariants", () => {
  it("documents exactly 11 MCP tools and register helpers", () => {
    expect(CONSOLIDATED_MCP_TOOLS).toHaveLength(11);
    expect(REGISTER_TOOL_FN_NAMES).toHaveLength(11);
  });

  it("maps each MCP tool name to a harness-*.ts handler file", () => {
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      const slug = tool.replace(/^harness_/, "").replace(/_/g, "-");
      expect(HARNESS_HANDLER_FILES).toContain(`src/tools/harness-${slug}.ts`);
    }
    expect(HARNESS_HANDLER_FILES).toHaveLength(CONSOLIDATED_MCP_TOOLS.length);
  });

  it("partitions handlers into API vs local-only metadata tools", () => {
    const all = new Set(HARNESS_HANDLER_FILES);
    const api = new Set(API_HANDLERS);
    const local = new Set(LOCAL_ONLY_HANDLERS);
    expect(api.size + local.size).toBe(all.size);
    for (const file of API_HANDLERS) {
      expect(all.has(file)).toBe(true);
      expect(local.has(file)).toBe(false);
    }
    for (const file of LOCAL_ONLY_HANDLERS) {
      expect(all.has(file)).toBe(true);
      expect(api.has(file)).toBe(false);
    }
  });

  it("limits write-tool guardrails to the four mutating handlers", () => {
    for (const file of WRITE_TOOL_FILES) {
      expect(HARNESS_HANDLER_FILES).toContain(file);
    }
    expect(WRITE_TOOL_FILES).toHaveLength(4);
  });

  it("allows registerTool only in the documented handler files", () => {
    expect(ALLOWED_REGISTER_TOOL_FILES.size).toBe(HARNESS_HANDLER_FILES.length);
    for (const file of HARNESS_HANDLER_FILES) {
      expect(ALLOWED_REGISTER_TOOL_FILES.has(file)).toBe(true);
    }
  });
});
