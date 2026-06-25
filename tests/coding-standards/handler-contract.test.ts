/**
 * Handler-level contract checks from docs/coding-standards.md:
 * error handling, pagination defaults, and snake_case input params.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Handlers that dispatch to Harness APIs via Registry / HarnessClient. */
const API_DISPATCH_HANDLERS = [
  "src/tools/harness-list.ts",
  "src/tools/harness-get.ts",
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
  "src/tools/harness-search.ts",
  "src/tools/harness-status.ts",
  "src/tools/harness-diagnose.ts",
];

/** Local-metadata handlers — graceful errorResult is sufficient. */
const LOCAL_HANDLERS = [
  "src/tools/harness-describe.ts",
  "src/tools/harness-schema.ts",
];

const ALL_HANDLERS = [...API_DISPATCH_HANDLERS, ...LOCAL_HANDLERS];

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

/** Extract top-level inputSchema property names (same heuristic as registry-metadata.test.ts). */
function extractInputSchemaPropertyNames(content: string): string[] {
  const schemaStart = content.indexOf("inputSchema:");
  if (schemaStart === -1) return [];

  const braceStart = content.indexOf("{", schemaStart);
  if (braceStart === -1) return [];

  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }
  if (braceEnd === -1) return [];

  const body = content.slice(braceStart + 1, braceEnd);
  const names: string[] = [];
  let scanDepth = 0;
  let lineStart = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{") scanDepth++;
    else if (ch === "}") scanDepth--;

    if (ch === "\n" || i === body.length - 1) {
      const line = body.slice(lineStart, ch === "\n" ? i : i + 1);
      if (scanDepth === 0) {
        const lineMatch = /^\s*([a-z_][a-z0-9_]*)\s*:/.exec(line);
        if (lineMatch) names.push(lineMatch[1]!);
      }
      lineStart = i + 1;
    }
  }

  return names;
}

describe("Coding standards — handler error handling", () => {
  it("API dispatch handlers import errorResult and toMcpError", () => {
    const violations: string[] = [];

    for (const file of API_DISPATCH_HANDLERS) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("errorResult")) {
        violations.push(`${file}: missing errorResult import/usage`);
      }
      if (!content.includes("toMcpError")) {
        violations.push(`${file}: missing toMcpError import/usage`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("API dispatch handlers throw toMcpError for unexpected failures", () => {
    const violations: string[] = [];

    for (const file of API_DISPATCH_HANDLERS) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!/throw\s+toMcpError\s*\(/.test(content)) {
        violations.push(`${file}: missing throw toMcpError(err) in catch path`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("local handlers use errorResult for user-facing failures", () => {
    const violations: string[] = [];

    for (const file of LOCAL_HANDLERS) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("errorResult") && !content.includes('error:')) {
        violations.push(`${file}: missing graceful error handling`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

describe("Coding standards — list pagination defaults", () => {
  it("harness_list uses page=0 and size=20 defaults with max 100", () => {
    const content = readFileSync(join(REPO_ROOT, "src/tools/harness-list.ts"), "utf8");

    expect(content).toMatch(/page:\s*z\.number\(\)\.default\(0\)/);
    expect(content).toMatch(/size:\s*z\.number\(\)\.min\(1\)\.max\(100\)\.default\(20\)/);
  });
});

describe("Coding standards — snake_case input params", () => {
  it("harness handler inputSchema keys use snake_case", () => {
    const violations: string[] = [];
    const snakeCase = /^[a-z][a-z0-9_]*$/;

    for (const file of ALL_HANDLERS) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      for (const name of extractInputSchemaPropertyNames(content)) {
        if (!snakeCase.test(name)) {
          violations.push(`${rel(join(REPO_ROOT, file))}.${name}`);
        }
      }
    }

    expect(
      violations,
      `Non-snake_case inputSchema keys:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
