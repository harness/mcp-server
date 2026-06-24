/**
 * Tool handler contract checks from docs/coding-standards.md:
 * Zod descriptions, write confirmation, error mapping, pagination defaults.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

const ALLOWED_REGISTER_TOOL_FILES = [
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
] as const;

/** Local-only handlers that may use graceful errorResult without toMcpError. */
const ERROR_PATTERN_EXCEPTIONS = new Set(["src/tools/harness-describe.ts"]);

const WRITE_TOOL_FILES = [
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
] as const;

function readHandler(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

/** Extract the inputSchema object literal (first level only). */
function extractInputSchemaBlock(content: string): string {
  const start = content.indexOf("inputSchema: {");
  if (start === -1) return "";

  let depth = 0;
  let i = start + "inputSchema: ".length;
  for (; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return content.slice(start, i + 1);
      }
    }
  }
  return "";
}

function countTopLevelInputFields(inputSchemaBlock: string): string[] {
  const inner = inputSchemaBlock.replace(/^inputSchema:\s*\{/, "").replace(/\}\s*$/, "");
  const lines = inner.split("\n");
  const fields: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s{8}(\w+):/);
    if (match) fields.push(match[1]!);
  }
  return fields;
}

function fieldHasDescribe(inputSchemaBlock: string, fieldName: string): boolean {
  const marker = `${fieldName}:`;
  const startIdx = inputSchemaBlock.indexOf(marker);
  if (startIdx === -1) return false;

  const afterMarker = inputSchemaBlock.slice(startIdx + marker.length);
  const nextFieldIdx = afterMarker.search(/\n\s{8}\w+:/);
  const fieldSlice = nextFieldIdx === -1 ? afterMarker : afterMarker.slice(0, nextFieldIdx);

  if (/\.describe\s*\(/.test(fieldSlice)) return true;
  if (/\b(resourceScopeSchema|scopeSchema)\b/.test(fieldSlice)) return true;

  return false;
}

describe("Coding standards — tool handler contracts", () => {
  it("every inputSchema field has a .describe() for LLM tool selection", () => {
    const violations: string[] = [];

    for (const file of ALLOWED_REGISTER_TOOL_FILES) {
      const content = readHandler(file);
      const block = extractInputSchemaBlock(content);
      if (!block) {
        violations.push(`${file}: could not parse inputSchema block`);
        continue;
      }

      for (const fieldName of countTopLevelInputFields(block)) {
        if (!fieldHasDescribe(block, fieldName)) {
          violations.push(`${file}: input field "${fieldName}" is missing .describe()`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("write/execute handlers wire confirmViaElicitation before dispatch", () => {
    const violations: string[] = [];

    for (const file of WRITE_TOOL_FILES) {
      const content = readHandler(file);
      if (!content.includes("confirmViaElicitation")) {
        violations.push(`${file}: missing confirmViaElicitation import/call`);
      }
      if (!content.includes('confirm: z.boolean()')) {
        violations.push(`${file}: missing confirm param in inputSchema`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("mutating handlers use the standard error mapping catch pattern", () => {
    const violations: string[] = [];
    const outerCatchPattern =
      /catch\s*\(\s*err\s*\)\s*\{[\s\S]*?isUserError[\s\S]*?errorResult[\s\S]*?(?:isUserFixableApiError[\s\S]*?errorResult[\s\S]*?)?throw\s+toMcpError/;

    for (const file of ALLOWED_REGISTER_TOOL_FILES) {
      if (ERROR_PATTERN_EXCEPTIONS.has(file)) continue;

      const content = readHandler(file);
      if (!outerCatchPattern.test(content)) {
        violations.push(`${file}: missing isUserError/errorResult/throw toMcpError catch pattern`);
      }
      if (!content.includes("toMcpError")) {
        violations.push(`${file}: missing toMcpError import`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("harness_list keeps pagination defaults (page=0, size=20, max=100)", () => {
    const content = readHandler("src/tools/harness-list.ts");

    expect(content).toMatch(/page:\s*z\.number\(\)[\s\S]*?\.default\(0\)/);
    expect(content).toMatch(/size:\s*z\.number\(\)\.min\(1\)\.max\(100\)[\s\S]*?\.default\(20\)/);
  });

  it("read handlers set readOnlyHint and mutating handlers set destructiveHint appropriately", () => {
    const violations: string[] = [];

    const readOnlyTools = [
      "src/tools/harness-list.ts",
      "src/tools/harness-get.ts",
      "src/tools/harness-search.ts",
      "src/tools/harness-describe.ts",
      "src/tools/harness-schema.ts",
    ];
    const destructiveTools = ["src/tools/harness-delete.ts", "src/tools/harness-execute.ts"];

    for (const file of readOnlyTools) {
      const content = readHandler(file);
      if (!/readOnlyHint:\s*true/.test(content)) {
        violations.push(`${file}: expected readOnlyHint: true`);
      }
    }

    for (const file of destructiveTools) {
      const content = readHandler(file);
      if (!/destructiveHint:\s*true/.test(content)) {
        violations.push(`${file}: expected destructiveHint: true`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
