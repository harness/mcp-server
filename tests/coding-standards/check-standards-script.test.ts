/**
 * Smoke test for scripts/check-standards.js — the CI gate added in PR #377.
 * Ensures the standalone script stays in sync with the repo and exits cleanly.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const SCRIPT = join(REPO_ROOT, "scripts/check-standards.js");

describe("check-standards.js CI script", () => {
  it("exits 0 and reports pass on the current codebase", () => {
    const output = execSync(`node "${SCRIPT}"`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    expect(output).toMatch(/Standards check passed/);
    expect(output).toMatch(/11 consolidated tool handlers/);
  });

  it("is wired to package.json standards:check", () => {
    const pkg = JSON.parse(
      execSync(`node -e "console.log(JSON.stringify(require('./package.json').scripts['standards:check']))"`, {
        cwd: REPO_ROOT,
        encoding: "utf8",
      }),
    ) as string;

    expect(pkg).toBe("node scripts/check-standards.js");
  });
});
