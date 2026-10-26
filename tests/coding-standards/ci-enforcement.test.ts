/**
 * Maps docs/coding-standards.md commit-checklist verification commands to CI.
 * Local developers run pnpm build/typecheck/test/standards:check; CI must run the same suite.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CI_WORKFLOW_PATH = join(REPO_ROOT, ".github/workflows/ci.yml");

const CHECKLIST_COMMANDS = [
  "pnpm build",
  "pnpm typecheck",
  "pnpm test",
  "pnpm standards:check",
] as const;

describe("Coding standards — CI enforces commit checklist commands", () => {
  const workflow = readFileSync(CI_WORKFLOW_PATH, "utf8");

  it("main CI workflow runs every commit-checklist verification command", () => {
    const missing: string[] = [];
    for (const cmd of CHECKLIST_COMMANDS) {
      if (!workflow.includes(`run: ${cmd}`)) {
        missing.push(cmd);
      }
    }
    expect(missing, `Add to .github/workflows/ci.yml build-and-test job:\n${missing.join("\n")}`).toEqual(
      [],
    );
  });

  it("CI runs standards:check after unit tests (guardrails on compiled registry)", () => {
    const buildIdx = workflow.indexOf("run: pnpm build");
    const testIdx = workflow.indexOf("run: pnpm test");
    const standardsIdx = workflow.indexOf("run: pnpm standards:check");
    expect(buildIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeGreaterThan(buildIdx);
    expect(standardsIdx).toBeGreaterThan(testIdx);
  });
});
