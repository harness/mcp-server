/**
 * Tool input schema conventions from docs/coding-standards.md §8.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HANDLER_PATHS as HANDLER_FILES } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** snake_case: lowercase letters, digits, underscores only. */
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

/** Shared field builders in input-schemas.ts that attach .describe() internally. */
const INPUT_SCHEMA_FIELD_BUILDERS = new Set([
  "orgIdField",
  "projectIdField",
  "resourceScopeField",
]);

function extractInputSchemaBody(content: string): string | null {
  const schemaStart = content.indexOf("inputSchema:");
  if (schemaStart === -1) return null;

  const braceStart = content.indexOf("{", schemaStart);
  if (braceStart === -1) return null;

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
  if (braceEnd === -1) return null;

  return content.slice(braceStart + 1, braceEnd);
}

type InputSchemaProperty = { name: string; text: string };

function extractInputSchemaProperties(content: string): InputSchemaProperty[] {
  const body = extractInputSchemaBody(content);
  if (!body) return [];

  const properties: InputSchemaProperty[] = [];
  let scanDepth = 0;
  let lineStart = 0;
  let current: InputSchemaProperty | null = null;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{") scanDepth++;
    else if (ch === "}") scanDepth--;

    if (ch === "\n" || i === body.length - 1) {
      const line = body.slice(lineStart, ch === "\n" ? i : i + 1);
      if (scanDepth === 0) {
        const lineMatch = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/.exec(line);
        if (lineMatch) {
          if (current) properties.push(current);
          current = { name: lineMatch[1]!, text: line };
        } else if (current) {
          current.text += line;
        }
      } else if (current) {
        current.text += line;
      }
      lineStart = i + 1;
    }
  }

  if (current) properties.push(current);
  return properties;
}

function extractInputSchemaPropertyNames(content: string): string[] {
  return extractInputSchemaProperties(content).map((p) => p.name);
}

function inputSchemaPropertyHasDescribe(property: InputSchemaProperty, fileContent: string): boolean {
  if (/\.describe\s*\(/.test(property.text)) return true;
  for (const builder of INPUT_SCHEMA_FIELD_BUILDERS) {
    if (new RegExp(`\\b${builder}\\s*\\(`).test(property.text)) return true;
  }
  const aliasMatch = /:\s*([A-Za-z_][A-Za-z0-9_]*)\s*,?\s*$/.exec(property.text.trim());
  if (aliasMatch) {
    const alias = aliasMatch[1]!;
    const constRe = new RegExp(`const\\s+${alias}\\s*=[\\s\\S]*?\\.describe\\s*\\(`);
    if (constRe.test(fileContent)) return true;
  }
  return false;
}

describe("Coding standards — tool input conventions", () => {
  it("harness_list uses pagination defaults page=0 and size=20 (max 100)", () => {
    const content = readFileSync(join(REPO_ROOT, "src/tools/harness-list.ts"), "utf8");
    expect(content).toMatch(/page:\s*z\.number\(\)\.default\(0\)/);
    expect(content).toMatch(/size:\s*z\.number\(\)\.min\(1\)\.max\(100\)\.default\(20\)/);
  });

  it("every harness handler inputSchema param has .describe() (LLM tool selection)", () => {
    const violations: string[] = [];

    for (const file of HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      for (const property of extractInputSchemaProperties(content)) {
        if (!inputSchemaPropertyHasDescribe(property, content)) {
          violations.push(`${file}: ${property.name}`);
        }
      }
    }

    expect(
      violations,
      `inputSchema params missing .describe():\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("all harness handler inputSchema params use snake_case", () => {
    const violations: string[] = [];

    for (const file of HANDLER_FILES) {
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
