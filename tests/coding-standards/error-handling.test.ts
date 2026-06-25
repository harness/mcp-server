/**
 * Error-handling contract from docs/coding-standards.md §6.
 *
 * API-calling handlers use errorResult() for known/user-facing failures and
 * throw toMcpError(err) for unexpected errors. Local-only handlers are exempt.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Handlers that call HarnessClient / registry dispatch — must follow §6. */
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

/** Local metadata only — graceful inline errors are acceptable. */
const LOCAL_ONLY_HANDLER_FILES = [
  "src/tools/harness-describe.ts",
];

describe("Coding standards — error handling (§6)", () => {
  it("API tool handlers import and use toMcpError for unexpected failures", () => {
    const violations: string[] = [];

    for (const file of API_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("toMcpError")) {
        violations.push(`${file}: missing toMcpError import/usage`);
      }
      if (!content.includes("errorResult")) {
        violations.push(`${file}: missing errorResult import/usage`);
      }
      if (!/throw\s+toMcpError\s*\(\s*err\s*\)/.test(content)) {
        violations.push(`${file}: missing 'throw toMcpError(err)' in catch handler`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("local-only handlers do not require toMcpError", () => {
    for (const file of LOCAL_ONLY_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      expect(content.includes("toMcpError"), `${file} should not need toMcpError`).toBe(false);
    }
  });

  it("registerAllTools wires exactly the 11 consolidated handlers", () => {
    const content = readFileSync(join(REPO_ROOT, "src/tools/index.ts"), "utf8");
    const registerCalls = content.match(/register\w+Tool\s*\(/g) ?? [];
    expect(registerCalls).toHaveLength(11);
  });
});
