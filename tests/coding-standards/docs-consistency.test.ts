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
const README_PATH = join(REPO_ROOT, "README.md");
const AGENTS_PATH = join(REPO_ROOT, "AGENTS.md");

const OUTDATED_TEN_TOOLS = /10 consolidated tool handlers?/i;
const OUTDATED_ZOD_V3_ROW = /\|\s*Schema validation\s*\|\s*Zod v3\s*\|/;

function assertElevenConsolidatedToolsDoc(content: string, label: string): void {
  expect(content, `${label}: missing 11-tool count`).toMatch(
    new RegExp(`${CONSOLIDATED_MCP_TOOL_COUNT} consolidated tool`),
  );
  expect(content, `${label}: outdated 10-tool wording`).not.toMatch(OUTDATED_TEN_TOOLS);
  for (const tool of CONSOLIDATED_MCP_TOOLS) {
    expect(content, `${label}: missing ${tool}`).toContain(tool);
  }
}

describe("Coding standards — documentation consistency", () => {
  const standardsContent = readFileSync(STANDARDS_PATH, "utf8");

  it("docs/coding-standards.md documents 11 consolidated MCP tools including harness_schema", () => {
    assertElevenConsolidatedToolsDoc(standardsContent, "docs/coding-standards.md");
    expect(standardsContent).toMatch(/11 consolidated tool handlers/);
  });

  it("docs/coding-standards.md references Zod v4 (not v3)", () => {
    expect(standardsContent).toMatch(/Zod v4/);
    expect(standardsContent).not.toMatch(OUTDATED_ZOD_V3_ROW);
  });

  it("docs/coding-standards.md documents pnpm standards:check guardrails", () => {
    expect(standardsContent).toContain("pnpm standards:check");
  });

  it("docs/coding-standards.md forbids new harness-*.ts handler files", () => {
    expect(standardsContent).toMatch(/Do NOT add new `harness-\*\.ts` handler files/);
  });

  it("README.md documents 11 consolidated tools (no outdated 10-tool snapshot)", () => {
    const readme = readFileSync(README_PATH, "utf8");
    assertElevenConsolidatedToolsDoc(readme, "README.md");
  });

  it("AGENTS.md documents 11 consolidated tools and Zod v4", () => {
    const agents = readFileSync(AGENTS_PATH, "utf8");
    assertElevenConsolidatedToolsDoc(agents, "AGENTS.md");
    expect(agents).toMatch(/Zod v4/);
    expect(agents).not.toMatch(OUTDATED_ZOD_V3_ROW);
  });
});
