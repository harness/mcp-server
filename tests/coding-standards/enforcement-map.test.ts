/**
 * Maps docs/coding-standards.md Commit Checklist items to automated guardrails.
 *
 * When adding a new architecture rule, extend enforcement-map.ts and the enforcing
 * test file so `pnpm standards:check` stays the single verification entrypoint.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STANDARDS_ENFORCEMENT } from "./enforcement-map.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("Coding standards — enforcement map", () => {
  it("every automated checklist item references at least one guardrail test file", () => {
    const missing = STANDARDS_ENFORCEMENT.filter((e) => e.automated && e.tests.length === 0);
    expect(missing.map((e) => e.checklist)).toEqual([]);
  });

  it("every referenced guardrail test file exists on disk", () => {
    const allTests = [...new Set(STANDARDS_ENFORCEMENT.flatMap((e) => e.tests))];
    const missing = allTests.filter((path) => !existsSync(join(REPO_ROOT, path)));
    expect(missing, `Missing enforcement test files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("pnpm standards:check includes all coding-standards tests and structural validation", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const script = pkg.scripts["standards:check"] ?? "";
    expect(script).toContain("tests/coding-standards");
    expect(script).toContain("tests/registry/structural-validation.test.ts");
  });

  it("CI runs pnpm standards:check", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("pnpm standards:check");
  });
});
