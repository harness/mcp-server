/**
 * Keep docs/coding-standards.md and AGENTS.md aligned with enforced architecture constants.
 * Prevents drift (e.g. reverting to "10 tools" or Zod v3) without updating tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALLOWED_MCP_TOOLS } from "./constants.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");
const AGENTS_PATH = join(REPO_ROOT, "AGENTS.md");

function assertElevenToolsDocumented(content: string, label: string): void {
  expect(content, `${label}: must document 11 consolidated tools`).toMatch(/11 consolidated tool/);
  for (const tool of ALLOWED_MCP_TOOLS) {
    expect(content, `${label}: missing ${tool}`).toContain(tool);
  }
}

describe("Coding standards — documentation consistency", () => {
  const standardsContent = readFileSync(STANDARDS_PATH, "utf8");
  const agentsContent = readFileSync(AGENTS_PATH, "utf8");

  it("docs/coding-standards.md documents 11 consolidated MCP tools including harness_schema", () => {
    assertElevenToolsDocumented(standardsContent, "docs/coding-standards.md");
  });

  it("AGENTS.md documents 11 consolidated MCP tools including harness_schema", () => {
    assertElevenToolsDocumented(agentsContent, "AGENTS.md");
  });

  it("docs/coding-standards.md references Zod v4 (not v3)", () => {
    expect(standardsContent).toMatch(/Zod v4/);
    expect(standardsContent).not.toMatch(/\|\s*Schema validation\s*\|\s*Zod v3\s*\|/);
  });

  it("AGENTS.md references Zod v4 (not v3)", () => {
    expect(agentsContent).toMatch(/Zod v4/);
    expect(agentsContent).not.toMatch(/\|\s*Schema validation\s*\|\s*Zod v3\s*\|/);
  });

  it("docs/coding-standards.md documents pnpm standards:check guardrails", () => {
    expect(standardsContent).toContain("pnpm standards:check");
  });

  it("AGENTS.md documents pnpm standards:check guardrails", () => {
    expect(agentsContent).toContain("pnpm standards:check");
  });

  it("docs/coding-standards.md forbids new harness-*.ts handler files", () => {
    expect(standardsContent).toMatch(/Do NOT add new `harness-\*\.ts` handler files/);
  });

  it("AGENTS.md forbids adding per-endpoint tool handlers", () => {
    expect(agentsContent).toMatch(/Do NOT add per-endpoint tool handlers/);
  });

  it("AGENTS.md forbids console.log (stdio JSON-RPC safety)", () => {
    expect(agentsContent).toContain("console.log()");
  });
});
