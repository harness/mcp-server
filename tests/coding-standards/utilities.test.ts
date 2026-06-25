/**
 * Utility module purity checks from docs/coding-standards.md.
 *
 * Utilities invoked by tool handlers must not bypass HarnessClient or corrupt stdio.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const SRC = join(REPO_ROOT, "src");

/** Global fetch API calls — not method names like `async fetch(` or interface `fetch(...)`. */
const GLOBAL_FETCH_PATTERN = /\bawait fetch\s*\(|\breturn fetch\s*\(|[^.\w]fetch\s*\(\s*["'`]|^fetch\s*\(/m;

/** Utility modules that tool handlers may call for pre-dispatch validation. */
const HANDLER_UTILITY_FILES = ["src/utils/pipeline-lint.ts"];

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

describe("Coding standards — handler utility purity", () => {
  it("pipeline-lint utility does not use console.log, fetch, or HarnessClient", () => {
    const violations: string[] = [];
    const file = join(REPO_ROOT, "src/utils/pipeline-lint.ts");
    const content = readFileSync(file, "utf8");

    if (/\bconsole\.log\s*\(/.test(content)) {
      violations.push("console.log()");
    }
    if (GLOBAL_FETCH_PATTERN.test(content)) {
      violations.push("global fetch()");
    }
    if (/new\s+HarnessClient\s*\(/.test(content) || /from\s+["'][^"']*harness-client/.test(content)) {
      violations.push("HarnessClient import/instantiation");
    }

    expect(violations, `pipeline-lint.ts violations: ${violations.join(", ")}`).toEqual([]);
  });

  it("handler utility files live under src/utils/", () => {
    for (const file of HANDLER_UTILITY_FILES) {
      expect(file.startsWith("src/utils/"), `${file} must be under src/utils/`).toBe(true);
      expect(readFileSync(join(REPO_ROOT, file), "utf8").length).toBeGreaterThan(0);
    }
  });
});

describe("Coding standards — pipeline write handler lint integration", () => {
  const PIPELINE_WRITE_HANDLERS = ["src/tools/harness-create.ts", "src/tools/harness-update.ts"];

  it("create/update handlers lint pipeline YAML before dispatch and block on errors via errorResult", () => {
    const violations: string[] = [];

    for (const file of PIPELINE_WRITE_HANDLERS) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      const checks: Array<[string, RegExp]> = [
        ["imports pipeline-lint", /from\s+["'][^"']*pipeline-lint\.js["']/],
        ["calls lintPipelineYaml", /lintPipelineYaml\s*\(/],
        ["calls extractPipelineYaml", /extractPipelineYaml\s*\(/],
        ["scopes lint to pipeline types", /resource_type\s*===\s*["']pipeline["']\s*\|\|\s*args\.resource_type\s*===\s*["']pipeline_v1["']/],
        ["blocks on lint errors with errorResult", /lintResult\.errors\.length\s*>\s*0[\s\S]*?return\s+errorResult/],
        ["attaches lint warnings to result", /lintResult\.warnings\.length\s*>\s*0/],
      ];

      for (const [label, pattern] of checks) {
        if (!pattern.test(content)) {
          violations.push(`${rel(join(REPO_ROOT, file))}: missing ${label}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
