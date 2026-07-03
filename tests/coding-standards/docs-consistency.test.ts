/**
 * Ensures contributor docs stay aligned with the enforced tool surface and tech stack.
 *
 * Guards against stale copies of coding standards (e.g. "10 tools" or "Zod v3")
 * that no longer match docs/coding-standards.md and the automated guardrails.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALLOWED_MCP_TOOLS } from "./allowed-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

function readRepoFile(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}

describe("Coding standards — docs consistency", () => {
  it("docs/coding-standards.md documents 11 consolidated tools (not 10)", () => {
    const content = readRepoFile("docs/coding-standards.md");
    expect(content).toMatch(/11 consolidated tool handlers/);
    expect(content).not.toMatch(/10 consolidated tool handlers/);
    expect(content).toMatch(/11 handlers are fixed/);
    expect(content).not.toMatch(/10 handlers are fixed/);
  });

  it("docs/coding-standards.md lists every allowed MCP tool by name", () => {
    const content = readRepoFile("docs/coding-standards.md");
    for (const tool of ALLOWED_MCP_TOOLS) {
      expect(content, `missing ${tool} in docs/coding-standards.md`).toContain(tool);
    }
  });

  it("docs/coding-standards.md documents Zod v4 (not v3)", () => {
    const content = readRepoFile("docs/coding-standards.md");
    expect(content).toMatch(/Zod v4/);
    expect(content).not.toMatch(/Zod v3/);
    expect(content).toContain('import * as z from "zod/v4"');
  });

  it("CONTRIBUTING.md references 11 generic MCP tools", () => {
    const content = readRepoFile("CONTRIBUTING.md");
    expect(content).toMatch(/11 generic MCP tools/);
    expect(content).toContain("harness_schema");
  });

  it("package.json description references 11 MCP tools", () => {
    const pkg = JSON.parse(readRepoFile("package.json")) as { description?: string };
    expect(pkg.description).toMatch(/11 MCP tools/);
  });

  it("README.md references 11 consolidated tools", () => {
    const content = readRepoFile("README.md");
    expect(content).toMatch(/11 consolidated tools/);
    expect(content).toMatch(/11 tools/);
  });
});
