/**
 * Keep docs/coding-standards.md and CONTRIBUTING.md aligned with enforced constants.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALLOWED_MCP_TOOL_COUNT,
  ALLOWED_MCP_TOOLS,
} from "./allowed-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("Coding standards — documentation consistency", () => {
  const codingStandards = readFileSync(
    join(REPO_ROOT, "docs/coding-standards.md"),
    "utf8",
  );
  const contributing = readFileSync(join(REPO_ROOT, "CONTRIBUTING.md"), "utf8");

  it("docs/coding-standards.md documents the correct consolidated tool count", () => {
    expect(codingStandards).toMatch(
      new RegExp(`${ALLOWED_MCP_TOOL_COUNT} consolidated tool`),
    );
  });

  it("docs/coding-standards.md names every allowed MCP tool", () => {
    const missing = ALLOWED_MCP_TOOLS.filter((tool) => !codingStandards.includes(tool));
    expect(missing, `Missing from docs/coding-standards.md: ${missing.join(", ")}`).toEqual([]);
  });

  it("docs/coding-standards.md specifies Zod v4 (not v3)", () => {
    expect(codingStandards).toContain("Zod v4");
    expect(codingStandards).not.toMatch(/\bZod v3\b/);
  });

  it("docs/coding-standards.md documents standards:check in the verify step", () => {
    expect(codingStandards).toContain("pnpm standards:check");
  });

  it("CONTRIBUTING.md documents standards:check", () => {
    expect(contributing).toContain("pnpm standards:check");
    expect(contributing).toContain("docs/coding-standards.md");
  });
});
