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

  it("docs/coding-standards.md documents stderr-only logging (no console.log)", () => {
    expect(content).toMatch(/NEVER write to stdout/);
    expect(content).toMatch(/console\.log\(\)/);
    expect(content).toMatch(/createLogger/);
  });

  it("docs/coding-standards.md documents HarnessClient singleton and fetch exceptions", () => {
    expect(content).toMatch(/instantiated once in `src\/index\.ts`/);
    expect(content).toMatch(/src\/client\/harness-client\.ts/);
    expect(content).toMatch(/src\/utils\/log-resolver\.ts/);
  });

  it("docs/coding-standards.md documents pure-data toolset constraints", () => {
    expect(content).toMatch(/Toolset Definitions Are Pure Data/);
    expect(content).toMatch(/Import `HarnessClient`/);
    expect(content).toMatch(/Import or call `createLogger`/);
  });

  it("docs/coding-standards.md documents write confirmation and secret-metadata safety", () => {
    expect(content).toMatch(/Never.*expose secret values/i);
    expect(content).toMatch(/confirmViaElicitation|confirm: true/);
  });
});
