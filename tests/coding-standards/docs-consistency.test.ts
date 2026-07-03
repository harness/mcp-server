/**
 * Keeps docs/coding-standards.md aligned with automated enforcement.
 *
 * When architecture rules change, update both the doc and the tests that
 * encode the same constants (architecture.test.ts ALLOWED_MCP_TOOLS, etc.).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

const ALLOWED_MCP_TOOLS = [
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
] as const;

describe("Coding standards — docs consistency", () => {
  const codingStandards = readFileSync(join(REPO_ROOT, "docs/coding-standards.md"), "utf8");
  const contributing = readFileSync(join(REPO_ROOT, "CONTRIBUTING.md"), "utf8");
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };

  it("docs/coding-standards.md documents the 11 consolidated MCP tools", () => {
    expect(codingStandards).toMatch(/11 consolidated tool handlers/);
    for (const tool of ALLOWED_MCP_TOOLS) {
      expect(codingStandards).toContain(tool);
    }
  });

  it("docs/coding-standards.md documents Zod v4 (not legacy v3)", () => {
    expect(codingStandards).toMatch(/Zod v4/);
    expect(codingStandards).toContain('import * as z from "zod/v4"');
    expect(codingStandards).not.toMatch(/Schema validation \| Zod v3/);
  });

  it("docs/coding-standards.md documents pnpm standards:check guardrails", () => {
    expect(codingStandards).toContain("pnpm standards:check");
  });

  it("CONTRIBUTING.md references standards:check and coding-standards.md", () => {
    expect(contributing).toContain("pnpm standards:check");
    expect(contributing).toContain("docs/coding-standards.md");
  });

  it("package.json exposes the standards:check script", () => {
    expect(packageJson.scripts?.["standards:check"]).toContain("tests/coding-standards");
    expect(packageJson.scripts?.["standards:check"]).toContain("structural-validation.test.ts");
  });
});
