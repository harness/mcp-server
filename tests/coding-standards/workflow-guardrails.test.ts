/**
 * Ensure CI and auto-sync workflows always run pnpm standards:check.
 * Prevents regression when editing .github/workflows/*.yml.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WORKFLOWS_REQUIRING_STANDARDS_CHECK } from "./constants.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("Coding standards — workflow guardrails", () => {
  for (const workflow of WORKFLOWS_REQUIRING_STANDARDS_CHECK) {
    it(`${workflow} runs pnpm standards:check`, () => {
      const content = readFileSync(join(REPO_ROOT, workflow), "utf8");
      expect(
        content,
        `${workflow} must run pnpm standards:check to enforce docs/coding-standards.md`,
      ).toMatch(/pnpm standards:check/);
    });
  }

  it("schema sync workflows run standards:check before opening PRs", () => {
    for (const workflow of [
      ".github/workflows/sync-schemas.yml",
      ".github/workflows/sync-entity-schemas.yml",
    ] as const) {
      const content = readFileSync(join(REPO_ROOT, workflow), "utf8");
      const standardsIdx = content.indexOf("pnpm standards:check");
      const syncIdx = Math.max(
        content.indexOf("sync-schemas.js"),
        content.indexOf("sync-entity-schemas.js"),
      );
      const prIdx = content.indexOf("create-pull-request");

      expect(standardsIdx, `${workflow}: missing standards:check`).toBeGreaterThanOrEqual(0);
      expect(syncIdx, `${workflow}: missing sync script step`).toBeGreaterThanOrEqual(0);
      expect(prIdx, `${workflow}: missing create-pull-request step`).toBeGreaterThanOrEqual(0);
      expect(
        standardsIdx < syncIdx,
        `${workflow}: standards:check must run before the sync script`,
      ).toBe(true);
    }
  });
});
