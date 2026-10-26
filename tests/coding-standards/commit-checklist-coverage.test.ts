/**
 * CI guardrails referenced by the commit checklist must stay wired in workflows.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("Coding standards — commit checklist CI coverage", () => {
  it("main CI workflow runs build, typecheck, test, and standards:check", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");

    expect(ci).toMatch(/pnpm build/);
    expect(ci).toMatch(/pnpm typecheck/);
    expect(ci).toMatch(/pnpm test/);
    expect(ci).toContain("pnpm standards:check");
  });

  it("PR template includes standards:check checkbox", () => {
    const template = readFileSync(join(REPO_ROOT, ".github/PULL_REQUEST_TEMPLATE.md"), "utf8");
    expect(template).toContain("pnpm standards:check");
    expect(template).toContain("docs/coding-standards.md");
  });
});
