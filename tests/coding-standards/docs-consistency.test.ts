/**
 * Keep docs/coding-standards.md aligned with enforced architecture constants.
 * Prevents drift (e.g. reverting to "10 tools" or Zod v3) without updating tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALLOWED_MCP_TOOLS as REQUIRED_TOOLS } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

describe("Coding standards — documentation consistency", () => {
  const content = readFileSync(STANDARDS_PATH, "utf8");

  it("docs/coding-standards.md documents 11 consolidated MCP tools including harness_schema", () => {
    expect(content).toMatch(/11 consolidated tool handlers/);
    for (const tool of REQUIRED_TOOLS) {
      expect(content, `missing ${tool} in docs/coding-standards.md`).toContain(tool);
    }
  });

  it("docs/coding-standards.md references Zod v4 (not v3)", () => {
    expect(content).toMatch(/Zod v4/);
    expect(content).not.toMatch(/\|\s*Schema validation\s*\|\s*Zod v3\s*\|/);
  });

  it("docs/coding-standards.md documents pnpm standards:check guardrails", () => {
    expect(content).toContain("pnpm standards:check");
    expect(content).toContain("tests/coding-standards/consolidated-tools.ts");
    expect(content).toContain("enforcement-map.test.ts");
  });

  it("docs/coding-standards.md forbids new harness-*.ts handler files", () => {
    expect(content).toMatch(/Do NOT add new `harness-\*\.ts` handler files/);
  });

  it("docs/coding-standards.md documents confirm (not deprecated confirmation) for write tools", () => {
    expect(content).toMatch(/confirm: true/);
    expect(content).not.toMatch(/confirmation:\s*true/);
  });

  it("does not regress to outdated automation snapshots (10 tools, Zod v3, server.tool)", () => {
    expect(content).not.toMatch(/10 consolidated tool handlers/);
    expect(content).not.toMatch(/\|\s*Schema validation\s*\|\s*Zod v3\s*\|/);
    expect(content).toMatch(/registerTool\(\)/);
    expect(content).not.toMatch(/server\.tool\(\)/);
  });

  it("tasks/eval-comprehensive.md uses confirm (not deprecated confirmation) for write tool examples", () => {
    const evalPath = join(REPO_ROOT, "tasks/eval-comprehensive.md");
    const evalContent = readFileSync(evalPath, "utf8");
    expect(evalContent).not.toMatch(/confirmation:\s*true/);
    expect(evalContent).toMatch(/confirm:\s*true/);
  });

  it("AGENTS.md stays aligned with canonical architecture (11 tools, Zod v4, standards:check)", () => {
    const agentsPath = join(REPO_ROOT, "AGENTS.md");
    const agentsContent = readFileSync(agentsPath, "utf8");
    expect(agentsContent).toMatch(/11 consolidated tools/);
    expect(agentsContent).toContain("pnpm standards:check");
    expect(agentsContent).toMatch(/Zod v4/);
    expect(agentsContent).not.toMatch(/10 consolidated tool/);
    expect(agentsContent).not.toMatch(/\bZod v3\b/);
    for (const tool of REQUIRED_TOOLS) {
      expect(agentsContent, `missing ${tool} in AGENTS.md`).toContain(tool);
    }
  });

  it("CONTRIBUTING.md references automated standards guardrails", () => {
    const contributingPath = join(REPO_ROOT, "CONTRIBUTING.md");
    const contributingContent = readFileSync(contributingPath, "utf8");
    expect(contributingContent).toContain("pnpm standards:check");
    expect(contributingContent).toContain("docs/coding-standards.md");
  });
});
