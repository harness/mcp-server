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

describe("Coding standards — documentation consistency", () => {
  const content = readFileSync(STANDARDS_PATH, "utf8");

  it("docs/coding-standards.md documents 11 consolidated MCP tools including harness_schema", () => {
    expect(content).toMatch(/11 consolidated tool handlers/);
    expect(content).not.toMatch(/\b10 consolidated tool handlers\b/);
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      expect(content, `missing ${tool} in docs/coding-standards.md`).toContain(tool);
    }
  });

  it("consolidated-tools.ts matches the documented tool count", () => {
    expect(CONSOLIDATED_MCP_TOOLS).toHaveLength(11);
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
  });

  it("AGENTS.md documents the registry-driven extension model and forbids per-endpoint handlers", () => {
    expect(agents).toContain("src/registry/toolsets/");
    expect(agents).toMatch(/Do NOT add per-endpoint tool handlers/);
    expect(agents).toMatch(/adding a declarative toolset in `src\/registry\/toolsets\/`/);
    expect(agents).toMatch(/Never[\s\S]*Use `console\.log\(\)`/);
  });

  it("CONTRIBUTING.md references standards guardrails and Zod v4 import path", () => {
    expect(contributing).toContain("pnpm standards:check");
    expect(contributing).toMatch(/11 generic MCP tools/);
    expect(contributing).toMatch(/import \* as z from "zod\/v4"/);
    expect(contributing).toContain("src/registry/toolsets/");
    expect(contributing).toMatch(/don't need to touch any tool files/);
  });
});
