/**
 * Keep docs/coding-standards.md aligned with enforced architecture constants.
 * Prevents drift (e.g. reverting to "10 tools" or Zod v3) without updating tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOL_COUNT, CONSOLIDATED_MCP_TOOLS } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");
const AGENTS_PATH = join(REPO_ROOT, "AGENTS.md");
const CONTRIBUTING_PATH = join(REPO_ROOT, "CONTRIBUTING.md");
const README_PATH = join(REPO_ROOT, "README.md");

describe("Coding standards — documentation consistency", () => {
  const content = readFileSync(STANDARDS_PATH, "utf8");

  it("docs/coding-standards.md documents 11 consolidated MCP tools including harness_schema", () => {
    expect(content).toMatch(new RegExp(`${CONSOLIDATED_MCP_TOOL_COUNT} consolidated tool handlers`));
    expect(content).not.toMatch(/\b10 consolidated tool handlers\b/);
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

  it("docs/coding-standards.md documents confirm (not confirmation) for write tools", () => {
    expect(content).toMatch(/confirm: true/);
    expect(content).not.toMatch(/confirmation:\s*true/);
  });

  it("tasks/eval-comprehensive.md uses confirm (not confirmation) for write tool examples", () => {
    const evalPath = join(REPO_ROOT, "tasks/eval-comprehensive.md");
    const evalContent = readFileSync(evalPath, "utf8");
    expect(evalContent).not.toMatch(/confirmation:\s*true/);
    expect(evalContent).toMatch(/confirm:\s*true/);
  });
});

describe("Coding standards — contributor docs alignment", () => {
  const agents = readFileSync(AGENTS_PATH, "utf8");
  const contributing = readFileSync(CONTRIBUTING_PATH, "utf8");

  it("AGENTS.md documents 11 consolidated MCP tools and Zod v4", () => {
    expect(agents).toMatch(/11 consolidated tools/);
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      expect(agents, `missing ${tool} in AGENTS.md`).toContain(tool);
    }
    expect(agents).toMatch(/Zod v4/);
    expect(agents).not.toMatch(/\b10 consolidated tools\b/);
    expect(agents).toContain("pnpm standards:check");
  });

  it("CONTRIBUTING.md references standards guardrails and Zod v4 import path", () => {
    expect(contributing).toContain("pnpm standards:check");
    expect(contributing).toMatch(/11 generic MCP tools/);
    expect(contributing).toMatch(/import \* as z from "zod\/v4"/);
    expect(contributing).toContain("docs/coding-standards.md");
  });

  it("README.md links coding standards and lists every consolidated MCP tool", () => {
    const readme = readFileSync(README_PATH, "utf8");
    expect(readme).toContain("docs/coding-standards.md");
    expect(readme).toMatch(/11 consolidated tools/);
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      expect(readme, `missing ${tool} in README.md`).toContain(tool);
    }
    expect(readme).not.toMatch(/10 consolidated tool/);
  });
});
