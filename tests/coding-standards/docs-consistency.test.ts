/**
 * Keep docs/coding-standards.md aligned with enforced architecture constants.
 * Prevents drift (e.g. reverting to "10 tools" or Zod v3) without updating tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOLS } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");
const AGENTS_PATH = join(REPO_ROOT, "AGENTS.md");
const CONTRIBUTING_PATH = join(REPO_ROOT, "CONTRIBUTING.md");
const README_PATH = join(REPO_ROOT, "README.md");

describe("Coding standards — documentation consistency", () => {
  const content = readFileSync(STANDARDS_PATH, "utf8");

  it("docs/coding-standards.md documents 11 consolidated MCP tools including harness_schema", () => {
    expect(content).toMatch(/11 consolidated tool handlers/);
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      expect(content, `missing ${tool} in docs/coding-standards.md`).toContain(tool);
    }
  });

  it("docs/coding-standards.md does not regress to outdated architecture snapshots", () => {
    expect(content).not.toMatch(/10 consolidated tool/);
    expect(content).not.toMatch(/\bserver\.tool\s*\(/);
    expect(content).not.toMatch(/\|\s*Schema validation\s*\|\s*Zod v3\s*\|/);
    expect(content).toMatch(/registerTool/);
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

  it("AGENTS.md stays aligned with the 11-tool registry model and Zod v4", () => {
    const agents = readFileSync(AGENTS_PATH, "utf8");
    expect(agents).toMatch(/11 consolidated tools/);
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      expect(agents, `missing ${tool} in AGENTS.md`).toContain(tool);
    }
    expect(agents).toMatch(/Zod v4/);
    expect(agents).toContain("pnpm standards:check");
    expect(agents).not.toMatch(/10 consolidated tool/);
  });

  it("CONTRIBUTING.md points contributors at standards guardrails", () => {
    const contributing = readFileSync(CONTRIBUTING_PATH, "utf8");
    expect(contributing).toContain("pnpm standards:check");
    expect(contributing).toContain("docs/coding-standards.md");
  });

  it("README.md documents the 11-tool consolidated model (not legacy per-endpoint tools)", () => {
    const readme = readFileSync(README_PATH, "utf8");
    expect(readme).toMatch(/11 consolidated tools/);
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      expect(readme, `missing ${tool} in README.md`).toContain(tool);
    }
    expect(readme).not.toMatch(/10 consolidated tool/);
  });
});
