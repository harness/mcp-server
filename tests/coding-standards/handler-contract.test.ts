/**
 * Tool handler contracts from docs/coding-standards.md (error handling, pagination, stdout).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { readdirSync, statSync } from "node:fs";

const REPO_ROOT = join(import.meta.dirname, "../..");
const SRC = join(REPO_ROOT, "src");

const HANDLER_FILES = [
  "src/tools/harness-list.ts",
  "src/tools/harness-get.ts",
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
  "src/tools/harness-diagnose.ts",
  "src/tools/harness-search.ts",
  "src/tools/harness-describe.ts",
  "src/tools/harness-status.ts",
  "src/tools/harness-schema.ts",
];

/** Handlers that call Harness APIs — must map infrastructure errors via toMcpError. */
const API_HANDLER_FILES = HANDLER_FILES.filter((f) => f !== "src/tools/harness-describe.ts");

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

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

describe("Coding standards — handler error handling", () => {
  it("API handlers import toMcpError and errorResult from utils/errors", () => {
    const violations: string[] = [];

    for (const file of API_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("toMcpError")) {
        violations.push(`${file}: missing toMcpError import/usage`);
      }
      if (!content.includes("errorResult")) {
        violations.push(`${file}: missing errorResult import/usage`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("harness_describe handles errors without leaking infrastructure failures", () => {
    const content = readFileSync(join(REPO_ROOT, "src/tools/harness-describe.ts"), "utf8");
    expect(content).toMatch(/toMcpError|errorResult/);
    expect(content).toMatch(/catch\s*\(/);
  });

  it("API handlers throw toMcpError for unexpected failures in outer catch", () => {
    const violations: string[] = [];

    for (const file of API_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!/throw\s+toMcpError\s*\(/.test(content)) {
        violations.push(`${file}: outer catch should throw toMcpError(err) for infrastructure failures`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

describe("Coding standards — stdout safety", () => {
  it("never writes to process.stdout in src/", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(SRC)) {
      const content = readFileSync(file, "utf8");
      if (/process\.stdout\.write\s*\(/.test(content)) {
        violations.push(rel(file));
      }
    }

    expect(violations, `process.stdout.write() found in:\n${violations.join("\n")}`).toEqual([]);
  });
});

describe("Coding standards — harness_list pagination", () => {
  it("uses page default 0, size default 20, and size max 100", () => {
    const content = readFileSync(join(REPO_ROOT, "src/tools/harness-list.ts"), "utf8");
    expect(content).toMatch(/page:.*\.default\(0\)/s);
    expect(content).toMatch(/size:.*\.default\(20\)/s);
    expect(content).toMatch(/size:.*\.max\(100\)/s);
  });
});
