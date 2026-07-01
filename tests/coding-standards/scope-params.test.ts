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

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Handlers that dispatch to the registry against the live Harness API. */
const SCOPE_AWARE_HANDLERS = [
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

/** Local metadata tools — no org_id/project_id required. */
const LOCAL_ONLY_HANDLERS = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
];

function hasOptionalScopeParam(content: string, param: "org_id" | "project_id"): boolean {
  const re = new RegExp(
    `${param}:\\s*z\\.string\\(\\)\\.optional\\(\\)\\.describe\\(`,
  );
  return re.test(content);
}

describe("Coding standards — scope params on dispatch handlers", () => {
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

  it("API-dispatch handlers pass scope through to registry.dispatch", () => {
    const violations: string[] = [];

    for (const file of SCOPE_AWARE_HANDLERS) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("registry.dispatch")) {
        violations.push(`${file}: missing registry.dispatch call`);
      }
      if (!content.includes("org_id")) {
        violations.push(`${file}: org_id not referenced in handler`);
      }
      if (!content.includes("project_id")) {
        violations.push(`${file}: project_id not referenced in handler`);
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
