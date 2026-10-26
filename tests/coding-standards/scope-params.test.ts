/**
 * Harness scoping model — docs/coding-standards.md §4 and §8.
 *
 * Registry dispatch injects accountIdentifier / orgIdentifier / projectIdentifier.
 * API-calling tool handlers must expose optional org_id and project_id so callers
 * can override config defaults without hardcoding scope in toolset specs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HANDLER_FILES } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Local metadata tools — no org_id/project_id required. */
const LOCAL_ONLY_HANDLERS = new Set([
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
]);

/** Handlers that dispatch to the registry against the live Harness API. */
const SCOPE_AWARE_HANDLERS = HANDLER_FILES.filter((file) => !LOCAL_ONLY_HANDLERS.has(file));

function hasOptionalScopeParam(content: string, param: "org_id" | "project_id"): boolean {
  const inline = new RegExp(
    `${param}:\\s*z\\.string\\(\\)\\.optional\\(\\)\\.describe\\(`,
  );
  const helper = param === "org_id"
    ? /org_id:\s*orgIdField\s*\(/
    : /project_id:\s*projectIdField\s*\(/;
  return inline.test(content) || helper.test(content);
}

describe("Coding standards — scope params on dispatch handlers", () => {
  it("partitions every consolidated handler into scope-aware vs local-only", () => {
    expect(SCOPE_AWARE_HANDLERS.length + LOCAL_ONLY_HANDLERS.size).toBe(HANDLER_FILES.length);
    for (const file of HANDLER_FILES) {
      const isLocal = LOCAL_ONLY_HANDLERS.has(file);
      const isScopeAware = SCOPE_AWARE_HANDLERS.includes(file);
      expect(isLocal !== isScopeAware, `${file} must be exactly one of local-only or scope-aware`).toBe(
        true,
      );
    }
  });

  it("API-dispatch handlers declare optional org_id and project_id", () => {
    const violations: string[] = [];

    for (const file of SCOPE_AWARE_HANDLERS) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!hasOptionalScopeParam(content, "org_id")) {
        violations.push(`${file}: missing optional org_id with .describe()`);
      }
      if (!hasOptionalScopeParam(content, "project_id")) {
        violations.push(`${file}: missing optional project_id with .describe()`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("local-only handlers are exempt from org_id/project_id requirements", () => {
    for (const file of LOCAL_ONLY_HANDLERS) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      expect(content.includes("registerTool")).toBe(true);
    }
  });
});
