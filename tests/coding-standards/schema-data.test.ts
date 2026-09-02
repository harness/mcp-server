/**
 * Guardrails for vendored harness_schema JSON Schema snapshots under src/data/schemas/.
 * Sync PRs (e.g. chore/sync-schemas) must only refresh auto-generated upstream copies.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const SCHEMAS_ROOT = join(REPO_ROOT, "src/data/schemas");

const SYNCED_VERSION_DIRS = ["v0", "v1"] as const;

const FORBIDDEN_IMPORT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /from\s+["'][^"']*harness-client/, reason: "HarnessClient import" },
  { pattern: /from\s+["']@modelcontextprotocol\/sdk/, reason: "MCP SDK import" },
  { pattern: /from\s+["'][^"']*\/registry/, reason: "Registry import" },
];

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

function listTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

describe("Coding standards — schema data snapshots", () => {
  it("synced v0/v1 schema files are auto-generated upstream copies", () => {
    const violations: string[] = [];

    for (const version of SYNCED_VERSION_DIRS) {
      const dir = join(SCHEMAS_ROOT, version);
      for (const file of listTsFiles(dir)) {
        const content = readFileSync(file, "utf8");
        if (!content.startsWith("// Auto-generated from https://raw.githubusercontent.com/harness/harness-schema/")) {
          violations.push(`${rel(file)}: missing upstream auto-generated header`);
        }
        if (!content.includes("@ts-nocheck")) {
          violations.push(`${rel(file)}: missing @ts-nocheck`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("schema snapshot files do not import HarnessClient, MCP SDK, or Registry", () => {
    const violations: string[] = [];
    const scanDirs = [
      join(SCHEMAS_ROOT, "v0"),
      join(SCHEMAS_ROOT, "v1"),
      join(SCHEMAS_ROOT, "entities"),
      join(SCHEMAS_ROOT, "local"),
    ];

    for (const dir of scanDirs) {
      for (const file of listTsFiles(dir)) {
        const content = readFileSync(file, "utf8");
        const fileRel = rel(file);

        for (const { pattern, reason } of FORBIDDEN_IMPORT_PATTERNS) {
          if (pattern.test(content)) {
            violations.push(`${fileRel}: ${reason}`);
          }
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
