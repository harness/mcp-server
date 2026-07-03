/**
 * Tool input schema conventions from docs/coding-standards.md §8.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_HANDLER_FILES } from "./allowed-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** snake_case: lowercase letters, digits, underscores only. */
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

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
        const lineMatch = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/.exec(line);
        if (lineMatch) names.push(lineMatch[1]!);
      }
      lineStart = i + 1;
    }
  }

  return names;
}

describe("Coding standards — tool input conventions", () => {
  it("harness_list uses pagination defaults page=0 and size=20 (max 100)", () => {
    const content = readFileSync(join(REPO_ROOT, "src/tools/harness-list.ts"), "utf8");
    expect(content).toMatch(/page:\s*z\.number\(\)\.default\(0\)/);
    expect(content).toMatch(/size:\s*z\.number\(\)\.min\(1\)\.max\(100\)\.default\(20\)/);
  });

  it("all harness handler inputSchema params use snake_case", () => {
    const violations: string[] = [];

    for (const file of ALL_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      for (const name of extractInputSchemaPropertyNames(content)) {
        if (!SNAKE_CASE.test(name)) {
          violations.push(`${file}: ${name}`);
        }
      }
    }

    expect(
      violations,
      `Non-snake_case inputSchema params:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
