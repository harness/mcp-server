/**
 * Registry metadata and handler contract checks from docs/coding-standards.md.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Registry } from "../../src/registry/index.js";
import { ALL_HANDLER_FILES, WRITE_HANDLER_FILES } from "./allowed-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const HANDLER_FILES = ALL_HANDLER_FILES;

const MINIMAL_CONFIG = {
  HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
  HARNESS_BASE_URL: "https://app.harness.io",
} as const;

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

/** Extract top-level inputSchema property blocks from a handler file. */
function extractInputSchemaProperties(content: string): Array<{ name: string; block: string }> {
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
  const properties: Array<{ name: string; block: string }> = [];
  const keyPositions: Array<{ name: string; index: number }> = [];

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
        if (lineMatch) {
          keyPositions.push({ name: lineMatch[1]!, index: lineStart });
        }
      }
      lineStart = i + 1;
    }
  }

  for (let i = 0; i < keyPositions.length; i++) {
    const start = keyPositions[i]!.index;
    const end = i + 1 < keyPositions.length ? keyPositions[i + 1]!.index : body.length;
    properties.push({
      name: keyPositions[i]!.name,
      block: body.slice(start, end),
    });
  }

  return properties;
}

/** Shared Zod schemas that already attach .describe() at definition site. */
const DESCRIBED_SCHEMA_REFS = new Set([
  "resourceScopeSchema",
  "scopeSchema",
]);

function propertyHasDescribe(_name: string, block: string): boolean {
  const trimmed = block.trim().replace(/,$/, "");
  const value = trimmed.slice(trimmed.indexOf(":") + 1).trim().replace(/,$/, "");
  if (DESCRIBED_SCHEMA_REFS.has(value)) {
    return true;
  }
  return /\.describe\s*\(/.test(block);
}

describe("Coding standards — registry metadata", () => {
  const registry = new Registry(MINIMAL_CONFIG);

  it("declares listFilterFields only on resources with a list operation", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      if (!def.listFilterFields?.length) continue;
      if (!def.operations.list) {
        violations.push(
          `${resourceType}: listFilterFields without list — use get.paramsSchema instead (see kg_related_type)`,
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

describe("Coding standards — write handler safety", () => {
  it("write/execute handlers use confirmViaElicitation before dispatch", () => {
    const violations: string[] = [];

    for (const file of WRITE_HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes("confirmViaElicitation")) {
        violations.push(`${file}: missing confirmViaElicitation`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});

describe("Coding standards — tool input documentation", () => {
  it("every harness handler inputSchema property chains .describe()", () => {
    const violations: string[] = [];

    for (const file of HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      const properties = extractInputSchemaProperties(content);

      for (const { name, block } of properties) {
        if (!propertyHasDescribe(name, block)) {
          violations.push(`${rel(join(REPO_ROOT, file))}.${name}`);
        }
      }
    }

    expect(
      violations,
      `inputSchema properties missing .describe():\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
