/**
 * Error handling contract from docs/coding-standards.md §6.
 *
 * API-calling handlers use errorResult() for user-fixable errors and
 * throw toMcpError(err) for infrastructure failures. Local-only tools are exempt.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CONSOLIDATED_TOOL_HANDLER_FILES } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Handlers that call HarnessClient / registry dispatch against the live API. */
const API_HANDLERS = [
  CONSOLIDATED_TOOL_HANDLER_FILES.harness_list,
  CONSOLIDATED_TOOL_HANDLER_FILES.harness_get,
  CONSOLIDATED_TOOL_HANDLER_FILES.harness_create,
  CONSOLIDATED_TOOL_HANDLER_FILES.harness_update,
  CONSOLIDATED_TOOL_HANDLER_FILES.harness_delete,
  CONSOLIDATED_TOOL_HANDLER_FILES.harness_execute,
  CONSOLIDATED_TOOL_HANDLER_FILES.harness_diagnose,
  CONSOLIDATED_TOOL_HANDLER_FILES.harness_search,
  CONSOLIDATED_TOOL_HANDLER_FILES.harness_status,
];

/** Local metadata / schema tools — no toMcpError required. */
const LOCAL_ONLY_HANDLERS = [
  CONSOLIDATED_TOOL_HANDLER_FILES.harness_describe,
  CONSOLIDATED_TOOL_HANDLER_FILES.harness_schema,
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
