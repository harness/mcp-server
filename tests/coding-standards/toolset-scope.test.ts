/**
 * Toolset scope injection rules from docs/coding-standards.md.
 *
 * Registry.dispatch() injects accountIdentifier / orgIdentifier / projectIdentifier.
 * Tool input uses snake_case (org_id, project_id); queryParams map those to API names.
 * Using camelCase scope keys as queryParams input keys bypasses the dispatch layer.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { TOOLSET_HELPER_FILES } from "./allowed-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOOLSET_DIR = join(REPO_ROOT, "src/registry/toolsets");

/** CamelCase scope keys must not be used as tool-input keys in queryParams. */
const FORBIDDEN_SCOPE_INPUT_KEYS = new Set([
  "accountIdentifier",
  "orgIdentifier",
  "projectIdentifier",
]);

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

describe("Coding standards — toolset scope injection", () => {
  it("toolset queryParams use snake_case input keys for scope (not camelCase API names)", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(TOOLSET_DIR)) {
      const fileRel = rel(file);
      if (TOOLSET_HELPER_FILES.has(fileRel)) continue;

      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const context = lines.slice(Math.max(0, i - 12), i + 1).join("\n");
        if (!context.includes("queryParams")) continue;

        for (const scopeKey of FORBIDDEN_SCOPE_INPUT_KEYS) {
          const keyRe = new RegExp(`\\b${scopeKey}\\s*:`);
          if (keyRe.test(line)) {
            violations.push(
              `${fileRel}:${i + 1}: queryParams key "${scopeKey}" — use snake_case input (org_id/project_id) and map to API name`,
            );
          }
        }
      }
    }

    expect(
      violations,
      `CamelCase scope keys in queryParams (registry injects scope; map via org_id/project_id):\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
