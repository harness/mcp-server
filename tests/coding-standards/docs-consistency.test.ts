/**
 * Keep docs/coding-standards.md aligned with enforced architecture constants.
 * Prevents drift (e.g. reverting to "10 tools" or Zod v3) without updating tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");
const AGENTS_PATH = join(REPO_ROOT, "AGENTS.md");
const CONTRIBUTING_PATH = join(REPO_ROOT, "CONTRIBUTING.md");

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
  });

  it("docs/coding-standards.md forbids new harness-*.ts handler files", () => {
    expect(content).toMatch(/Do NOT add new `harness-\*\.ts` handler files/);
  });

  it("AGENTS.md documents 11 consolidated tools and Zod v4", () => {
    const agents = readFileSync(AGENTS_PATH, "utf8");
    expect(agents).toMatch(/11 consolidated tools/);
    expect(agents).toMatch(/Zod v4/);
    for (const tool of REQUIRED_TOOLS) {
      expect(agents, `missing ${tool} in AGENTS.md`).toContain(tool);
    }
    expect(agents).toContain("pnpm standards:check");
  });

  it("CONTRIBUTING.md references standards guardrails and Zod v4", () => {
    const contributing = readFileSync(CONTRIBUTING_PATH, "utf8");
    expect(contributing).toContain("pnpm standards:check");
    expect(contributing).toMatch(/Zod v4/);
    expect(contributing).toContain("docs/coding-standards.md");
  });
});
