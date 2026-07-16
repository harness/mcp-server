/**
 * Keep AGENTS.md aligned with docs/coding-standards.md and enforced architecture constants.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALLOWED_MCP_TOOLS } from "./constants.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const AGENTS_PATH = join(REPO_ROOT, "AGENTS.md");

describe("Coding standards — AGENTS.md consistency", () => {
  const content = readFileSync(AGENTS_PATH, "utf8");

  it("AGENTS.md documents 11 consolidated MCP tools including harness_schema", () => {
    expect(content).toMatch(/11 consolidated tools/);
    for (const tool of ALLOWED_MCP_TOOLS) {
      expect(content, `missing ${tool} in AGENTS.md`).toContain(tool);
    }
  });

  it("AGENTS.md references Zod v4 (not v3)", () => {
    expect(content).toMatch(/Zod v4/);
    expect(content).not.toMatch(/Zod v3/);
  });

  it("AGENTS.md documents pnpm standards:check guardrails", () => {
    expect(content).toContain("pnpm standards:check");
  });

  it("AGENTS.md forbids console.log on stdout", () => {
    expect(content).toMatch(/Use `console\.log\(\)` — stdout is the JSON-RPC transport/);
  });
});
