/**
 * Keep docs/coding-standards.md aligned with enforced architecture constants.
 * Prevents drift (e.g. reverting to "10 tools" or Zod v3) without updating tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

const REQUIRED_TOOLS = [
  "harness_list",
  "harness_get",
  "harness_create",
  "harness_update",
  "harness_delete",
  "harness_execute",
  "harness_diagnose",
  "harness_search",
  "harness_describe",
  "harness_status",
  "harness_schema",
];

function assertElevenConsolidatedTools(docLabel: string, content: string): void {
  expect(content, `${docLabel} should document 11 consolidated tools`).toMatch(/11 consolidated/);
  for (const tool of REQUIRED_TOOLS) {
    expect(content, `missing ${tool} in ${docLabel}`).toContain(tool);
  }
}

describe("Coding standards — documentation consistency", () => {
  const content = readFileSync(STANDARDS_PATH, "utf8");
  const agentsContent = readFileSync(join(REPO_ROOT, "AGENTS.md"), "utf8");
  const contributingContent = readFileSync(join(REPO_ROOT, "CONTRIBUTING.md"), "utf8");

  it("docs/coding-standards.md documents 11 consolidated MCP tools including harness_schema", () => {
    assertElevenConsolidatedTools("docs/coding-standards.md", content);
    expect(content).toMatch(/11 consolidated tool handlers/);
  });

  it("AGENTS.md documents 11 consolidated MCP tools including harness_schema", () => {
    assertElevenConsolidatedTools("AGENTS.md", agentsContent);
  });

  it("docs/coding-standards.md references Zod v4 (not v3)", () => {
    expect(content).toMatch(/Zod v4/);
    expect(content).not.toMatch(/\|\s*Schema validation\s*\|\s*Zod v3\s*\|/);
  });

  it("docs/coding-standards.md documents pnpm standards:check guardrails", () => {
    expect(content).toContain("pnpm standards:check");
  });

  it("CONTRIBUTING.md documents pnpm standards:check guardrails", () => {
    expect(contributingContent).toContain("pnpm standards:check");
  });

  it("docs/coding-standards.md forbids new harness-*.ts handler files", () => {
    expect(content).toMatch(/Do NOT add new `harness-\*\.ts` handler files/);
  });
});
