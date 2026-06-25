/**
 * Error-handling contract from docs/coding-standards.md §6.
 *
 * API-facing tool handlers must surface known errors via errorResult() and
 * unexpected failures via throw toMcpError(err) — never swallow errors.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Handlers that call Harness APIs via registry.dispatch or HarnessClient. */
const API_HANDLER_FILES = [
  "src/tools/harness-list.ts",
  "src/tools/harness-get.ts",
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
  "src/tools/harness-diagnose.ts",
  "src/tools/harness-search.ts",
  "src/tools/harness-status.ts",
  "src/tools/harness-schema.ts",
];

describe("Coding standards — error handling", () => {
  it("API handlers import errorResult for graceful user-facing errors", () => {
    const violations: string[] = [];

    for (const file of API_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("errorResult")) {
        violations.push(`${file}: missing errorResult usage`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("API handlers import toMcpError for unexpected failures", () => {
    const violations: string[] = [];

    for (const file of API_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("toMcpError")) {
        violations.push(`${file}: missing toMcpError import/usage`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("API handlers rethrow unexpected errors via throw toMcpError(err)", () => {
    const violations: string[] = [];

    for (const file of API_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!/throw\s+toMcpError\s*\(/.test(content)) {
        violations.push(`${file}: missing 'throw toMcpError(err)' in catch block`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
