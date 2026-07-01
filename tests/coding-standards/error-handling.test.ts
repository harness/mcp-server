/**
 * Error handling contract from docs/coding-standards.md §6.
 *
 * API-calling handlers use errorResult() for user-fixable errors and
 * throw toMcpError(err) for infrastructure failures. Local-only tools are exempt.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Handlers that call HarnessClient / registry dispatch against the live API. */
const API_HANDLERS = [
  "src/tools/harness-list.ts",
  "src/tools/harness-get.ts",
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
  "src/tools/harness-diagnose.ts",
  "src/tools/harness-search.ts",
  "src/tools/harness-status.ts",
];

/** Local metadata / schema tools — no toMcpError required. */
const LOCAL_ONLY_HANDLERS = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
];

describe("Coding standards — error handling pattern", () => {
  it("API-calling handlers import and use toMcpError for infrastructure failures", () => {
    const violations: string[] = [];

    for (const file of API_HANDLERS) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("toMcpError")) {
        violations.push(`${file}: missing toMcpError import/usage`);
        continue;
      }
      if (!/throw\s+toMcpError\s*\(/.test(content)) {
        violations.push(`${file}: must throw toMcpError(err) for unexpected failures`);
      }
      if (!content.includes("errorResult")) {
        violations.push(`${file}: missing errorResult for user-fixable errors`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("local-only handlers do not require toMcpError", () => {
    for (const file of LOCAL_ONLY_HANDLERS) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      expect(content.includes("registerTool")).toBe(true);
    }
  });
});
