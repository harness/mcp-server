/**
 * Response extractor conventions from docs/coding-standards.md §3.
 *
 * Shared extractors live in src/registry/extractors.ts. Toolset files must
 * import named extractors from there instead of redefining them inline.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOOLSET_DIR = join(REPO_ROOT, "src/registry/toolsets");
const EXTRACTORS_FILE = join(REPO_ROOT, "src/registry/extractors.ts");

/** Helper modules — not required to follow toolset export conventions. */
const TOOLSET_HELPER_FILES = new Set([
  "src/registry/toolsets/chaos-descriptions.ts",
  "src/registry/toolsets/scopes.ts",
]);

function getSharedExtractorNames(): string[] {
  const content = readFileSync(EXTRACTORS_FILE, "utf8");
  const names: string[] = [];
  const exportRe = /^export const (\w+)/gm;
  let match: RegExpExecArray | null;
  while ((match = exportRe.exec(content)) !== null) {
    names.push(match[1]!);
  }
  return names;
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

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

function importsFromExtractors(content: string): boolean {
  return /from\s+["'][^"']*\/extractors(?:\.js)?["']/.test(content);
}

function importsExtractorName(content: string, name: string): boolean {
  const importMatch = content.match(
    /import\s*\{([^}]+)\}\s*from\s*["'][^"']*\/extractors(?:\.js)?["']/,
  );
  if (!importMatch) return false;
  return importMatch[1]!
    .split(",")
    .map((part) => part.trim().split(/\s+as\s+/)[0]!.trim())
    .includes(name);
}

function usesSharedExtractor(content: string, name: string): boolean {
  const usagePatterns = [
    new RegExp(`responseExtractor:\\s*${name}\\b`),
    new RegExp(`responseExtractor:\\s*${name}\\s*\\(`),
  ];
  return usagePatterns.some((pattern) => pattern.test(content));
}

function redefinesSharedExtractor(content: string, name: string): boolean {
  return new RegExp(`(?:const|function)\\s+${name}\\b`).test(content);
}

describe("Coding standards — shared response extractors", () => {
  const sharedExtractorNames = getSharedExtractorNames();

  it("toolset files import shared extractors from extractors.ts when referenced", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(TOOLSET_DIR)) {
      const fileRel = rel(file);
      if (TOOLSET_HELPER_FILES.has(fileRel)) continue;

      const content = readFileSync(file, "utf8");
      const referenced = sharedExtractorNames.filter((name) => usesSharedExtractor(content, name));
      if (referenced.length === 0) continue;

      if (!importsFromExtractors(content)) {
        violations.push(`${fileRel}: uses ${referenced.join(", ")} but does not import from extractors.js`);
        continue;
      }

      for (const name of referenced) {
        if (!importsExtractorName(content, name)) {
          violations.push(`${fileRel}: uses ${name} but does not import it from extractors.js`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("toolset files do not redefine shared extractors locally", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(TOOLSET_DIR)) {
      const fileRel = rel(file);
      if (TOOLSET_HELPER_FILES.has(fileRel)) continue;

      const content = readFileSync(file, "utf8");
      for (const name of sharedExtractorNames) {
        if (redefinesSharedExtractor(content, name)) {
          violations.push(`${fileRel}: redefines shared extractor ${name}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
