/**
 * Multi-scope pathBuilder contract — docs/coding-standards.md §4.
 *
 * Custom pathBuilders that encode account/org/project in the URL path must accept
 * PathBuilderConfig and honor HARNESS_ORG / HARNESS_PROJECT defaults. Otherwise
 * list → get/update flows can target a different scope than the caller listed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOOLSET_DIR = join(REPO_ROOT, "src/registry/toolsets");

const TOOLSET_HELPER_FILES = new Set([
  "src/registry/toolsets/chaos-descriptions.ts",
  "src/registry/toolsets/scopes.ts",
]);

/** Heuristics for pathBuilders that embed scope in the path (not query params). */
const SCOPE_ENCODING_PATTERNS = [
  /let\s+scope\s*=/,
  /scope\s*\+=/,
  /HARNESS_ORG/,
  /HARNESS_PROJECT/,
  /templateV1BasePathFromScope/,
  /effectiveOrgId/,
  /shouldUseProject/,
  /shouldUseOrg/,
  /\/v1\/entities\/\$\{/,
];

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

function encodesScopeInPath(snippet: string): boolean {
  return SCOPE_ENCODING_PATTERNS.some((pattern) => pattern.test(snippet));
}

function contentHasMultiScopeResource(content: string): boolean {
  return /supportedScopes:\s*\[[^\]]*,/.test(content);
}

describe("Coding standards — multi-scope pathBuilders", () => {
  it("named pathBuilder helpers that encode scope accept PathBuilderConfig", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(TOOLSET_DIR)) {
      const fileRel = rel(file);
      if (TOOLSET_HELPER_FILES.has(fileRel)) continue;

      const content = readFileSync(file, "utf8");
      const pathBuilderRefs = [...content.matchAll(/pathBuilder:\s*(\w+)/g)].map((m) => m[1]!);

      for (const fnName of pathBuilderRefs) {
        const sigRe = new RegExp(`const\\s+${fnName}\\s*=\\s*\\(([^)]*)\\)`);
        const sigMatch = sigRe.exec(content);
        if (!sigMatch) continue;

        const params = sigMatch[1]!;
        const fnSnippet = content.slice(sigMatch.index!, sigMatch.index! + 1200);
        if (encodesScopeInPath(fnSnippet) && !/\bconfig\b/.test(params)) {
          violations.push(
            `${fileRel}: ${fnName} encodes scope in the path but lacks PathBuilderConfig — pass (input, config) and honor HARNESS_ORG/HARNESS_PROJECT`,
          );
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("inline pathBuilders on multi-scope resources that encode scope accept config", () => {
    const violations: string[] = [];

    for (const file of walkTsFiles(TOOLSET_DIR)) {
      const fileRel = rel(file);
      if (TOOLSET_HELPER_FILES.has(fileRel)) continue;

      const content = readFileSync(file, "utf8");
      if (!contentHasMultiScopeResource(content)) continue;

      for (const match of content.matchAll(/pathBuilder:\s*\(([^)]*)\)\s*=>/g)) {
        const params = match[1]!;
        const start = match.index ?? 0;
        const snippet = content.slice(start, start + 1200);
        if (encodesScopeInPath(snippet) && !/\bconfig\b/.test(params)) {
          violations.push(
            `${fileRel}: inline pathBuilder encodes scope but params are (${params}) — use (input, config)`,
          );
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
