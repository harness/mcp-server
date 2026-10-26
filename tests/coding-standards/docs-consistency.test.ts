/**
 * Keep docs/coding-standards.md aligned with enforced architecture constants.
 * Prevents drift (e.g. reverting to "10 tools" or Zod v3) without updating tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOLS, CONSOLIDATED_MCP_TOOL_COUNT } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");
const AGENTS_PATH = join(REPO_ROOT, "AGENTS.md");

describe("Coding standards — documentation consistency", () => {
  const content = readFileSync(STANDARDS_PATH, "utf8");

  it("docs/coding-standards.md documents 11 consolidated MCP tools including harness_schema", () => {
    expect(CONSOLIDATED_MCP_TOOL_COUNT).toBe(11);
    expect(content).toMatch(/11 consolidated tool handlers/);
    expect(content).not.toMatch(/10 consolidated tool handlers/);
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      expect(content, `missing ${tool} in docs/coding-standards.md`).toContain(tool);
    }
  });

  it("docs/coding-standards.md references Zod v4 (not v3)", () => {
    expect(content).toMatch(/Zod v4/);
    expect(content).not.toMatch(/\|\s*Schema validation\s*\|\s*Zod v3\s*\|/);
  });

  it("docs/coding-standards.md documents pnpm standards:check guardrails", () => {
    expect(content).toContain("pnpm standards:check");
  });

  it("docs/coding-standards.md forbids new harness-*.ts handler files", () => {
    expect(content).toMatch(/Do NOT add new `harness-\*\.ts` handler files/);
  });

  it("docs/coding-standards.md uses registerTool (not legacy server.tool)", () => {
    expect(content).toContain("registerTool");
    expect(content).not.toMatch(/Do NOT create new `server\.tool\(\)` calls/);
  });

  it("AGENTS.md references pnpm standards:check", () => {
    const agents = readFileSync(AGENTS_PATH, "utf8");
    expect(agents).toContain("pnpm standards:check");
    expect(agents).toMatch(/11 consolidated tools/);
  });
});
