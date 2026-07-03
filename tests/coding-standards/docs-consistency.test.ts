/**
 * Keeps docs/coding-standards.md aligned with automated enforcement in
 * tests/coding-standards/*.test.ts and package.json scripts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

const CANONICAL_MCP_TOOLS = [
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

const DOCUMENTED_FETCH_EXCEPTIONS = [
  "src/client/harness-client.ts",
  "src/utils/log-resolver.ts",
  "src/audit/sinks/webhook.ts",
  "src/search/remote-provider.ts",
] as const;

describe("Coding standards — docs consistency", () => {
  const docs = readFileSync(join(REPO_ROOT, "docs/coding-standards.md"), "utf8");
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };

  it("docs/coding-standards.md documents all 11 consolidated MCP tools", () => {
    const missing = CANONICAL_MCP_TOOLS.filter((tool) => !docs.includes(`\`${tool}\``));
    expect(missing, `Missing from docs/coding-standards.md: ${missing.join(", ")}`).toEqual([]);
  });

  it("docs/coding-standards.md specifies Zod v4 (not v3)", () => {
    expect(docs).toMatch(/Zod v4/);
    expect(docs).toMatch(/import \* as z from "zod\/v4"/);
    expect(docs).not.toMatch(/\| Schema validation \| Zod v3 \|/);
  });

  it("docs/coding-standards.md documents global fetch() exception files", () => {
    for (const file of DOCUMENTED_FETCH_EXCEPTIONS) {
      expect(docs, `docs should mention fetch exception: ${file}`).toContain(file);
    }
  });

  it("docs/coding-standards.md references pnpm standards:check in verification steps", () => {
    expect(docs).toContain("pnpm standards:check");
  });

  it("package.json standards:check runs coding-standards and structural-validation tests", () => {
    const script = packageJson.scripts?.["standards:check"] ?? "";
    expect(script).toContain("tests/coding-standards");
    expect(script).toContain("tests/registry/structural-validation.test.ts");
  });

  it("CONTRIBUTING.md points contributors to docs/coding-standards.md and standards:check", () => {
    const contributing = readFileSync(join(REPO_ROOT, "CONTRIBUTING.md"), "utf8");
    expect(contributing).toContain("docs/coding-standards.md");
    expect(contributing).toContain("pnpm standards:check");
  });

  it("CI workflow runs pnpm standards:check", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("pnpm standards:check");
  });

  it("schema sync workflows run pnpm standards:check before opening PRs", () => {
    const syncSchemas = readFileSync(join(REPO_ROOT, ".github/workflows/sync-schemas.yml"), "utf8");
    const syncEntity = readFileSync(join(REPO_ROOT, ".github/workflows/sync-entity-schemas.yml"), "utf8");
    expect(syncSchemas).toContain("pnpm standards:check");
    expect(syncEntity).toContain("pnpm standards:check");
  });
});
