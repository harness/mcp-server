/**
 * Keep docs/coding-standards.md aligned with enforced architecture constants.
 * Prevents drift (e.g. reverting to "10 tools" or Zod v3) without updating tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONSOLIDATED_MCP_TOOL_COUNT,
  CONSOLIDATED_MCP_TOOLS,
} from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

function readRepoFile(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}

describe("Coding standards — documentation consistency", () => {
  const content = readRepoFile("docs/coding-standards.md");

  it("docs/coding-standards.md documents 11 consolidated MCP tools including harness_schema", () => {
    expect(content).toMatch(
      new RegExp(`${CONSOLIDATED_MCP_TOOL_COUNT} consolidated tool handlers`),
    );
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

  it("contributor docs point to coding standards and standards:check", () => {
    const contributing = readRepoFile("CONTRIBUTING.md");
    const agents = readRepoFile("AGENTS.md");
    const readme = readRepoFile("README.md");

    expect(contributing).toContain("docs/coding-standards.md");
    expect(contributing).toContain("pnpm standards:check");
    expect(agents).toContain("pnpm standards:check");
    expect(readme).toContain("pnpm standards:check");
    expect(readme).toContain("docs/coding-standards.md");
  });

  it("key docs do not regress to the legacy 10-tool or Zod v3 model", () => {
    const paths = ["docs/coding-standards.md", "CONTRIBUTING.md", "AGENTS.md", "README.md"];
    for (const rel of paths) {
      const text = readRepoFile(rel);
      expect(text, `${rel} must not document only 10 consolidated tools`).not.toMatch(
        /\b10 consolidated tool handlers\b/,
      );
      expect(text, `${rel} must not lock schema validation to Zod v3`).not.toMatch(
        /\|\s*Schema validation\s*\|\s*Zod v3\s*\|/,
      );
    }
  });
});
