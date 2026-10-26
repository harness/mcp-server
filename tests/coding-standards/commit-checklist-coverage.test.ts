/**
 * Every item in docs/coding-standards.md "Commit Checklist" must be either
 * covered by an automated guard (see enforcement-map.test.ts) or listed here
 * as intentionally manual / CI-only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

/** Checklist bullets that cannot be fully asserted statically (runtime / API responses). */
const MANUAL_CHECKLIST_FRAGMENTS = [
  "No secrets exposed",
] as const;

/** Bullets enforced by .github/workflows/ci.yml (see enforcement-map CI test). */
const CI_CHECKLIST_FRAGMENTS = [
  "`pnpm build` passes",
  "`pnpm typecheck` passes",
  "`pnpm test` passes",
  "`pnpm standards:check` passes",
] as const;

/** Bullets with dedicated Vitest guard suites (labels mirror enforcement-map.test.ts). */
const AUTOMATED_CHECKLIST_FRAGMENTS = [
  "No new `server.registerTool()` calls",
  "No `console.log()`",
  "No direct `fetch()` calls",
  "No new `harness-*.ts` handler files",
  "Toolset files are pure data",
  "All Zod params have `.describe()`",
  "Response extractors are from `extractors.ts`",
  "Scope is declared correctly",
  "`identifierFields` are declared",
  "`operationPolicy` on every endpoint",
  "Write operations require confirmation",
] as const;

describe("Coding standards — commit checklist coverage", () => {
  const content = readFileSync(STANDARDS_PATH, "utf8");

  it("docs/coding-standards.md commit checklist includes every tracked guard fragment", () => {
    const allFragments = [
      ...AUTOMATED_CHECKLIST_FRAGMENTS,
      ...MANUAL_CHECKLIST_FRAGMENTS,
      ...CI_CHECKLIST_FRAGMENTS,
    ];
    for (const fragment of allFragments) {
      expect(content, `commit checklist missing: ${fragment}`).toContain(fragment);
    }
  });

  it("documents canonical 11-tool surface (automation prompts may cite outdated 10-tool copy)", () => {
    expect(content).toMatch(/11 consolidated tool handlers/);
    expect(content).toContain("harness_schema");
    expect(content).not.toMatch(/10 consolidated tool handlers/);
  });
});
