/**
 * Keep contributor-facing docs aligned with enforced architecture constants.
 * Prevents drift (e.g. reverting to "10 tools" or Zod v3) without updating tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOLS, CONSOLIDATED_TOOL_COUNT } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

const DOC_PATHS = {
  standards: join(REPO_ROOT, "docs/coding-standards.md"),
  agents: join(REPO_ROOT, "AGENTS.md"),
  contributing: join(REPO_ROOT, "CONTRIBUTING.md"),
  readme: join(REPO_ROOT, "README.md"),
} as const;

function readDoc(path: string): string {
  return readFileSync(path, "utf8");
}

function assertConsolidatedToolSurface(content: string, label: string): void {
  expect(
    content,
    `${label} must document ${CONSOLIDATED_TOOL_COUNT} consolidated tools`,
  ).toMatch(new RegExp(`${CONSOLIDATED_TOOL_COUNT} consolidated tool`));
  for (const tool of CONSOLIDATED_MCP_TOOLS) {
    expect(content, `${label} missing ${tool}`).toContain(tool);
  }
}

function assertZodV4(content: string, label: string): void {
  expect(content, `${label} must reference Zod v4`).toMatch(/Zod v4/);
  expect(content, `${label} must not lock tech stack to Zod v3`).not.toMatch(
    /\|\s*Schema validation\s*\|\s*Zod v3\s*\|/,
  );
}

describe("Coding standards — documentation consistency", () => {
  it("docs/coding-standards.md documents the consolidated MCP tool surface", () => {
    const content = readDoc(DOC_PATHS.standards);
    assertConsolidatedToolSurface(content, "docs/coding-standards.md");
    assertZodV4(content, "docs/coding-standards.md");
    expect(content).toContain("pnpm standards:check");
    expect(content).toMatch(/Do NOT add new `harness-\*\.ts` handler files/);
    expect(content).toMatch(/registerTool\(\)/);
    expect(content).not.toMatch(/\b10 consolidated tool handlers\b/);
  });

  it("AGENTS.md matches the consolidated tool surface and guardrail command", () => {
    const content = readDoc(DOC_PATHS.agents);
    assertConsolidatedToolSurface(content, "AGENTS.md");
    expect(content).toContain("pnpm standards:check");
    expect(content).toMatch(/Zod v4/);
    expect(content).toContain("docs/coding-standards.md");
  });

  it("CONTRIBUTING.md points contributors at standards:check and coding-standards.md", () => {
    const content = readDoc(DOC_PATHS.contributing);
    expect(content).toContain("pnpm standards:check");
    expect(content).toContain("docs/coding-standards.md");
    assertZodV4(content, "CONTRIBUTING.md");
  });

  it("README.md documents the consolidated MCP tool count", () => {
    const content = readDoc(DOC_PATHS.readme);
    assertConsolidatedToolSurface(content, "README.md");
  });
});
